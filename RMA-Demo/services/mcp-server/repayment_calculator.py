#!/usr/bin/env python3
"""
Repayment Schedule Calculator
Provides accurate debt repayment calculations with multiple scenarios
"""

import re
from typing import Dict, List, Optional, Tuple
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta


class RepaymentCalculator:
    """Calculate debt repayment schedules with accurate math."""

    @staticmethod
    def parse_amount(amount_str: str) -> Decimal:
        """
        Parse various amount formats into Decimal.

        Supports:
        - £10,000 / $10,000
        - 10k / 10K
        - 10000
        - 10,000.50
        """
        if isinstance(amount_str, (int, float, Decimal)):
            return Decimal(str(amount_str))

        # Remove currency symbols and whitespace
        cleaned = str(amount_str).strip().replace('£', '').replace('$', '').replace('€', '')
        cleaned = cleaned.replace(',', '').replace(' ', '')

        # Handle k/K suffix (thousands)
        if cleaned.lower().endswith('k'):
            base = Decimal(cleaned[:-1])
            return base * Decimal('1000')

        # Handle m/M suffix (millions)
        if cleaned.lower().endswith('m'):
            base = Decimal(cleaned[:-1])
            return base * Decimal('1000000')

        return Decimal(cleaned)

    @staticmethod
    def calculate_time_to_repay(
        debt_amount: str | Decimal,
        monthly_payment: str | Decimal,
        annual_interest_rate: float = 0.0
    ) -> Dict:
        """
        Calculate how long it will take to repay a debt.

        Args:
            debt_amount: Total debt (supports "61k", "£10,000", etc.)
            monthly_payment: Monthly payment amount
            annual_interest_rate: Annual interest rate (e.g., 5.5 for 5.5%)

        Returns:
            Dict with months, years, total_paid, total_interest, schedule
        """
        debt = RepaymentCalculator.parse_amount(debt_amount)
        payment = RepaymentCalculator.parse_amount(monthly_payment)

        if payment <= 0:
            return {
                "error": "Monthly payment must be greater than 0",
                "months": None,
                "years": None
            }

        monthly_rate = Decimal(str(annual_interest_rate / 100 / 12))

        if monthly_rate == 0:
            # Simple division for 0% interest
            months = int((debt / payment).quantize(Decimal('0'), rounding=ROUND_HALF_UP))
            if debt % payment > 0:
                months += 1

            return {
                "debt_amount": float(debt),
                "monthly_payment": float(payment),
                "annual_interest_rate": annual_interest_rate,
                "months": months,
                "years": round(months / 12, 2),
                "total_paid": float(debt),
                "total_interest": 0.0,
                "final_payment": float(debt % payment) if debt % payment > 0 else float(payment),
                "schedule_summary": f"{months} monthly payments of £{payment}, total £{debt}"
            }

        # Calculate with interest
        remaining = debt
        months = 0
        total_paid = Decimal('0')
        schedule = []

        while remaining > 0 and months < 1200:  # Safety limit: 100 years
            months += 1
            interest = remaining * monthly_rate
            principal = payment - interest

            if principal <= 0:
                return {
                    "error": f"Payment (£{payment}) is less than monthly interest (£{interest:.2f}). Debt will never be paid off.",
                    "months": None,
                    "years": None
                }

            if remaining <= payment:
                # Final payment
                final_payment = remaining + interest
                total_paid += final_payment
                remaining = Decimal('0')
                schedule.append({
                    "month": months,
                    "payment": float(final_payment.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)),
                    "principal": float(remaining),
                    "interest": float(interest.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)),
                    "remaining": 0.0
                })
            else:
                remaining -= principal
                total_paid += payment
                schedule.append({
                    "month": months,
                    "payment": float(payment),
                    "principal": float(principal.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)),
                    "interest": float(interest.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)),
                    "remaining": float(remaining.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))
                })

        total_interest = total_paid - debt

        return {
            "debt_amount": float(debt),
            "monthly_payment": float(payment),
            "annual_interest_rate": annual_interest_rate,
            "months": months,
            "years": round(months / 12, 2),
            "total_paid": float(total_paid.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)),
            "total_interest": float(total_interest.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)),
            "final_payment": schedule[-1]["payment"] if schedule else 0.0,
            "schedule_summary": f"{months} months ({round(months/12, 1)} years), total paid £{total_paid:.2f} (interest: £{total_interest:.2f})",
            "first_6_months": schedule[:6],
            "last_6_months": schedule[-6:] if len(schedule) > 6 else []
        }

    @staticmethod
    def calculate_monthly_payment(
        debt_amount: str | Decimal,
        target_months: int,
        annual_interest_rate: float = 0.0
    ) -> Dict:
        """
        Calculate required monthly payment to pay off debt in target months.

        Args:
            debt_amount: Total debt
            target_months: Desired repayment period in months
            annual_interest_rate: Annual interest rate (e.g., 5.5 for 5.5%)

        Returns:
            Dict with monthly_payment, total_paid, total_interest
        """
        debt = RepaymentCalculator.parse_amount(debt_amount)
        monthly_rate = Decimal(str(annual_interest_rate / 100 / 12))

        if monthly_rate == 0:
            # Simple division for 0% interest
            monthly_payment = debt / Decimal(target_months)
            return {
                "debt_amount": float(debt),
                "target_months": target_months,
                "annual_interest_rate": annual_interest_rate,
                "monthly_payment": float(monthly_payment.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)),
                "total_paid": float(debt),
                "total_interest": 0.0,
                "summary": f"£{monthly_payment:.2f}/month for {target_months} months, total £{debt}"
            }

        # Calculate payment with interest using amortization formula
        # PMT = P * (r * (1 + r)^n) / ((1 + r)^n - 1)
        r = monthly_rate
        n = Decimal(target_months)

        numerator = debt * r * ((1 + r) ** n)
        denominator = ((1 + r) ** n) - 1

        if denominator == 0:
            monthly_payment = debt / n
        else:
            monthly_payment = numerator / denominator

        total_paid = monthly_payment * n
        total_interest = total_paid - debt

        return {
            "debt_amount": float(debt),
            "target_months": target_months,
            "target_years": round(target_months / 12, 2),
            "annual_interest_rate": annual_interest_rate,
            "monthly_payment": float(monthly_payment.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)),
            "total_paid": float(total_paid.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)),
            "total_interest": float(total_interest.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)),
            "summary": f"£{monthly_payment:.2f}/month for {target_months} months ({target_months/12:.1f} years), total £{total_paid:.2f} (interest: £{total_interest:.2f})"
        }

    @staticmethod
    def calculate_surplus_scenarios(
        total_debt: str | Decimal,
        monthly_surplus: str | Decimal,
        annual_interest_rate: float = 0.0
    ) -> Dict:
        """
        Calculate multiple repayment scenarios based on surplus income.

        Provides:
        - Full surplus applied to debt
        - 75% of surplus (25% emergency savings)
        - 50% of surplus (50% savings/investments)

        Args:
            total_debt: Total debt amount
            monthly_surplus: Monthly surplus income available
            annual_interest_rate: Annual interest rate

        Returns:
            Dict with multiple scenarios
        """
        debt = RepaymentCalculator.parse_amount(total_debt)
        surplus = RepaymentCalculator.parse_amount(monthly_surplus)

        scenarios = {}

        for percentage in [100, 75, 50]:
            payment = surplus * Decimal(percentage) / Decimal(100)
            scenario = RepaymentCalculator.calculate_time_to_repay(
                debt, payment, annual_interest_rate
            )

            if "error" not in scenario:
                scenario["percentage_of_surplus"] = percentage
                scenario["amount_to_savings"] = float((surplus - payment).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))

            scenarios[f"{percentage}percent_to_debt"] = scenario

        return {
            "total_debt": float(debt),
            "monthly_surplus": float(surplus),
            "annual_interest_rate": annual_interest_rate,
            "scenarios": scenarios,
            "recommendation": RepaymentCalculator._recommend_scenario(scenarios, surplus)
        }

    @staticmethod
    def _recommend_scenario(scenarios: Dict, surplus: Decimal) -> str:
        """Provide a recommendation based on scenarios."""
        if surplus < Decimal('200'):
            return "With limited surplus, consider 100% to debt to clear it quickly and reduce stress."
        elif surplus < Decimal('500'):
            return "75% to debt recommended - balance debt clearance with building emergency savings."
        else:
            return "50% to debt recommended - you have room to both clear debt and build financial resilience."

    @staticmethod
    def compare_debt_solutions(
        total_debt: str | Decimal,
        monthly_surplus: str | Decimal,
        assets_value: str | Decimal = "0"
    ) -> Dict:
        """
        Compare different debt solution approaches.

        Compares:
        - Debt Management Plan (DMP)
        - Individual Voluntary Arrangement (IVA)
        - Debt Relief Order (DRO) - if eligible
        - Bankruptcy - if eligible
        - Standard repayment

        Args:
            total_debt: Total unsecured debt
            monthly_surplus: Monthly surplus income
            assets_value: Value of non-exempt assets

        Returns:
            Comparison of solutions with eligibility and timelines
        """
        debt = RepaymentCalculator.parse_amount(total_debt)
        surplus = RepaymentCalculator.parse_amount(monthly_surplus)
        assets = RepaymentCalculator.parse_amount(assets_value)

        solutions = {}

        # Standard repayment
        if surplus > 0:
            standard = RepaymentCalculator.calculate_time_to_repay(debt, surplus, 0)
            solutions["standard_repayment"] = {
                **standard,
                "name": "Standard Repayment",
                "pros": ["No fees", "No credit impact beyond existing debts", "Full control"],
                "cons": ["Longest timeline", "Creditors may not freeze interest"],
                "eligible": True
            }

        # DRO eligibility
        dro_eligible = (debt <= Decimal('30000') and
                       surplus <= Decimal('75') and
                       assets <= Decimal('2000'))

        if dro_eligible:
            solutions["dro"] = {
                "name": "Debt Relief Order (DRO)",
                "months": 12,
                "years": 1.0,
                "total_paid": 90.0,  # £90 fee
                "debt_written_off": float(debt),
                "pros": ["Debts written off after 12 months", "Very low cost (£90)", "No payments to creditors"],
                "cons": ["Credit rating impact (6 years)", "Asset restrictions", "Income restrictions"],
                "eligible": True,
                "recommendation": "HIGHLY RECOMMENDED - you meet all criteria"
            }

        # IVA eligibility
        iva_eligible = debt >= Decimal('6000') and surplus >= Decimal('100')

        if iva_eligible:
            # Typical IVA is 5-6 years
            iva_months = 60  # 5 years
            total_iva_payments = surplus * Decimal(iva_months)
            debt_written_off = debt - total_iva_payments

            solutions["iva"] = {
                "name": "Individual Voluntary Arrangement (IVA)",
                "months": iva_months,
                "years": 5.0,
                "monthly_payment": float(surplus),
                "total_paid": float(total_iva_payments),
                "debt_written_off": float(debt_written_off) if debt_written_off > 0 else 0.0,
                "percentage_repaid": float((total_iva_payments / debt * 100).quantize(Decimal('0.1'))),
                "pros": ["Fixed 5-year term", "Remaining debt written off", "Interest frozen", "Legal protection"],
                "cons": ["Credit rating impact (6 years)", "Fees (~£5000-7000)", "Strict budgeting", "May affect homeownership"],
                "eligible": True,
                "recommendation": "GOOD OPTION if you want protection and can commit to 5 years" if debt_written_off > total_iva_payments * Decimal('0.3') else "Consider if standard repayment is too long"
            }

        # Bankruptcy eligibility
        bankruptcy_eligible = debt >= Decimal('5000')

        if bankruptcy_eligible:
            bankruptcy_months = 12  # Typically discharged after 12 months
            bankruptcy_payments = min(surplus * Decimal(36), debt)  # Up to 3 years of contributions

            solutions["bankruptcy"] = {
                "name": "Bankruptcy",
                "months": bankruptcy_months,
                "years": 1.0,
                "total_paid": float(Decimal('680') + bankruptcy_payments),  # £680 fee + contributions
                "debt_written_off": float(debt - bankruptcy_payments),
                "pros": ["Debts written off quickly", "Fresh start after 12 months", "Legal protection"],
                "cons": ["Severe credit impact (6 years)", "May lose assets", "Affects employment", "Public record", "High cost (£680 + contributions)"],
                "eligible": True,
                "recommendation": "LAST RESORT - only if other options not viable"
            }

        return {
            "total_debt": float(debt),
            "monthly_surplus": float(surplus),
            "assets_value": float(assets),
            "solutions": solutions,
            "recommended_solution": RepaymentCalculator._recommend_solution(solutions, debt, surplus, assets)
        }

    @staticmethod
    def _recommend_solution(solutions: Dict, debt: Decimal, surplus: Decimal, assets: Decimal) -> str:
        """Recommend the best solution based on circumstances."""
        if "dro" in solutions:
            return "DRO - You meet all eligibility criteria for debt write-off in 12 months with minimal cost"
        elif "iva" in solutions and solutions["iva"].get("debt_written_off", 0) > 10000:
            return "IVA - Significant debt write-off with manageable monthly payments over 5 years"
        elif surplus > debt / Decimal(36):  # Can pay off in <3 years
            return "Standard Repayment - Debt can be cleared in under 3 years, avoiding formal solutions"
        elif "iva" in solutions:
            return "IVA - Provides structure and debt reduction over 5 years"
        else:
            return "Seek professional debt advice - your situation may benefit from expert guidance"


# Tool definitions for MCP
def get_repayment_tool_definitions() -> List[Dict]:
    """Get MCP tool definitions for repayment calculator."""
    return [
        {
            "name": "calculate_time_to_repay",
            "description": "Calculate how long it will take to repay a debt given monthly payment. Handles formats like '61k', '£10,000'. ALWAYS use this instead of manual math.",
            "parameters": {
                "debt_amount": {"type": "string", "description": "Total debt (supports '61k', '£10,000', etc.)"},
                "monthly_payment": {"type": "string", "description": "Monthly payment amount"},
                "annual_interest_rate": {"type": "number", "description": "Annual interest rate % (default: 0)", "default": 0.0}
            }
        },
        {
            "name": "calculate_monthly_payment",
            "description": "Calculate required monthly payment to pay off debt in target timeframe. Use this when client asks 'how much per month?'",
            "parameters": {
                "debt_amount": {"type": "string", "description": "Total debt"},
                "target_months": {"type": "integer", "description": "Desired months to pay off"},
                "annual_interest_rate": {"type": "number", "description": "Annual interest rate % (default: 0)", "default": 0.0}
            }
        },
        {
            "name": "calculate_surplus_scenarios",
            "description": "Calculate multiple scenarios based on surplus income (100%, 75%, 50% allocation to debt). Shows trade-offs between debt repayment and savings.",
            "parameters": {
                "total_debt": {"type": "string", "description": "Total debt amount"},
                "monthly_surplus": {"type": "string", "description": "Monthly surplus income"},
                "annual_interest_rate": {"type": "number", "description": "Annual interest rate % (default: 0)", "default": 0.0}
            }
        },
        {
            "name": "compare_debt_solutions",
            "description": "Compare DRO, IVA, Bankruptcy, and standard repayment. Shows eligibility, timelines, costs, and recommendations.",
            "parameters": {
                "total_debt": {"type": "string", "description": "Total unsecured debt"},
                "monthly_surplus": {"type": "string", "description": "Monthly surplus income"},
                "assets_value": {"type": "string", "description": "Value of non-exempt assets (default: 0)", "default": "0"}
            }
        }
    ]
