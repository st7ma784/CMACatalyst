#!/usr/bin/env python3
"""
Document ingestion script for processing HTML and TXT files into ChromaDB vector store.
Uses Ollama embeddings for vector generation.
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


def load_html_file(file_path):
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


def load_txt_file(file_path):
    """Load text content from TXT file."""
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        return f.read()


def load_documents(documents_dir="/documents"):
    """Load all HTML and TXT documents from the documents directory."""
    documents = []
    metadata = []

    # Process HTML files
    html_files = glob.glob(os.path.join(documents_dir, "**/*.html"), recursive=True)
    for file_path in html_files:
        print(f"Processing HTML: {file_path}")
        content = load_html_file(file_path)
        documents.append(content)
        metadata.append({"source": file_path, "type": "html"})

    # Process TXT files
    txt_files = glob.glob(os.path.join(documents_dir, "**/*.txt"), recursive=True)
    for file_path in txt_files:
        print(f"Processing TXT: {file_path}")
        content = load_txt_file(file_path)
        documents.append(content)
        metadata.append({"source": file_path, "type": "txt"})

    return documents, metadata


def create_vector_store(documents, metadata, persist_directory="/data/vectorstore"):
    """Create and persist ChromaDB vector store with document embeddings."""

    # Initialize embeddings using Ollama
    ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
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
        all_metadata.extend([meta] * len(chunks))

    print(f"Created {len(all_chunks)} chunks from {len(documents)} documents")

    # Create ChromaDB vector store
    vectorstore = Chroma.from_texts(
        texts=all_chunks,
        embedding=embeddings,
        metadatas=all_metadata,
        persist_directory=persist_directory,
        collection_name="documents"
    )

    print(f"Vector store created and persisted to {persist_directory}")
    return vectorstore


def main():
    """Main ingestion process."""
    print("Starting document ingestion...")

    # Load documents
    documents, metadata = load_documents()

    if not documents:
        print("No documents found to process.")
        return

    print(f"Loaded {len(documents)} documents")

    # Create vector store
    create_vector_store(documents, metadata)

    print("Document ingestion complete!")


if __name__ == "__main__":
    main()
