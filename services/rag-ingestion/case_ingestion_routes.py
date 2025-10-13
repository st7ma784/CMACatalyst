from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import logging
from datetime import datetime
import hashlib

from case_processor import CaseProcessor
from embedding_service import EmbeddingService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cases", tags=["Case Management"])

# Initialize services
case_processor = CaseProcessor()

# Pydantic models
class ClosedCaseRequest(BaseModel):
    case_id: str
    case_data: Dict[str, Any]
    force_reprocess: bool = False

class CaseSimilarityRequest(BaseModel):
    query: str
    case_type: Optional[str] = None
    outcome_filter: Optional[str] = None
    top_k: int = 5
    score_threshold: float = 0.6

class CaseSearchResponse(BaseModel):
    similar_cases: List[Dict]
    query: str
    total_results: int

@router.post("/ingest/closed-case")
async def ingest_closed_case(
    request: ClosedCaseRequest,
    background_tasks: BackgroundTasks
):
    """Ingest a closed case into the vector store for precedent lookup"""
    try:
        case_id = request.case_id
        case_data = request.case_data

        # Validate required case data
        required_fields = ['case_outcome', 'advice_summary']
        missing_fields = [field for field in required_fields if not case_data.get(field)]

        if missing_fields:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required fields: {', '.join(missing_fields)}"
            )

        # Generate case hash for deduplication
        case_hash = hashlib.md5(f"{case_id}_{case_data.get('closed_date', '')}".encode()).hexdigest()

        # Check if already processed
        if not request.force_reprocess:
            from main import chroma_client
            collection = chroma_client.get_collection("case_precedents")
            existing = collection.get(where={"case_hash": case_hash})
            if existing['ids']:
                return {
                    "status": "already_processed",
                    "message": f"Case {case_id} already in vector store",
                    "case_hash": case_hash
                }

        # Process case in background
        background_tasks.add_task(
            process_closed_case_background,
            case_id,
            case_data,
            case_hash,
            request.force_reprocess
        )

        return {
            "status": "accepted",
            "message": f"Started processing closed case {case_id}",
            "case_hash": case_hash
        }

    except Exception as e:
        logger.error(f"Failed to ingest closed case {request.case_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search/similar", response_model=CaseSearchResponse)
async def search_similar_cases(request: CaseSimilarityRequest):
    """Find similar closed cases for precedent lookup"""
    try:
        from main import chroma_client, embedding_service

        # Generate query embedding
        query_embedding = await embedding_service.generate_embedding(request.query)

        # Search in case precedents collection
        collection = chroma_client.get_collection("case_precedents")

        # Build where clause for filtering
        where_clause = {}
        if request.case_type:
            where_clause["case_type"] = request.case_type
        if request.outcome_filter:
            where_clause["case_outcome"] = request.outcome_filter

        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=request.top_k,
            where=where_clause if where_clause else None
        )

        # Format results
        similar_cases = []
        if results['documents']:
            for i, doc in enumerate(results['documents'][0]):
                if results['distances'][0][i] <= (1 - request.score_threshold):
                    case_metadata = results['metadatas'][0][i]

                    similar_cases.append({
                        "case_id": case_metadata.get("case_id"),
                        "similarity_score": 1 - results['distances'][0][i],
                        "case_type": case_metadata.get("case_type"),
                        "case_outcome": case_metadata.get("case_outcome"),
                        "content_preview": doc[:300] + "..." if len(doc) > 300 else doc,
                        "chunk_type": case_metadata.get("chunk_type"),
                        "financial_summary": {
                            "total_debt": case_metadata.get("total_debt_amount"),
                            "debt_reduction": case_metadata.get("debt_reduction"),
                            "case_duration": case_metadata.get("case_duration_days")
                        },
                        "closed_date": case_metadata.get("case_closed_date"),
                        "success_rating": case_metadata.get("success_rating")
                    })

        return CaseSearchResponse(
            similar_cases=similar_cases,
            query=request.query,
            total_results=len(similar_cases)
        )

    except Exception as e:
        logger.error(f"Case similarity search failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/precedents/stats")
async def get_case_precedents_stats():
    """Get statistics about the case precedents collection"""
    try:
        from main import chroma_client

        collection = chroma_client.get_collection("case_precedents")
        count = collection.count()

        # Get sample metadata for analysis
        sample = collection.get(limit=100)
        stats = {
            "total_cases": count,
            "case_types": {},
            "outcomes": {},
            "chunk_types": {}
        }

        if sample['metadatas']:
            for metadata in sample['metadatas']:
                # Count case types
                case_type = metadata.get('case_type', 'unknown')
                stats["case_types"][case_type] = stats["case_types"].get(case_type, 0) + 1

                # Count outcomes
                outcome = metadata.get('case_outcome', 'unknown')
                stats["outcomes"][outcome] = stats["outcomes"].get(outcome, 0) + 1

                # Count chunk types
                chunk_type = metadata.get('chunk_type', 'unknown')
                stats["chunk_types"][chunk_type] = stats["chunk_types"].get(chunk_type, 0) + 1

        return stats

    except Exception as e:
        logger.error(f"Failed to get case precedents stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search/by-financial-profile")
async def search_cases_by_financial_profile(
    total_debt: float,
    monthly_income: float,
    case_type: Optional[str] = None,
    top_k: int = 5
):
    """Find cases with similar financial profiles"""
    try:
        # Create a financial profile query
        debt_to_income = total_debt / (monthly_income * 12) if monthly_income > 0 else 0

        if debt_to_income < 2:
            profile_category = "low debt burden"
        elif debt_to_income < 5:
            profile_category = "moderate debt burden"
        else:
            profile_category = "high debt burden"

        query = f"Total debt £{total_debt:.0f}, monthly income £{monthly_income:.0f}, {profile_category}"

        if case_type:
            query += f", {case_type} case"

        # Use the existing similarity search
        similarity_request = CaseSimilarityRequest(
            query=query,
            case_type=case_type,
            top_k=top_k,
            score_threshold=0.5  # Lower threshold for financial similarity
        )

        return await search_similar_cases(similarity_request)

    except Exception as e:
        logger.error(f"Financial profile search failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Background processing function
async def process_closed_case_background(
    case_id: str,
    case_data: Dict[str, Any],
    case_hash: str,
    force_reprocess: bool
):
    """Background task to process closed case"""
    try:
        from main import chroma_client, embedding_service

        logger.info(f"Starting background processing of closed case {case_id}")

        # Get or create case precedents collection
        try:
            collection = chroma_client.get_collection("case_precedents")
        except Exception:
            collection = chroma_client.create_collection(
                name="case_precedents",
                metadata={"description": "Closed case precedents for similarity lookup"}
            )

        # Process case into chunks
        chunks = await case_processor.process_closed_case(case_data, case_id)

        if not chunks:
            logger.warning(f"No chunks generated for case {case_id}")
            return

        # Generate embeddings and store
        embeddings = []
        chunk_texts = []
        chunk_metadata = []
        chunk_ids = []

        for i, chunk in enumerate(chunks):
            embedding = await embedding_service.generate_embedding(chunk['text'])
            embeddings.append(embedding)
            chunk_texts.append(chunk['text'])

            # Prepare metadata
            metadata = {
                "case_id": case_id,
                "case_hash": case_hash,
                "chunk_type": chunk['metadata']['chunk_type'],
                "chunk_index": i,
                "total_chunks": len(chunks),
                "processed_at": datetime.now().isoformat(),
                "case_type": case_data.get('case_type', 'general'),
                "case_outcome": case_data.get('case_outcome'),
                "case_closed_date": case_data.get('closed_date'),
                "total_debt_amount": case_data.get('total_debt'),
                "debt_reduction": case_data.get('debt_reduction_achieved'),
                "success_rating": case_data.get('success_rating'),
                "case_duration_days": case_data.get('case_duration_days'),
                **chunk.get('metadata', {})
            }
            chunk_metadata.append(metadata)
            chunk_ids.append(f"{case_hash}_{i}")

        # Store in ChromaDB
        collection.add(
            embeddings=embeddings,
            documents=chunk_texts,
            metadatas=chunk_metadata,
            ids=chunk_ids
        )

        logger.info(f"Successfully processed case {case_id}: {len(chunks)} chunks added to vector store")

    except Exception as e:
        logger.error(f"Failed to process case {case_id} in background: {str(e)}")

# Add routes to main router
def add_case_routes(main_router):
    main_router.include_router(router)