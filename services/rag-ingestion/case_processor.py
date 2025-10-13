import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import json
import hashlib

logger = logging.getLogger(__name__)

class CaseProcessor:
    """Handles processing and indexing of closed cases for precedent lookup"""

    def __init__(self):
        self.chunk_size = 800  # Smaller chunks for case data
        self.chunk_overlap = 150

    async def process_closed_case(
        self,
        case_data: Dict[str, Any],
        case_id: str
    ) -> List[Dict[str, Any]]:
        """Process a closed case and create searchable chunks"""
        try:
            # Extract case narrative and outcomes
            case_summary = self._build_case_summary(case_data)

            # Create chunks for different aspects of the case
            chunks = []

            # 1. Case overview chunk
            overview_chunk = self._create_overview_chunk(case_data, case_id)
            if overview_chunk:
                chunks.append(overview_chunk)

            # 2. Debt situation chunk
            debt_chunk = self._create_debt_situation_chunk(case_data, case_id)
            if debt_chunk:
                chunks.append(debt_chunk)

            # 3. Advice and actions chunk
            advice_chunk = self._create_advice_actions_chunk(case_data, case_id)
            if advice_chunk:
                chunks.append(advice_chunk)

            # 4. Outcome and resolution chunk
            outcome_chunk = self._create_outcome_chunk(case_data, case_id)
            if outcome_chunk:
                chunks.append(outcome_chunk)

            # 5. Case notes chunks (if substantial)
            notes_chunks = self._create_notes_chunks(case_data, case_id)
            chunks.extend(notes_chunks)

            logger.info(f"Processed case {case_id}: {len(chunks)} chunks created")
            return chunks

        except Exception as e:
            logger.error(f"Failed to process case {case_id}: {str(e)}")
            return []

    def _build_case_summary(self, case_data: Dict[str, Any]) -> str:
        """Build a comprehensive case summary for embedding"""
        summary_parts = []

        # Client situation
        if case_data.get('client_situation'):
            summary_parts.append(f"Client Situation: {case_data['client_situation']}")

        # Debt types and amounts
        if case_data.get('debt_summary'):
            summary_parts.append(f"Debt Summary: {case_data['debt_summary']}")

        # Income and expenditure
        if case_data.get('income') and case_data.get('expenditure'):
            summary_parts.append(f"Monthly Income: £{case_data['income']}, Expenditure: £{case_data['expenditure']}")

        # Case type and complexity
        if case_data.get('case_type'):
            summary_parts.append(f"Case Type: {case_data['case_type']}")

        return " | ".join(summary_parts)

    def _create_overview_chunk(self, case_data: Dict[str, Any], case_id: str) -> Optional[Dict[str, Any]]:
        """Create overview chunk with case demographics and situation"""
        overview_parts = []

        # Client demographics (anonymized)
        if case_data.get('age_range'):
            overview_parts.append(f"Client Age Range: {case_data['age_range']}")

        if case_data.get('employment_status'):
            overview_parts.append(f"Employment: {case_data['employment_status']}")

        if case_data.get('household_composition'):
            overview_parts.append(f"Household: {case_data['household_composition']}")

        # Financial overview
        if case_data.get('total_debt'):
            overview_parts.append(f"Total Debt: £{case_data['total_debt']}")

        if case_data.get('monthly_income'):
            overview_parts.append(f"Monthly Income: £{case_data['monthly_income']}")

        if case_data.get('surplus_deficit'):
            overview_parts.append(f"Monthly Surplus/Deficit: £{case_data['surplus_deficit']}")

        # Presenting issues
        if case_data.get('presenting_issues'):
            overview_parts.append(f"Presenting Issues: {case_data['presenting_issues']}")

        if not overview_parts:
            return None

        content = "CASE OVERVIEW\n" + "\n".join(overview_parts)

        return {
            'text': content,
            'metadata': {
                'chunk_type': 'overview',
                'case_type': case_data.get('case_type', 'general'),
                'complexity_level': case_data.get('complexity_level', 'standard'),
                'client_demographics': {
                    'age_range': case_data.get('age_range'),
                    'employment_status': case_data.get('employment_status')
                }
            }
        }

    def _create_debt_situation_chunk(self, case_data: Dict[str, Any], case_id: str) -> Optional[Dict[str, Any]]:
        """Create chunk focusing on debt situation and creditors"""
        debt_parts = []

        # Debt breakdown
        if case_data.get('priority_debts'):
            debt_parts.append(f"Priority Debts: {case_data['priority_debts']}")

        if case_data.get('non_priority_debts'):
            debt_parts.append(f"Non-Priority Debts: {case_data['non_priority_debts']}")

        # Creditor information
        if case_data.get('main_creditors'):
            debt_parts.append(f"Main Creditors: {', '.join(case_data['main_creditors'])}")

        # Debt history
        if case_data.get('debt_history'):
            debt_parts.append(f"Debt History: {case_data['debt_history']}")

        # Enforcement actions
        if case_data.get('enforcement_actions'):
            debt_parts.append(f"Enforcement Actions: {case_data['enforcement_actions']}")

        if not debt_parts:
            return None

        content = "DEBT SITUATION\n" + "\n".join(debt_parts)

        return {
            'text': content,
            'metadata': {
                'chunk_type': 'debt_situation',
                'total_debt_amount': case_data.get('total_debt'),
                'debt_categories': {
                    'priority': case_data.get('priority_debt_count', 0),
                    'non_priority': case_data.get('non_priority_debt_count', 0)
                }
            }
        }

    def _create_advice_actions_chunk(self, case_data: Dict[str, Any], case_id: str) -> Optional[Dict[str, Any]]:
        """Create chunk focusing on advice given and actions taken"""
        advice_parts = []

        # Advice provided
        if case_data.get('advice_summary'):
            advice_parts.append(f"Advice Provided: {case_data['advice_summary']}")

        # Options discussed
        if case_data.get('options_discussed'):
            advice_parts.append(f"Options Discussed: {', '.join(case_data['options_discussed'])}")

        # Recommended solution
        if case_data.get('recommended_solution'):
            advice_parts.append(f"Recommended Solution: {case_data['recommended_solution']}")

        # Actions taken
        if case_data.get('actions_taken'):
            advice_parts.append(f"Actions Taken: {case_data['actions_taken']}")

        # Letters sent
        if case_data.get('letters_sent'):
            advice_parts.append(f"Letters Sent: {', '.join(case_data['letters_sent'])}")

        # Referrals made
        if case_data.get('referrals_made'):
            advice_parts.append(f"Referrals Made: {', '.join(case_data['referrals_made'])}")

        if not advice_parts:
            return None

        content = "ADVICE AND ACTIONS\n" + "\n".join(advice_parts)

        return {
            'text': content,
            'metadata': {
                'chunk_type': 'advice_actions',
                'recommended_solution': case_data.get('recommended_solution'),
                'options_count': len(case_data.get('options_discussed', [])),
                'referrals_made': case_data.get('referrals_made', [])
            }
        }

    def _create_outcome_chunk(self, case_data: Dict[str, Any], case_id: str) -> Optional[Dict[str, Any]]:
        """Create chunk focusing on case outcome and resolution"""
        outcome_parts = []

        # Case outcome
        if case_data.get('case_outcome'):
            outcome_parts.append(f"Case Outcome: {case_data['case_outcome']}")

        # Resolution details
        if case_data.get('resolution_details'):
            outcome_parts.append(f"Resolution: {case_data['resolution_details']}")

        # Financial impact
        if case_data.get('debt_reduction_achieved'):
            outcome_parts.append(f"Debt Reduction Achieved: £{case_data['debt_reduction_achieved']}")

        if case_data.get('monthly_payment_reduction'):
            outcome_parts.append(f"Monthly Payment Reduction: £{case_data['monthly_payment_reduction']}")

        # Client feedback
        if case_data.get('client_satisfaction'):
            outcome_parts.append(f"Client Satisfaction: {case_data['client_satisfaction']}")

        # Follow-up actions
        if case_data.get('follow_up_required'):
            outcome_parts.append(f"Follow-up Required: {case_data['follow_up_required']}")

        if not outcome_parts:
            return None

        content = "CASE OUTCOME\n" + "\n".join(outcome_parts)

        return {
            'text': content,
            'metadata': {
                'chunk_type': 'outcome',
                'case_outcome': case_data.get('case_outcome'),
                'success_rating': case_data.get('success_rating', 'unknown'),
                'debt_reduction': case_data.get('debt_reduction_achieved'),
                'case_duration_days': case_data.get('case_duration_days')
            }
        }

    def _create_notes_chunks(self, case_data: Dict[str, Any], case_id: str) -> List[Dict[str, Any]]:
        """Create chunks from significant case notes"""
        chunks = []

        if not case_data.get('case_notes'):
            return chunks

        # Sort notes by importance/length
        significant_notes = [
            note for note in case_data['case_notes']
            if len(note.get('content', '')) > 100  # Only substantial notes
        ]

        for i, note in enumerate(significant_notes[:5]):  # Limit to 5 most significant notes
            content = f"CASE NOTE {i+1}\n"
            content += f"Date: {note.get('date', 'Unknown')}\n"
            content += f"Type: {note.get('note_type', 'General')}\n"
            content += f"Content: {note.get('content', '')}"

            chunks.append({
                'text': content,
                'metadata': {
                    'chunk_type': 'case_note',
                    'note_type': note.get('note_type', 'general'),
                    'note_date': note.get('date'),
                    'advisor_id': note.get('advisor_id')
                }
            })

        return chunks

    def generate_case_embedding_summary(self, case_data: Dict[str, Any]) -> str:
        """Generate a comprehensive summary for embedding the entire case"""
        summary_parts = []

        # Case classification
        case_type = case_data.get('case_type', 'general')
        summary_parts.append(f"Case Type: {case_type}")

        # Client situation summary
        if case_data.get('client_situation'):
            summary_parts.append(f"Situation: {case_data['client_situation']}")

        # Financial summary
        if case_data.get('total_debt') and case_data.get('monthly_income'):
            debt_to_income = float(case_data['total_debt']) / max(float(case_data['monthly_income']) * 12, 1)
            summary_parts.append(f"Total Debt: £{case_data['total_debt']}, Debt-to-Income Ratio: {debt_to_income:.1f}")

        # Solution and outcome
        if case_data.get('recommended_solution'):
            summary_parts.append(f"Solution: {case_data['recommended_solution']}")

        if case_data.get('case_outcome'):
            summary_parts.append(f"Outcome: {case_data['case_outcome']}")

        # Key advice points
        if case_data.get('advice_summary'):
            summary_parts.append(f"Advice: {case_data['advice_summary']}")

        return " | ".join(summary_parts)

    def extract_case_keywords(self, case_data: Dict[str, Any]) -> List[str]:
        """Extract relevant keywords for case categorization"""
        keywords = []

        # Debt-related keywords
        debt_keywords = ['bankruptcy', 'iva', 'dmp', 'dro', 'ccj', 'mortgage', 'rent', 'utilities']
        for keyword in debt_keywords:
            if any(keyword.lower() in str(value).lower()
                  for value in case_data.values() if isinstance(value, str)):
                keywords.append(keyword)

        # Situation keywords
        if case_data.get('employment_status'):
            keywords.append(case_data['employment_status'].lower())

        if case_data.get('case_type'):
            keywords.append(case_data['case_type'].lower())

        # Outcome keywords
        if case_data.get('case_outcome'):
            keywords.append(case_data['case_outcome'].lower())

        return list(set(keywords))[:10]  # Limit and deduplicate