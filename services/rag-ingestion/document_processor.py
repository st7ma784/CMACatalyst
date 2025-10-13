import io
import logging
from typing import List, Dict, Any
import PyPDF2
from langchain.text_splitter import RecursiveCharacterTextSplitter

logger = logging.getLogger(__name__)

class DocumentProcessor:
    """Handles document parsing and chunking for RAG ingestion"""

    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", " ", ""]
        )

    async def process_document(
        self,
        file_content: bytes,
        file_path: str,
        manual_type: str
    ) -> List[Dict[str, Any]]:
        """Process a document and return chunked text with metadata"""
        try:
            # Extract text based on file type
            if file_path.lower().endswith('.pdf'):
                text = await self._extract_pdf_text(file_content)
            elif file_path.lower().endswith('.txt'):
                text = file_content.decode('utf-8')
            else:
                logger.warning(f"Unsupported file type: {file_path}")
                return []

            if not text.strip():
                logger.warning(f"No text extracted from {file_path}")
                return []

            # Clean and preprocess text
            text = self._clean_text(text)

            # Split into chunks
            chunks = self.text_splitter.split_text(text)

            # Create chunk objects with metadata
            chunk_objects = []
            for i, chunk_text in enumerate(chunks):
                chunk_objects.append({
                    'text': chunk_text,
                    'metadata': {
                        'file_name': file_path.split('/')[-1],
                        'chunk_length': len(chunk_text),
                        'manual_type': manual_type,
                        'section': self._identify_section(chunk_text),
                        'keywords': self._extract_keywords(chunk_text)
                    }
                })

            logger.info(f"Processed {file_path}: {len(chunks)} chunks created")
            return chunk_objects

        except Exception as e:
            logger.error(f"Failed to process document {file_path}: {str(e)}")
            return []

    async def _extract_pdf_text(self, pdf_content: bytes) -> str:
        """Extract text from PDF content"""
        try:
            pdf_file = io.BytesIO(pdf_content)
            reader = PyPDF2.PdfReader(pdf_file)

            text = ""
            for page_num, page in enumerate(reader.pages):
                try:
                    page_text = page.extract_text()
                    text += f"\n--- Page {page_num + 1} ---\n{page_text}\n"
                except Exception as e:
                    logger.warning(f"Failed to extract text from page {page_num + 1}: {str(e)}")
                    continue

            return text

        except Exception as e:
            logger.error(f"PDF text extraction failed: {str(e)}")
            return ""

    def _clean_text(self, text: str) -> str:
        """Clean and normalize text"""
        # Remove excessive whitespace
        text = " ".join(text.split())

        # Remove common PDF artifacts
        text = text.replace('\x00', '')
        text = text.replace('\f', '\n')

        # Normalize line breaks
        text = text.replace('\r\n', '\n').replace('\r', '\n')

        # Remove excessive newlines
        while '\n\n\n' in text:
            text = text.replace('\n\n\n', '\n\n')

        return text.strip()

    def _identify_section(self, chunk_text: str) -> str:
        """Identify the section type of a chunk based on content patterns"""
        text_lower = chunk_text.lower()

        # Define section patterns
        if any(keyword in text_lower for keyword in ['introduction', 'overview', 'summary']):
            return 'introduction'
        elif any(keyword in text_lower for keyword in ['procedure', 'process', 'step', 'how to']):
            return 'procedure'
        elif any(keyword in text_lower for keyword in ['regulation', 'compliance', 'legal', 'fca']):
            return 'regulatory'
        elif any(keyword in text_lower for keyword in ['example', 'case study', 'scenario']):
            return 'example'
        elif any(keyword in text_lower for keyword in ['definition', 'term', 'glossary']):
            return 'definition'
        elif any(keyword in text_lower for keyword in ['warning', 'caution', 'important', 'note']):
            return 'warning'
        else:
            return 'content'

    def _extract_keywords(self, chunk_text: str) -> List[str]:
        """Extract key terms and phrases from chunk text"""
        # Simple keyword extraction - could be enhanced with NLP
        keywords = []

        # Common debt advice terms
        debt_terms = [
            'debt', 'credit', 'loan', 'mortgage', 'payment', 'interest',
            'bankruptcy', 'insolvency', 'iva', 'dmp', 'ccj', 'default',
            'budget', 'income', 'expenditure', 'priority', 'non-priority',
            'fca', 'compliance', 'affordability', 'vulnerable', 'financial difficulty'
        ]

        text_lower = chunk_text.lower()
        for term in debt_terms:
            if term in text_lower:
                keywords.append(term)

        # Extract capitalized terms (potential proper nouns/acronyms)
        words = chunk_text.split()
        for word in words:
            if word.isupper() and len(word) > 2:
                keywords.append(word.lower())

        return list(set(keywords))[:10]  # Limit to 10 keywords