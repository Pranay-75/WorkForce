"""
WorkForce - Server-Side Google Gemini Advisory Integration
File: backend/app/services/gemini_service.py

Directives:
1. API keys are kept strictly on the server (never exposed to client).
2. AI recommendations are strictly advisory and provide natural-language explainability and risk analysis.
3. Hard deterministic constraints (skill prerequisites, capacity limits, RLS permissions) are never overridden by AI.
4. Robust, immediate deterministic fallback on missing API key, timeout, rate limit, or invalid response.
"""

import json
import logging
from typing import List, Dict, Any, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-latest:generateContent"

async def enhance_recommendation_with_gemini(
    task: Dict[str, Any],
    candidate_name: str,
    matched_skills: List[str],
    missing_skills: List[str],
    current_load_hours: float,
    task_estimated_hours: float,
    projected_load_hours: float,
    weekly_capacity_hours: float,
    fallback_rationale: str,
    fallback_risk_factors: List[str],
) -> Dict[str, Any]:
    """
    Asynchronously calls Google Gemini to generate structured natural-language explainability
    and operational risk factors for candidate task matching.
    Falls back gracefully and deterministically on any failure.
    """
    api_key = settings.GEMINI_API_KEY.strip()
    if not api_key:
        return {
            "rationale": fallback_rationale,
            "risk_factors": fallback_risk_factors,
            "ai_source": "deterministic_fallback",
        }

    task_title = task.get("title", "Task")
    task_desc = task.get("description", "")
    priority = task.get("priority", "medium")

    prompt = f"""You are WorkForce AI, an operational workforce intelligence advisor.
Explain why candidate '{candidate_name}' is recommended for task '{task_title}'.

Context:
- Task: {task_title} (Priority: {priority}, Estimated Effort: {task_estimated_hours}h)
- Description: {task_desc}
- Matched Skills: {', '.join(matched_skills) if matched_skills else 'None'}
- Missing Skills: {', '.join(missing_skills) if missing_skills else 'None'}
- Workload: Current {current_load_hours}h, Projected {projected_load_hours}h / {weekly_capacity_hours}h weekly capacity

Instructions:
1. Provide a concise, professional 2-sentence rationale explaining candidate fit and capacity impact.
2. Provide a JSON array of 1-3 specific operational risk factors (e.g. overload risk, missing prerequisites, deadline pressure). If no significant risks, return an empty array [].
3. Format output strictly as valid JSON with keys "rationale" (string) and "risk_factors" (array of strings). Do not include markdown code fence formatting.
"""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.post(
                f"{GEMINI_API_URL}?key={api_key}",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            if resp.status_code == 200:
                data = resp.json()
                text_content = (
                    data.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                    .strip()
                )
                parsed = json.loads(text_content)
                rationale = str(parsed.get("rationale", "")).strip() or fallback_rationale
                risk_factors = parsed.get("risk_factors")
                if not isinstance(risk_factors, list):
                    risk_factors = fallback_risk_factors

                return {
                    "rationale": rationale,
                    "risk_factors": risk_factors,
                    "ai_source": "gemini-1.5-flash",
                }
            else:
                logger.warning("Gemini API call failed with status %d: %s", resp.status_code, resp.text)
    except Exception as exc:
        logger.warning("Gemini API call failed or timed out: %s. Using deterministic fallback.", exc)

    return {
        "rationale": fallback_rationale,
        "risk_factors": fallback_risk_factors,
        "ai_source": "deterministic_fallback",
    }
