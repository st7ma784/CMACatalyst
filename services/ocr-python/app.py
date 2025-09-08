import os
import io
import base64
import logging
import tempfile
from datetime import datetime
from typing import Dict, List, Optional
import uuid

import cv2
import numpy as np
import pytesseract
from PIL import Image
import fitz  # PyMuPDF
from pdf2image import convert_from_path, convert_from_bytes
import redis
from flask import Flask, request, jsonify, send_file
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Initialize Redis connection
try:
    redis_client = redis.Redis(
        host=os.getenv('REDIS_HOST', 'redis'),
        port=int(os.getenv('REDIS_PORT', 6379)),
        db=int(os.getenv('REDIS_DB', 2)),
        decode_responses=True
    )
    redis_client.ping()
    logger.info("Redis connection established")
except Exception as e:
    logger.warning(f"Redis connection failed: {e}")
    redis_client = None

# Configuration
UPLOAD_FOLDER = '/app/uploads'
TEMP_FOLDER = '/app/temp'
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff'}

# Ensure directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(TEMP_FOLDER, exist_ok=True)

class OCRProcessor:
    """Enhanced OCR processing with advanced image preprocessing"""
    
    def __init__(self):
        self.tesseract_config = '--oem 3 --psm 6 -c preserve_interword_spaces=1'
        
    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Advanced image preprocessing for better OCR results"""
        try:
            # Convert to grayscale if needed
            if len(image.shape) == 3:
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            else:
                gray = image.copy()
            
            # Noise reduction
            denoised = cv2.medianBlur(gray, 3)
            
            # Adaptive thresholding
            binary = cv2.adaptiveThreshold(
                denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                cv2.THRESH_BINARY, 11, 2
            )
            
            # Morphological operations to clean up
            kernel = np.ones((1, 1), np.uint8)
            cleaned = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
            
            return cleaned
            
        except Exception as e:
            logger.error(f"Image preprocessing failed: {e}")
            return image
    
    def extract_text_from_image(self, image_data: bytes) -> Dict:
        """Extract text from image with confidence scores"""
        try:
            # Convert bytes to PIL Image
            image = Image.open(io.BytesIO(image_data))
            
            # Convert to OpenCV format
            cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
            
            # Preprocess image
            processed_image = self.preprocess_image(cv_image)
            
            # Extract text with confidence
            text_data = pytesseract.image_to_data(
                processed_image, 
                config=self.tesseract_config,
                output_type=pytesseract.Output.DICT
            )
            
            # Extract full text
            full_text = pytesseract.image_to_string(
                processed_image, 
                config=self.tesseract_config
            ).strip()
            
            # Calculate confidence metrics
            confidences = [int(conf) for conf in text_data['conf'] if int(conf) > 0]
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0
            
            # Extract structured data
            words = []
            for i, word in enumerate(text_data['text']):
                if word.strip() and int(text_data['conf'][i]) > 30:
                    words.append({
                        'text': word,
                        'confidence': int(text_data['conf'][i]),
                        'bbox': {
                            'x': text_data['left'][i],
                            'y': text_data['top'][i],
                            'width': text_data['width'][i],
                            'height': text_data['height'][i]
                        }
                    })
            
            return {
                'text': full_text,
                'confidence': round(avg_confidence, 2),
                'word_count': len(full_text.split()),
                'words': words,
                'image_dimensions': {
                    'width': image.width,
                    'height': image.height
                }
            }
            
        except Exception as e:
            logger.error(f"OCR processing failed: {e}")
            raise Exception(f"OCR processing failed: {str(e)}")
    
    def extract_text_from_pdf(self, pdf_data: bytes) -> Dict:
        """Extract text from PDF using multiple methods"""
        try:
            results = []
            total_text = ""
            
            # Method 1: Try direct text extraction first (faster)
            try:
                pdf_document = fitz.open(stream=pdf_data, filetype="pdf")
                direct_text = ""
                
                for page_num in range(pdf_document.page_count):
                    page = pdf_document[page_num]
                    page_text = page.get_text()
                    direct_text += page_text + "\n"
                
                pdf_document.close()
                
                # If we got substantial text, use it
                if len(direct_text.strip()) > 50:
                    total_text = direct_text.strip()
                    results.append({
                        'page': 'all',
                        'method': 'direct_extraction',
                        'text': total_text,
                        'confidence': 95.0
                    })
                    
                    return {
                        'text': total_text,
                        'confidence': 95.0,
                        'word_count': len(total_text.split()),
                        'pages': results,
                        'extraction_method': 'direct'
                    }
            except Exception as e:
                logger.warning(f"Direct PDF text extraction failed: {e}")
            
            # Method 2: OCR-based extraction for scanned PDFs
            try:
                images = convert_from_bytes(pdf_data, dpi=300)
                
                for i, image in enumerate(images):
                    # Convert PIL image to bytes
                    img_byte_arr = io.BytesIO()
                    image.save(img_byte_arr, format='PNG')
                    img_bytes = img_byte_arr.getvalue()
                    
                    # Process with OCR
                    ocr_result = self.extract_text_from_image(img_bytes)
                    
                    if ocr_result['text'].strip():
                        results.append({
                            'page': i + 1,
                            'method': 'ocr',
                            'text': ocr_result['text'],
                            'confidence': ocr_result['confidence']
                        })
                        total_text += ocr_result['text'] + "\n"
                
                if total_text.strip():
                    avg_confidence = sum(r['confidence'] for r in results) / len(results) if results else 0
                    
                    return {
                        'text': total_text.strip(),
                        'confidence': round(avg_confidence, 2),
                        'word_count': len(total_text.split()),
                        'pages': results,
                        'extraction_method': 'ocr'
                    }
                    
            except Exception as e:
                logger.error(f"OCR PDF processing failed: {e}")
            
            raise Exception("Could not extract text from PDF using any method")
            
        except Exception as e:
            logger.error(f"PDF processing failed: {e}")
            raise Exception(f"PDF processing failed: {str(e)}")

# Initialize OCR processor
ocr_processor = OCRProcessor()

def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def cache_result(cache_key: str, result: Dict, expiry: int = 3600):
    """Cache OCR result in Redis"""
    if redis_client:
        try:
            import json
            redis_client.setex(cache_key, expiry, json.dumps(result))
        except Exception as e:
            logger.warning(f"Cache write failed: {e}")

def get_cached_result(cache_key: str) -> Optional[Dict]:
    """Get cached OCR result from Redis"""
    if redis_client:
        try:
            import json
            cached = redis_client.get(cache_key)
            return json.loads(cached) if cached else None
        except Exception as e:
            logger.warning(f"Cache read failed: {e}")
    return None

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        # Test Tesseract
        test_image = Image.new('RGB', (100, 100), color='white')
        pytesseract.image_to_string(test_image)
        
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'services': {
                'tesseract': True,
                'redis': redis_client is not None
            }
        })
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 500

@app.route('/ocr/extract', methods=['POST'])
def extract_text():
    """Main OCR extraction endpoint"""
    try:
        # Check if file is provided
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'File type not allowed'}), 400
        
        # Generate cache key
        file_content = file.read()
        file.seek(0)  # Reset file pointer
        
        import hashlib
        cache_key = f"ocr:{hashlib.md5(file_content).hexdigest()}"
        
        # Check cache first
        cached_result = get_cached_result(cache_key)
        if cached_result:
            logger.info(f"Returning cached result for {file.filename}")
            return jsonify({
                'success': True,
                'cached': True,
                'filename': file.filename,
                **cached_result
            })
        
        # Process file based on type
        filename = secure_filename(file.filename)
        file_ext = filename.rsplit('.', 1)[1].lower()
        
        processing_id = str(uuid.uuid4())
        logger.info(f"Processing file {filename} (ID: {processing_id})")
        
        if file_ext == 'pdf':
            result = ocr_processor.extract_text_from_pdf(file_content)
        else:
            result = ocr_processor.extract_text_from_image(file_content)
        
        # Add metadata
        result.update({
            'processing_id': processing_id,
            'filename': filename,
            'file_size': len(file_content),
            'processed_at': datetime.utcnow().isoformat()
        })
        
        # Cache result
        cache_result(cache_key, result)
        
        logger.info(f"Successfully processed {filename} - {result['word_count']} words extracted")
        
        return jsonify({
            'success': True,
            'cached': False,
            **result
        })
        
    except Exception as e:
        logger.error(f"OCR extraction failed: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 500

@app.route('/ocr/batch', methods=['POST'])
def batch_extract():
    """Batch OCR processing endpoint"""
    try:
        files = request.files.getlist('files')
        if not files:
            return jsonify({'error': 'No files provided'}), 400
        
        results = []
        for file in files:
            if file.filename == '' or not allowed_file(file.filename):
                continue
                
            try:
                file_content = file.read()
                filename = secure_filename(file.filename)
                file_ext = filename.rsplit('.', 1)[1].lower()
                
                if file_ext == 'pdf':
                    result = ocr_processor.extract_text_from_pdf(file_content)
                else:
                    result = ocr_processor.extract_text_from_image(file_content)
                
                result['filename'] = filename
                result['success'] = True
                results.append(result)
                
            except Exception as e:
                results.append({
                    'filename': file.filename,
                    'success': False,
                    'error': str(e)
                })
        
        return jsonify({
            'success': True,
            'processed_count': len(results),
            'results': results
        })
        
    except Exception as e:
        logger.error(f"Batch OCR processing failed: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/ocr/base64', methods=['POST'])
def extract_from_base64():
    """Extract text from base64 encoded image/PDF"""
    try:
        data = request.get_json()
        if not data or 'content' not in data:
            return jsonify({'error': 'No base64 content provided'}), 400
        
        # Decode base64
        try:
            file_content = base64.b64decode(data['content'])
        except Exception as e:
            return jsonify({'error': 'Invalid base64 content'}), 400
        
        file_type = data.get('type', 'image').lower()
        
        # Process based on type
        if file_type == 'pdf':
            result = ocr_processor.extract_text_from_pdf(file_content)
        else:
            result = ocr_processor.extract_text_from_image(file_content)
        
        result['processed_at'] = datetime.utcnow().isoformat()
        
        return jsonify({
            'success': True,
            **result
        })
        
    except Exception as e:
        logger.error(f"Base64 OCR processing failed: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/ocr/stats', methods=['GET'])
def get_stats():
    """Get OCR service statistics"""
    try:
        stats = {
            'service': 'OCR Python Service',
            'version': '1.0.0',
            'uptime': datetime.utcnow().isoformat(),
            'supported_formats': list(ALLOWED_EXTENSIONS),
            'tesseract_version': pytesseract.get_tesseract_version(),
            'redis_connected': redis_client is not None
        }
        
        if redis_client:
            try:
                cache_keys = redis_client.keys("ocr:*")
                stats['cached_results'] = len(cache_keys)
            except:
                stats['cached_results'] = 0
        
        return jsonify(stats)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    logger.info("Starting OCR Python Service...")
    app.run(host='0.0.0.0', port=8080, debug=False)
