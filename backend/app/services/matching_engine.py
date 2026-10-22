"""
WorkForce - Deterministic Skill-Based Task Matching Engine
File: backend/app/services/matching_engine.py

Responsibilities:
1. Deterministic candidate skill overlap and proficiency tier evaluation.
2. Capacity headroom and workload impact modeling.
3. Composite match scoring (reproducible and explainable).
4. Identification of operational risk factors (overload, deadline proximity, skill gaps).
5. Clear, actionable no-match result handling when no eligible candidates exist.
"""

from typing import List, Dict, Any, Optional, Tuple
from app.models.schemas import (
    SkillLevelEnum,
    MatchedSkillDetail,
    SkillMatchBreakdown,
    WorkloadImpactSchema,
    CandidateRecommendation,
    TaskMatchResponse,
)
from app.services.workload_engine import calculate_single_employee_workload

PROFICIENCY_WEIGHTS: Dict[str, int] = {
    SkillLevelEnum.BEGINNER.value: 1,
    SkillLevelEnum.INTERMEDIATE.value: 2,
    SkillLevelEnum.ADVANCED.value: 3,
    SkillLevelEnum.EXPERT.value: 4,
    "beginner": 1,
    "intermediate": 2,
    "advanced": 3,
    "expert": 4,
}

def normalize_skill_name(name: str) -> str:
    """Normalizes skill identifiers for case-insensitive matching."""
    return name.strip().lower()

def evaluate_candidate_skills(
    candidate_skills: List[Dict[str, Any]],
    required_skills: List[Dict[str, Any]],
) -> SkillMatchBreakdown:
    """
    Evaluates a candidate's skill inventory against a task's skill prerequisites.
    Returns matched skills with proficiency tiers, missing skills, and a composite skill score (0-100).
    """
    if not required_skills:
        return SkillMatchBreakdown(
            matched_skills=[],
            missing_skills=[],
            skill_score=100.0,
        )

    # Index candidate skills by normalized name
    cand_skill_map: Dict[str, Dict[str, Any]] = {}
    for cs in candidate_skills:
        name = cs.get("skillName") or cs.get("skill_name") or cs.get("name") or ""
        if name:
            cand_skill_map[normalize_skill_name(name)] = cs

    matched_details: List[MatchedSkillDetail] = []
    missing_skills: List[str] = []
    total_skill_points = 0.0

    for req in required_skills:
        req_name = req.get("skillName") or req.get("skill_name") or req.get("name") or "Unknown"
        raw_req_level = req.get("minProficiency") or req.get("min_proficiency") or "intermediate"
        try:
            req_enum = SkillLevelEnum(str(raw_req_level).lower())
        except ValueError:
            req_enum = SkillLevelEnum.INTERMEDIATE

        norm_name = normalize_skill_name(req_name)
        req_weight = PROFICIENCY_WEIGHTS.get(req_enum.value, 2)

        if norm_name in cand_skill_map:
            cs = cand_skill_map[norm_name]
            raw_cand_level = cs.get("proficiency") or cs.get("level") or "intermediate"
            try:
                cand_enum = SkillLevelEnum(str(raw_cand_level).lower())
            except ValueError:
                cand_enum = SkillLevelEnum.INTERMEDIATE

            cand_weight = PROFICIENCY_WEIGHTS.get(cand_enum.value, 2)
            meets_req = cand_weight >= req_weight

            # Calculate proficiency match ratio
            if meets_req:
                # Full score + slight bonus for exceeding prerequisite (up to 1.1x)
                bonus = min(0.1, (cand_weight - req_weight) * 0.05)
                points = 1.0 + bonus
            else:
                # Partial score for having skill but at lower proficiency
                points = (cand_weight / req_weight) * 0.65

            total_skill_points += points
            matched_details.append(
                MatchedSkillDetail(
                    skill=req_name,
                    required_level=req_enum,
                    candidate_level=cand_enum,
                    meets_requirement=meets_req,
                )
            )
        else:
            missing_skills.append(req_name)

    total_requirements = len(required_skills)
    skill_score = round(min(100.0, (total_skill_points / total_requirements) * 100.0), 1)

    return SkillMatchBreakdown(
        matched_skills=matched_details,
        missing_skills=missing_skills,
        skill_score=skill_score,
    )

def evaluate_workload_impact(
    candidate: Dict[str, Any],
    all_tasks: List[Dict[str, Any]],
    task_estimated_hours: float,
) -> WorkloadImpactSchema:
    """
    Simulates the workload impact of assigning the task to the candidate.
    """
    stats = calculate_single_employee_workload(candidate, all_tasks)
    current_load = stats.current_load_hours
    capacity = stats.weekly_capacity_hours
    task_hours = max(0.0, task_estimated_hours)
    projected_load = round(current_load + task_hours, 2)

    if capacity > 0:
        projected_util = round((projected_load / capacity) * 100.0, 1)
        is_overloaded = projected_load > capacity
    else:
        projected_util = 100.0 if projected_load > 0 else 0.0
        is_overloaded = projected_load > 0

    return WorkloadImpactSchema(
        current_load_hours=current_load,
        task_estimated_hours=task_hours,
        projected_load_hours=projected_load,
        weekly_capacity_hours=capacity,
        projected_utilization_pct=projected_util,
        is_projected_overloaded=is_overloaded,
    )

def compute_capacity_score(impact: WorkloadImpactSchema) -> float:
    """
    Calculates capacity score (0-100) based on projected utilization.
    - Optimal range (60% - 85%): 90 - 100 points
    - Under-utilized (< 60%): 80 - 95 points (readily absorbs task)
    - Near limit (85% - 100%): 50 - 75 points
    - Overloaded (> 100%): severely penalized (0 - 30 points)
    """
    util = impact.projected_utilization_pct
    if util <= 0:
        return 90.0
    elif util <= 60.0:
        # Generous headroom
        return 85.0 + (util / 60.0) * 10.0
    elif util <= 85.0:
        # Sweet spot
        return 95.0 + ((85.0 - util) / 25.0) * 5.0
    elif util <= 100.0:
        # High load, buffer shrinking
        return max(40.0, 80.0 - (util - 85.0) * 2.5)
    else:
        # Overloaded: steep penalty
        overage = util - 100.0
        return max(5.0, 35.0 - overage * 2.0)

def generate_deterministic_rationale(
    candidate_name: str,
    skill_breakdown: SkillMatchBreakdown,
    impact: WorkloadImpactSchema,
    risk_factors: List[str],
) -> str:
    """
    Synthesizes a transparent, explainable natural-language rationale
    documenting exactly why a candidate received their score.
    """
    parts = []
    matched_count = len(skill_breakdown.matched_skills)
    missing_count = len(skill_breakdown.missing_skills)

    if missing_count == 0 and matched_count > 0:
        skills_summary = ", ".join(f"{m.skill} ({m.candidate_level.value})" for m in skill_breakdown.matched_skills)
        parts.append(f"{candidate_name} satisfies all required skills with {skills_summary}.")
    elif matched_count > 0:
        matched_str = ", ".join(m.skill for m in skill_breakdown.matched_skills)
        missing_str = ", ".join(skill_breakdown.missing_skills)
        parts.append(f"{candidate_name} matches {matched_str}, but lacks prerequisites for {missing_str}.")
    else:
        parts.append(f"{candidate_name} does not currently list the required skill prerequisites.")

    # Workload summary
    if not impact.is_projected_overloaded:
        parts.append(
            f"Absorbing this {impact.task_estimated_hours:.1f}h deliverable brings weekly utilization "
            f"from {impact.current_load_hours:.1f}h to {impact.projected_load_hours:.1f}h "
            f"({impact.projected_utilization_pct:.1f}% capacity), maintaining safe workload limits."
        )
    else:
        parts.append(
            f"Warning: Assigning this {impact.task_estimated_hours:.1f}h deliverable would push total load "
            f"to {impact.projected_load_hours:.1f}h ({impact.projected_utilization_pct:.1f}%), exceeding capacity limit."
        )

    return " ".join(parts)

def match_candidates_for_task(
    task: Dict[str, Any],
    candidates: List[Dict[str, Any]],
    all_tasks: List[Dict[str, Any]],
    max_candidates: int = 5,
    allow_overloaded_recommendation: bool = False,
) -> TaskMatchResponse:
    """
    Evaluates all eligible candidates for a task.
    Combines deterministic skill scoring, workload impact simulation, and risk analysis.
    Returns ranked candidate recommendations and explicit no-match handling.
    """
    task_id = str(task.get("id", ""))
    task_title = str(task.get("title", "Untitled Task"))
    raw_effort = task.get("estimated_hours")
    try:
        estimated_hours = float(raw_effort) if raw_effort is not None else 0.0
    except (ValueError, TypeError):
        estimated_hours = 0.0

    raw_required_skills = task.get("required_skills") or []
    if isinstance(raw_required_skills, dict):
        required_skills = [raw_required_skills]
    elif isinstance(raw_required_skills, list):
        required_skills = raw_required_skills
    else:
        required_skills = []

    recommendations: List[CandidateRecommendation] = []
    total_evaluated = len(candidates)

    for cand in candidates:
        cand_id = str(cand.get("id", ""))
        cand_name = str(cand.get("full_name") or cand.get("name") or "Unnamed Member")
        cand_title = str(cand.get("job_title", "Software Engineer"))
        cand_dept = str(cand.get("department", "Engineering"))
        cand_avatar = cand.get("avatar_url")

        # Candidate skills
        cand_skills = cand.get("skills") or []

        # 1. Skill evaluation
        skill_breakdown = evaluate_candidate_skills(cand_skills, required_skills)

        # 2. Workload impact evaluation
        impact = evaluate_workload_impact(cand, all_tasks, estimated_hours)

        # 3. Risk factor analysis
        risks: List[str] = []
        if impact.is_projected_overloaded:
            risks.append(
                f"Projected load ({impact.projected_load_hours:.1f}h) exceeds weekly capacity ({impact.weekly_capacity_hours:.1f}h) by {impact.projected_load_hours - impact.weekly_capacity_hours:.1f}h."
            )
        if skill_breakdown.missing_skills:
            risks.append(f"Missing required prerequisites: {', '.join(skill_breakdown.missing_skills)}.")

        # Check existing active critical tasks
        active_critical = [
            t for t in all_tasks
            if str(t.get("assigned_to", "")) == cand_id
            and str(t.get("priority", "")).lower() in ("high", "critical")
            and str(t.get("status", "")).lower() not in ("completed", "cancelled")
        ]
        if len(active_critical) >= 2:
            risks.append(f"Candidate currently manages {len(active_critical)} high/critical priority deliverables.")

        # 4. Composite Scoring: 60% Skill Match, 40% Capacity Fit
        cap_score = compute_capacity_score(impact)
        raw_score = (skill_breakdown.skill_score * 0.60) + (cap_score * 0.40)

        # Severe penalty if missing critical skills
        if skill_breakdown.missing_skills:
            penalty = len(skill_breakdown.missing_skills) * 15.0
            raw_score = max(5.0, raw_score - penalty)

        match_score = round(min(100.0, max(0.0, raw_score)), 1)

        # Eligibility determination:
        # Candidate must have > 0 skill overlap (if skills required) and not be disqualifyingly overloaded
        is_eligible = True
        if required_skills and len(skill_breakdown.matched_skills) == 0:
            is_eligible = False
        if impact.is_projected_overloaded and not allow_overloaded_recommendation:
            # Overloaded candidates can be listed with low ranking, but flagged
            is_eligible = impact.projected_utilization_pct <= 125.0

        rationale = generate_deterministic_rationale(cand_name, skill_breakdown, impact, risks)

        rec = CandidateRecommendation(
            candidate_id=cand_id,
            candidate_name=cand_name,
            candidate_title=cand_title,
            candidate_department=cand_dept,
            candidate_avatar=cand_avatar,
            match_score=match_score,
            is_eligible=is_eligible,
            skill_match_breakdown=skill_breakdown,
            workload_impact=impact,
            rationale=rationale,
            risk_factors=risks,
        )
        recommendations.append(rec)

    # Sort recommendations: highest match score first, with eligible candidates prioritized
    recommendations.sort(key=lambda r: (r.is_eligible, r.match_score), reverse=True)

    # Filter to eligible or top candidates
    eligible_count = sum(1 for r in recommendations if r.is_eligible and r.match_score >= 40.0)
    top_recommendations = recommendations[:max_candidates]

    no_match_reason: Optional[str] = None
    if eligible_count == 0:
        required_skill_names = [r.get("skillName") or r.get("name") or "Skill" for r in required_skills]
        skills_str = ", ".join(required_skill_names) if required_skill_names else "general criteria"
        no_match_reason = (
            f"No eligible candidates match required skills [{skills_str}] with available capacity headroom. "
            "All evaluated members either lack necessary proficiency levels or exceed maximum workload thresholds."
        )

    return TaskMatchResponse(
        task_id=task_id,
        task_title=task_title,
        recommendations=top_recommendations,
        total_candidates_evaluated=total_evaluated,
        eligible_candidate_count=eligible_count,
        no_match_reason=no_match_reason,
    )
