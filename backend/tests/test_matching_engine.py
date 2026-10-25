"""
Unit Tests for Deterministic Skill-Based Matching Engine
File: backend/tests/test_matching_engine.py
"""

import pytest
from app.services.matching_engine import (
    evaluate_candidate_skills,
    evaluate_workload_impact,
    compute_capacity_score,
    match_candidates_for_task,
)
from app.models.schemas import SkillLevelEnum

def test_exact_skill_match_with_optimal_capacity():
    candidate_skills = [
        {"skillName": "React", "proficiency": "expert"},
        {"skillName": "TypeScript", "proficiency": "advanced"},
    ]
    required_skills = [
        {"skillName": "React", "minProficiency": "advanced"},
        {"skillName": "TypeScript", "minProficiency": "intermediate"},
    ]

    breakdown = evaluate_candidate_skills(candidate_skills, required_skills)

    assert breakdown.skill_score == 100.0
    assert len(breakdown.matched_skills) == 2
    assert len(breakdown.missing_skills) == 0
    assert all(m.meets_requirement for m in breakdown.matched_skills)

def test_lower_proficiency_partial_score():
    candidate_skills = [
        {"skillName": "Python", "proficiency": "beginner"}, # Required: advanced
    ]
    required_skills = [
        {"skillName": "Python", "minProficiency": "advanced"},
    ]

    breakdown = evaluate_candidate_skills(candidate_skills, required_skills)

    assert breakdown.skill_score < 100.0
    assert len(breakdown.matched_skills) == 1
    assert breakdown.matched_skills[0].meets_requirement is False
    assert breakdown.matched_skills[0].candidate_level == SkillLevelEnum.BEGINNER

def test_missing_skills_reported():
    candidate_skills = [
        {"skillName": "React", "proficiency": "advanced"},
    ]
    required_skills = [
        {"skillName": "React", "minProficiency": "advanced"},
        {"skillName": "PostgreSQL", "minProficiency": "intermediate"},
    ]

    breakdown = evaluate_candidate_skills(candidate_skills, required_skills)

    assert len(breakdown.missing_skills) == 1
    assert "PostgreSQL" in breakdown.missing_skills
    assert breakdown.skill_score < 100.0

def test_workload_impact_headroom_and_overload_flag():
    candidate = {
        "id": "cand-01",
        "full_name": "Priya Patel",
        "weekly_capacity_hours": 40.0,
    }
    all_tasks = [
        {"id": "t1", "assigned_to": "cand-01", "estimated_hours": 20.0, "status": "in_progress"},
    ]

    # Task is 10 hours -> projected load 30h/40h (75%)
    impact = evaluate_workload_impact(candidate, all_tasks, task_estimated_hours=10.0)
    assert impact.current_load_hours == 20.0
    assert impact.projected_load_hours == 30.0
    assert impact.projected_utilization_pct == 75.0
    assert impact.is_projected_overloaded is False

    cap_score = compute_capacity_score(impact)
    assert cap_score >= 85.0 # Optimal zone

def test_match_candidates_ranking_and_explanation():
    task = {
        "id": "task-match-1",
        "title": "Build Webhook Gateway",
        "estimated_hours": 8.0,
        "required_skills": [
            {"skillName": "Python", "minProficiency": "advanced"},
            {"skillName": "FastAPI", "minProficiency": "intermediate"},
        ],
    }

    candidates = [
        {
            "id": "cand-best",
            "full_name": "Sarah Connor",
            "weekly_capacity_hours": 40.0,
            "skills": [
                {"skillName": "Python", "proficiency": "expert"},
                {"skillName": "FastAPI", "proficiency": "advanced"},
            ],
        },
        {
            "id": "cand-overloaded",
            "full_name": "David Kim",
            "weekly_capacity_hours": 40.0,
            "skills": [
                {"skillName": "Python", "proficiency": "expert"},
                {"skillName": "FastAPI", "proficiency": "advanced"},
            ],
        },
        {
            "id": "cand-noskills",
            "full_name": "Alex Chen",
            "weekly_capacity_hours": 40.0,
            "skills": [
                {"skillName": "React", "proficiency": "expert"},
            ],
        },
    ]

    all_tasks = [
        # David Kim already has 38 hours assigned -> assigning 8h will push to 46h (overloaded)
        {"id": "t-dk-1", "assigned_to": "cand-overloaded", "estimated_hours": 38.0, "status": "in_progress"},
        # Sarah Connor only has 16 hours assigned -> 16 + 8 = 24h (60%)
        {"id": "t-sc-1", "assigned_to": "cand-best", "estimated_hours": 16.0, "status": "in_progress"},
    ]

    response = match_candidates_for_task(task, candidates, all_tasks, max_candidates=5)

    assert response.total_candidates_evaluated == 3
    assert response.eligible_candidate_count >= 1
    assert response.no_match_reason is None

    # Sarah Connor must be top candidate
    top = response.recommendations[0]
    assert top.candidate_id == "cand-best"
    assert top.match_score >= 90.0
    assert top.is_eligible is True
    assert "Sarah Connor satisfies all required skills" in top.rationale

    # David Kim must have overload risk factor
    dk = next(r for r in response.recommendations if r.candidate_id == "cand-overloaded")
    assert dk.workload_impact.is_projected_overloaded is True
    assert any("exceeds weekly capacity" in risk for risk in dk.risk_factors)

def test_no_match_result_when_no_candidate_eligible():
    task = {
        "id": "task-niche",
        "title": "Quantum Cryptography Audit",
        "estimated_hours": 12.0,
        "required_skills": [
            {"skillName": "QuantumComputing", "minProficiency": "expert"},
            {"skillName": "Qiskit", "minProficiency": "advanced"},
        ],
    }

    candidates = [
        {
            "id": "cand-1",
            "full_name": "Standard Dev",
            "weekly_capacity_hours": 40.0,
            "skills": [{"skillName": "HTML", "proficiency": "expert"}],
        }
    ]

    response = match_candidates_for_task(task, candidates, [], max_candidates=5)

    assert response.eligible_candidate_count == 0
    assert response.no_match_reason is not None
    assert "No eligible candidates match required skills" in response.no_match_reason
