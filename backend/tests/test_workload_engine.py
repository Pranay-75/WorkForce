"""
Unit Tests for Deterministic Workload Intelligence & Capacity Calculation Engine
File: backend/tests/test_workload_engine.py
"""

import pytest
from app.services.workload_engine import (
    calculate_single_employee_workload,
    compute_organization_workload_overview,
    compute_operational_burnout_insights,
    simulate_workload_redistribution,
    is_task_active,
)

def test_single_employee_standard_workload():
    employee = {
        "id": "emp-001",
        "full_name": "Sarah Connor",
        "email": "sarah.connor@acme.corp",
        "department": "Engineering",
        "job_title": "Engineering Lead",
        "weekly_capacity_hours": 40.0,
    }
    tasks = [
        {"id": "t1", "assigned_to": "emp-001", "estimated_hours": 10.0, "status": "in_progress", "priority": "high"},
        {"id": "t2", "assigned_to": "emp-001", "estimated_hours": 15.0, "status": "todo", "priority": "medium"},
    ]

    stats = calculate_single_employee_workload(employee, tasks)

    assert stats.employee_id == "emp-001"
    assert stats.weekly_capacity_hours == 40.0
    assert stats.current_load_hours == 25.0
    assert stats.utilization_pct == 62.5
    assert stats.remaining_capacity_hours == 15.0
    assert stats.is_overloaded is False
    assert stats.load_band == "optimal"
    assert stats.active_task_count == 2
    assert 0.0 <= stats.operational_risk_score <= 1.0

def test_employee_overloaded_detection():
    employee = {
        "id": "emp-002",
        "full_name": "David Kim",
        "weekly_capacity_hours": 40.0,
        "department": "Engineering",
    }
    tasks = [
        {"id": "t1", "assigned_to": "emp-002", "estimated_hours": 25.0, "status": "in_progress", "priority": "critical"},
        {"id": "t2", "assigned_to": "emp-002", "estimated_hours": 20.0, "status": "in_review", "priority": "high"},
    ]

    stats = calculate_single_employee_workload(employee, tasks)

    assert stats.current_load_hours == 45.0
    assert stats.utilization_pct == 112.5
    assert stats.remaining_capacity_hours == 0.0
    assert stats.is_overloaded is True
    assert stats.load_band == "overloaded"
    assert stats.operational_risk_score >= 0.85

def test_zero_capacity_boundary_conditions():
    # Scenario A: Zero capacity with zero load
    emp_zero_idle = {
        "id": "emp-idle",
        "full_name": "Consultant Inactive",
        "weekly_capacity_hours": 0.0,
    }
    stats_idle = calculate_single_employee_workload(emp_zero_idle, [])
    assert stats_idle.utilization_pct == 0.0
    assert stats_idle.is_overloaded is False
    assert stats_idle.load_band == "optimal"
    assert stats_idle.remaining_capacity_hours == 0.0

    # Scenario B: Zero capacity with assigned tasks (should flag overload safely without ZeroDivisionError)
    emp_zero_loaded = {
        "id": "emp-loaded",
        "full_name": "Consultant Loaded",
        "weekly_capacity_hours": 0.0,
    }
    tasks = [{"id": "t1", "assigned_to": "emp-loaded", "estimated_hours": 8.0, "status": "todo"}]
    stats_loaded = calculate_single_employee_workload(emp_zero_loaded, tasks)
    assert stats_loaded.current_load_hours == 8.0
    assert stats_loaded.is_overloaded is True
    assert stats_loaded.load_band == "overloaded"
    assert stats_loaded.remaining_capacity_hours == 0.0

def test_terminal_task_statuses_excluded_from_workload():
    employee = {
        "id": "emp-003",
        "full_name": "Alex Chen",
        "weekly_capacity_hours": 40.0,
    }
    tasks = [
        {"id": "t1", "assigned_to": "emp-003", "estimated_hours": 12.0, "status": "todo"},
        {"id": "t2", "assigned_to": "emp-003", "estimated_hours": 15.0, "status": "completed"},
        {"id": "t3", "assigned_to": "emp-003", "estimated_hours": 8.0, "status": "cancelled"},
        {"id": "t4", "assigned_to": "emp-003", "estimated_hours": 6.0, "status": "in_progress"},
    ]

    stats = calculate_single_employee_workload(employee, tasks)

    # Completed (15h) and Cancelled (8h) must be excluded; only t1 (12h) + t4 (6h) = 18h
    assert stats.current_load_hours == 18.0
    assert stats.active_task_count == 2
    assert stats.utilization_pct == 45.0
    assert stats.remaining_capacity_hours == 22.0

def test_missing_and_corrupt_data_resilience():
    employee = {
        "id": "emp-corrupt",
        # Missing full_name, email, weekly_capacity_hours
    }
    tasks = [
        {"id": "t1", "assigned_to": "emp-corrupt", "estimated_hours": None, "status": "todo"},
        {"id": "t2", "assigned_to": "emp-corrupt", "estimated_hours": "invalid", "status": "in_progress"},
        {"id": "t3", "assigned_to": "emp-corrupt", "estimated_hours": -10.0, "status": "todo"}, # negative guarded
        {"id": "t4", "assigned_to": "emp-corrupt", "estimated_hours": 10.0, "status": "todo"},
    ]

    stats = calculate_single_employee_workload(employee, tasks)

    assert stats.weekly_capacity_hours == 40.0 # Default fallback
    assert stats.current_load_hours == 10.0
    assert stats.full_name == "Unnamed Member"

def test_organization_workload_overview_aggregation():
    employees = [
        {"id": "e1", "full_name": "Dev One", "department": "Engineering", "weekly_capacity_hours": 40.0},
        {"id": "e2", "full_name": "Dev Two", "department": "Engineering", "weekly_capacity_hours": 40.0},
        {"id": "e3", "full_name": "Designer", "department": "Design", "weekly_capacity_hours": 30.0},
    ]
    tasks = [
        {"id": "t1", "assigned_to": "e1", "estimated_hours": 45.0, "status": "in_progress"}, # Overloaded
        {"id": "t2", "assigned_to": "e2", "estimated_hours": 20.0, "status": "todo"},
        {"id": "t3", "assigned_to": "e3", "estimated_hours": 15.0, "status": "todo"},
    ]

    overview = compute_organization_workload_overview(employees, tasks)

    assert overview.total_employees == 3
    assert overview.total_capacity_hours == 110.0 # 40 + 40 + 30
    assert overview.total_allocated_hours == 80.0 # 45 + 20 + 15
    assert overview.overloaded_count == 1
    assert len(overview.department_breakdown) == 2

    eng_dept = next(d for d in overview.department_breakdown if d.department == "Engineering")
    assert eng_dept.capacity_hours == 80.0
    assert eng_dept.allocated_hours == 65.0
    assert eng_dept.employee_count == 2

def test_operational_burnout_insights_and_disclaimer():
    employees = [
        {"id": "e1", "full_name": "High Risk Engineer", "department": "Engineering", "weekly_capacity_hours": 40.0},
        {"id": "e2", "full_name": "Balanced Engineer", "department": "Engineering", "weekly_capacity_hours": 40.0},
    ]
    tasks = [
        {"id": "t1", "assigned_to": "e1", "estimated_hours": 30.0, "priority": "critical", "status": "in_progress", "due_date": "2026-10-25"},
        {"id": "t2", "assigned_to": "e1", "estimated_hours": 18.0, "priority": "high", "status": "in_progress", "due_date": "2026-10-24"},
        {"id": "t3", "assigned_to": "e2", "estimated_hours": 10.0, "priority": "low", "status": "todo"},
    ]

    insights = compute_operational_burnout_insights(employees, tasks)

    # Disclaimer must explicitly frame metrics as operational capacity, not clinical diagnosis
    assert "operational" in insights.disclaimer.lower()
    assert "clinical" in insights.disclaimer.lower()

    # e1 (48h/40h with critical tasks) must appear in high risk list
    assert len(insights.high_risk_employees) >= 1
    high_risk_e1 = insights.high_risk_employees[0]
    assert high_risk_e1.profile_id == "e1"
    assert high_risk_e1.current_utilization_pct == 120.0
    assert high_risk_e1.high_priority_task_count == 2

def test_simulate_workload_redistribution_relief():
    employees = [
        {"id": "e_overloaded", "full_name": "Overloaded Member", "department": "Engineering", "weekly_capacity_hours": 40.0},
        {"id": "e_available", "full_name": "Available Teammate", "department": "Engineering", "weekly_capacity_hours": 40.0},
    ]
    tasks = [
        {"id": "task-big", "title": "Large Microservice Refactor", "assigned_to": "e_overloaded", "estimated_hours": 10.0, "status": "in_progress"},
        {"id": "task-base", "title": "Base Features", "assigned_to": "e_overloaded", "estimated_hours": 36.0, "status": "todo"},
        {"id": "task-other", "title": "Existing Load", "assigned_to": "e_available", "estimated_hours": 15.0, "status": "todo"},
    ]

    # e_overloaded has 46h/40h (115% utilization).
    # e_available has 15h/40h (37.5% utilization).
    redistribution = simulate_workload_redistribution(employees, tasks, target_max_utilization_pct=90.0)

    assert len(redistribution.proposals) == 1
    prop = redistribution.proposals[0]
    assert prop.source_employee.id == "e_overloaded"
    assert prop.target_employee.id == "e_available"
    assert prop.task_id == "task-big"
    assert prop.task_hours == 10.0
    # Source drops from 46h to 36h (90% capacity - no longer overloaded)
    assert prop.source_employee.projected_load == 36.0
    # Target goes from 15h to 25h (62.5% capacity - well under 90%)
    assert prop.target_employee.projected_load == 25.0
    assert redistribution.net_capacity_impact.overloaded_reduced_count == 1
