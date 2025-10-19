#!/usr/bin/env python3
"""
Script to re-process existing client uploads and ingest them into vector store
This is needed after fixing the file handle bug that prevented ingestion
"""

import os
import json
import asyncio
import httpx
from pathlib import Path

UPLOAD_DIR = Path("/data/uploads")  # Inside container
DOC_PROCESSOR_URL = "http://doc-processor:8101"
CLIENT_RAG_URL = "http://client-rag-service:8104"


async def process_and_ingest_document(client_id: str, file_path: Path, original_filename: str):
    """Process a document and ingest it into the client RAG."""
    print(f"Processing {original_filename} for client {client_id}...")
    
    try:
        # Process to markdown
        async with httpx.AsyncClient(timeout=120.0) as client:
            with open(file_path, 'rb') as f:
                files = {'file': (file_path.name, f, 'application/octet-stream')}
                response = await client.post(f"{DOC_PROCESSOR_URL}/process", files=files)
            
            if response.status_code != 200:
                print(f"  ❌ Doc processing failed: HTTP {response.status_code}")
                return False
            
            result = response.json()
            if not result.get('success'):
                print(f"  ❌ Doc processing failed: {result.get('error')}")
                return False
            
            markdown = result.get('markdown')
            print(f"  ✅ Extracted {len(markdown)} chars of markdown")
        
        # Ingest into RAG
        async with httpx.AsyncClient(timeout=60.0) as client:
            payload = {
                "client_id": client_id,
                "document_text": markdown,
                "filename": original_filename,
                "metadata": {
                    "reprocessed": True,
                    "original_filename": original_filename
                }
            }
            response = await client.post(f"{CLIENT_RAG_URL}/ingest", json=payload)
            
            if response.status_code != 200:
                print(f"  ❌ RAG ingestion failed: HTTP {response.status_code}")
                return False
            
            result = response.json()
            if result.get('success'):
                chunks = result.get('chunks_created', 0)
                print(f"  ✅ Ingested {chunks} chunks into vector store")
                return True
            else:
                print(f"  ❌ RAG ingestion failed")
                return False
    
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False


async def main():
    """Main function to re-process all client uploads."""
    if not UPLOAD_DIR.exists():
        print(f"Upload directory not found: {UPLOAD_DIR}")
        return
    
    total_processed = 0
    total_success = 0
    total_failed = 0
    
    # Iterate through client directories
    for client_dir in UPLOAD_DIR.iterdir():
        if not client_dir.is_dir():
            continue
        
        client_id = client_dir.name
        metadata_file = client_dir / "metadata.json"
        
        if not metadata_file.exists():
            print(f"\n📁 Client {client_id}: No metadata found, skipping")
            continue
        
        # Read metadata
        with open(metadata_file) as f:
            metadata = json.load(f)
        
        documents = metadata.get("documents", [])
        if not documents:
            print(f"\n📁 Client {client_id}: No documents found")
            continue
        
        print(f"\n📁 Client {client_id}: {len(documents)} documents")
        
        for doc in documents:
            filename = doc.get("filename")
            original_filename = doc.get("original_filename", filename)
            
            # Skip if already indexed
            if doc.get("indexed_to_rag"):
                print(f"  ⏭️  {original_filename}: Already indexed, skipping")
                continue
            
            file_path = client_dir / filename
            if not file_path.exists():
                print(f"  ⚠️  {original_filename}: File not found at {file_path}")
                continue
            
            total_processed += 1
            success = await process_and_ingest_document(client_id, file_path, original_filename)
            
            if success:
                total_success += 1
                # Update metadata to mark as indexed
                doc["indexed_to_rag"] = True
            else:
                total_failed += 1
        
        # Save updated metadata
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
    
    print(f"\n" + "="*60)
    print(f"✅ Re-processing complete!")
    print(f"   Total processed: {total_processed}")
    print(f"   Successful: {total_success}")
    print(f"   Failed: {total_failed}")
    print(f"="*60)


if __name__ == "__main__":
    asyncio.run(main())
