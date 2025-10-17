#!/usr/bin/env python3
"""
Enhanced Document Ingestion with LLaVA Vision Model
Supports: HTML, TXT, PDF (with vision model), and Images
Uses local Ollama LLaVA for superior document understanding
"""

import os
import glob
from pathlib import Path
from bs4 import BeautifulSoup
import chromadb
from chromadb.config import Settings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import OllamaEmbeddings
from langchain_community.vectorstores import Chroma
from typing import List, Dict, Tuple
import mimetypes
import logging

# Import local vision parser
try:
    from local_parser import LocalDocumentParser
    VISION_MODEL_AVAILABLE = True
except ImportError:
    VISION_MODEL_AVAILABLE = False
    print("Warning: local_parser not available. PDF/Image processing will be limited.")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def load_html_file(file_path: str) -> str:
    """Extract text content from HTML file."""
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
        text = soup.get_text()
        # Clean up whitespace
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = '\n'.join(chunk for chunk in chunks if chunk)
        return text


def load_txt_file(file_path: str) -> str:
    """Load text content from TXT file."""
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        return f.read()


def load_pdf_with_vision(file_path: str, parser: 'LocalDocumentParser') -> Tuple[str, Dict]:
    """
    Load PDF using LLaVA vision model for superior understanding.
    Returns: (text_content, metadata_dict)
    """
    logger.info(f"Processing PDF with LLaVA vision model: {file_path}")
    
    try:
        result = parser.parse_document(file_path, high_quality=True)
        
        # Extract comprehensive metadata
        metadata = {
            "source": file_path,
            "type": "pdf",
            "method": result.get('method', 'vision_llm'),
            "model": result.get('model', 'llava'),
            "total_pages": result.get('total_pages', 0),
            "document_type": result.get('classification', {}).get('document_type', 'unknown'),
            "confidence": result.get('classification', {}).get('confidence', 0),
        }
        
        # Add structured data if available
        if result.get('structured_data'):
            metadata['structured_data'] = str(result['structured_data'])
        
        logger.info(f"✓ PDF processed: {result.get('total_pages', 0)} pages, "
                   f"type: {metadata['document_type']}, "
                   f"confidence: {metadata['confidence']:.2f}")
        
        return result['text'], metadata
        
    except Exception as e:
        logger.error(f"Error processing PDF with vision model: {e}")
        # Fallback to basic text extraction
        return load_pdf_fallback(file_path), {
            "source": file_path,
            "type": "pdf",
            "method": "fallback",
            "error": str(e)
        }


def load_pdf_fallback(file_path: str) -> str:
    """Fallback PDF loading using PyPDF2 or pdfplumber."""
    try:
        import PyPDF2
        text = []
        with open(file_path, 'rb') as f:
            pdf_reader = PyPDF2.PdfReader(f)
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                text.append(page.extract_text())
        return '\n\n'.join(text)
    except Exception as e:
        logger.warning(f"PyPDF2 fallback failed: {e}")
        return f"[PDF content could not be extracted from {file_path}]"


def load_image_with_vision(file_path: str, parser: 'LocalDocumentParser') -> Tuple[str, Dict]:
    """Load image using LLaVA vision model."""
    logger.info(f"Processing image with LLaVA vision model: {file_path}")
    
    try:
        result = parser.parse_document(file_path, high_quality=True)
        
        metadata = {
            "source": file_path,
            "type": "image",
            "method": "vision_llm",
            "model": result.get('model', 'llava'),
            "document_type": result.get('classification', {}).get('document_type', 'unknown'),
        }
        
        logger.info(f"✓ Image processed: type: {metadata['document_type']}")
        
        return result['text'], metadata
        
    except Exception as e:
        logger.error(f"Error processing image with vision model: {e}")
        return f"[Image content could not be extracted from {file_path}]", {
            "source": file_path,
            "type": "image",
            "method": "error",
            "error": str(e)
        }


def load_documents(documents_dir: str = "/documents", use_vision_model: bool = True) -> Tuple[List[str], List[Dict]]:
    """
    Load all documents from the documents directory.
    Supports: HTML, TXT, PDF, PNG, JPG, JPEG, TIFF
    
    Args:
        documents_dir: Directory containing documents
        use_vision_model: Whether to use LLaVA vision model for PDFs/images
    
    Returns:
        Tuple of (documents, metadata)
    """
    documents = []
    metadata = []
    
    # Initialize vision parser if available and requested
    vision_parser = None
    if use_vision_model and VISION_MODEL_AVAILABLE:
        try:
            vision_parser = LocalDocumentParser()
            logger.info("✓ LLaVA vision model initialized for document processing")
        except Exception as e:
            logger.warning(f"Could not initialize vision model: {e}")
            vision_parser = None
    
    # Process HTML files
    html_files = glob.glob(os.path.join(documents_dir, "**/*.html"), recursive=True)
    for file_path in html_files:
        logger.info(f"Processing HTML: {file_path}")
        content = load_html_file(file_path)
        documents.append(content)
        metadata.append({"source": file_path, "type": "html", "method": "beautifulsoup"})
    
    # Process TXT files
    txt_files = glob.glob(os.path.join(documents_dir, "**/*.txt"), recursive=True)
    for file_path in txt_files:
        logger.info(f"Processing TXT: {file_path}")
        content = load_txt_file(file_path)
        documents.append(content)
        metadata.append({"source": file_path, "type": "txt", "method": "direct"})
    
    # Process PDF files with vision model
    pdf_files = glob.glob(os.path.join(documents_dir, "**/*.pdf"), recursive=True)
    for file_path in pdf_files:
        if vision_parser:
            content, meta = load_pdf_with_vision(file_path, vision_parser)
        else:
            logger.info(f"Processing PDF (fallback): {file_path}")
            content = load_pdf_fallback(file_path)
            meta = {"source": file_path, "type": "pdf", "method": "fallback"}
        
        documents.append(content)
        metadata.append(meta)
    
    # Process image files with vision model
    image_extensions = ['*.png', '*.jpg', '*.jpeg', '*.tiff', '*.tif']
    for ext in image_extensions:
        image_files = glob.glob(os.path.join(documents_dir, f"**/{ext}"), recursive=True)
        for file_path in image_files:
            if vision_parser:
                content, meta = load_image_with_vision(file_path, vision_parser)
                documents.append(content)
                metadata.append(meta)
            else:
                logger.warning(f"Skipping image (no vision model): {file_path}")
    
    return documents, metadata


def create_vector_store(documents: List[str], metadata: List[Dict], 
                       persist_directory: str = "/data/vectorstore") -> Chroma:
    """Create and persist ChromaDB vector store with document embeddings."""
    
    # Initialize embeddings using Ollama
    ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
    embeddings = OllamaEmbeddings(
        model="nomic-embed-text",
        base_url=ollama_base_url
    )
    
    # Split documents into chunks
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
    )
    
    all_chunks = []
    all_metadata = []
    
    for doc, meta in zip(documents, metadata):
        chunks = text_splitter.split_text(doc)
        all_chunks.extend(chunks)
        # Add chunk index to metadata
        for i, chunk in enumerate(chunks):
            chunk_meta = meta.copy()
            chunk_meta['chunk_index'] = i
            chunk_meta['total_chunks'] = len(chunks)
            all_metadata.append(chunk_meta)
    
    logger.info(f"Created {len(all_chunks)} chunks from {len(documents)} documents")
    
    # Log processing methods used
    methods_used = {}
    for meta in metadata:
        method = meta.get('method', 'unknown')
        methods_used[method] = methods_used.get(method, 0) + 1
    
    logger.info("Processing methods summary:")
    for method, count in methods_used.items():
        logger.info(f"  - {method}: {count} documents")
    
    # Create ChromaDB vector store
    vectorstore = Chroma.from_texts(
        texts=all_chunks,
        embedding=embeddings,
        metadatas=all_metadata,
        persist_directory=persist_directory,
        collection_name="documents"
    )
    
    logger.info(f"✓ Vector store created and persisted to {persist_directory}")
    return vectorstore


def main():
    """Main ingestion process with vision model support."""
    logger.info("=" * 60)
    logger.info("Enhanced Document Ingestion with LLaVA Vision Model")
    logger.info("=" * 60)
    
    # Check if vision model should be used
    use_vision = os.getenv("USE_VISION_MODEL", "true").lower() == "true"
    
    if use_vision and VISION_MODEL_AVAILABLE:
        logger.info("✓ Vision model enabled - PDFs and images will be processed with LLaVA")
    elif use_vision and not VISION_MODEL_AVAILABLE:
        logger.warning("⚠ Vision model requested but not available - falling back to basic extraction")
    else:
        logger.info("Vision model disabled - using basic extraction only")
    
    # Load documents
    logger.info("\nLoading documents...")
    documents, metadata = load_documents(use_vision_model=use_vision)
    
    if not documents:
        logger.warning("No documents found to process.")
        return
    
    logger.info(f"\n✓ Loaded {len(documents)} documents")
    
    # Show document type breakdown
    doc_types = {}
    for meta in metadata:
        doc_type = meta.get('type', 'unknown')
        doc_types[doc_type] = doc_types.get(doc_type, 0) + 1
    
    logger.info("\nDocument types:")
    for doc_type, count in doc_types.items():
        logger.info(f"  - {doc_type}: {count}")
    
    # Create vector store
    logger.info("\nCreating vector embeddings...")
    create_vector_store(documents, metadata)
    
    logger.info("\n" + "=" * 60)
    logger.info("✓ Document ingestion complete!")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
