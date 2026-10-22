"""
WorkForce - Deterministic Workload Intelligence & Capacity Calculation Engine
File: backend/app/services/workload_engine.py

Responsibilities:
1. Deterministic capacity, allocated workload, utilization percentage, and remaining capacity calculations.
2. Robust boundary conditions (zero capacity, negative values, missing data, completed/cancelled exclusions).
3. Operational workload risk scoring (burnout risk indicator) framed transparently as operational metrics.
4. Departmental aggregation and organizational workload overview generation.
5. Workload redistribution simulation to resolve operational bottlenecks.
"""

from typing import List, Dict, Any, Optional, Tuple
from app.models.schemas import (
    EmployeeWorkloadStats,
    DepartmentWorkloadBreakdown,
    OrganizationWorkloadOverview,
    OperationalBurnoutRiskItem,
    OperationalBurnoutRiskResponse,
    WorkloadRedistributionProposalSchema,
    RedistributionEmployeeInfo,
    NetCapacityImpactSchema,
    WorkloadRedistributionResponse,
    TaskStatusEnum,
    PriorityLevelEnum,
)

# Terminal task statuses that release employee capacity
TERMINAL_STATUSES = {
    TaskStatusEnum.COMPLETED.value,
    TaskStatusEnum.CANCELLED.value,
    "completed",
    "cancelled",
}

def is_task_active(task: Dict[str, Any]) -> bool:
    """
    Determines if a task represents an active workload obligation.
    Terminal statuses (completed, cancelled) are excluded.
    """
    status = str(task.get("status", "")).lower()
    return status not in TERMINAL_STATUSES

def calculate_single_employee_workload(
    employee: Dict[str, Any],
    assigned_tasks: List[Dict[str, Any]],
) -> EmployeeWorkloadStats:
    """
    Computes deterministic workload metrics for an individual employee.

    Formulas:
    - current_load_hours = sum(task.estimated_hours for task in assigned_tasks if active)
    - utilization_pct = (current_load_hours / weekly_capacity_hours) * 100 (if capacity > 0)
    - remaining_capacity_hours = max(0.0, weekly_capacity_hours - current_load_hours)
    - is_overloaded = current_load_hours > weekly_capacity_hours or (capacity == 0 and load > 0)
    - load_band:
        * 'overloaded': utilization_pct > 100.0 or (capacity == 0 and load > 0)
        * 'near_limit': 80.0 <= utilization_pct <= 100.0
        * 'optimal': utilization_pct < 80.0
    """
    emp_id = str(employee.get("id", ""))
    full_name = str(employee.get("full_name") or employee.get("name") or "Unnamed Member")
    email = str(employee.get("email", ""))
    department = str(employee.get("department", "Engineering"))
    job_title = str(employee.get("job_title", "Software Engineer"))
    avatar_url = employee.get("avatar_url")

    # Safe capacity extraction with boundary enforcement
    raw_capacity = employee.get("weekly_capacity_hours")
    if raw_capacity is None:
        weekly_capacity = 40.0
    else:
        try:
            weekly_capacity = max(0.0, float(raw_capacity))
        except (ValueError, TypeError):
            weekly_capacity = 40.0

    # Filter active tasks for this specific employee
    active_tasks = [
        t for t in assigned_tasks
        if str(t.get("assigned_to", "")) == emp_id and is_task_active(t)
    ]

    # Calculate current load hours safely
    current_load_hours = 0.0
    critical_task_count = 0
    for t in active_tasks:
        raw_hours = t.get("estimated_hours")
        try:
            hours = max(0.0, float(raw_hours)) if raw_hours is not None else 0.0
        except (ValueError, TypeError):
            hours = 0.0
        current_load_hours += hours

        # Track priority for risk calculation
        priority = str(t.get("priority", "")).lower()
        if priority in ("high", "critical"):
            critical_task_count += 1

    current_load_hours = round(current_load_hours, 2)
    active_task_count = len(active_tasks)

    # Utilization Percentage & Overload Detection
    if weekly_capacity <= 0.0:
        if current_load_hours > 0.0:
            utilization_pct = 100.0
            is_overloaded = True
            load_band = "overloaded"
        else:
            utilization_pct = 0.0
            is_overloaded = False
            load_band = "optimal"
        remaining_capacity = 0.0
    else:
        utilization_pct = round((current_load_hours / weekly_capacity) * 100.0, 2)
        remaining_capacity = round(max(0.0, weekly_capacity - current_load_hours), 2)
        is_overloaded = current_load_hours > weekly_capacity
        if is_overloaded:
            load_band = "overloaded"
        elif utilization_pct >= 80.0:
            load_band = "near_limit"
        else:
            load_band = "optimal"

    # Operational Workload Risk Index Calculation (Ethical Heuristic)
    # Framing: Operational capacity and deadline pressure indicator, NOT clinical burnout.
    if weekly_capacity > 0:
        util_ratio = current_load_hours / weekly_capacity
    else:
        util_ratio = 1.0 if current_load_hours > 0 else 0.0

    base_risk = min(max(util_ratio * 0.7 + critical_task_count * 0.05, 0.05), 1.0)
    if util_ratio > 1.0:
        base_risk = min(0.85 + (util_ratio - 1.0) * 0.5, 1.0)
    operational_risk_score = round(base_risk, 2)

    return EmployeeWorkloadStats(
        employee_id=emp_id,
        full_name=full_name,
        email=email,
        department=department,
        job_title=job_title,
        avatar_url=avatar_url,
        weekly_capacity_hours=weekly_capacity,
        current_load_hours=current_load_hours,
        utilization_pct=utilization_pct,
        remaining_capacity_hours=remaining_capacity,
        is_overloaded=is_overloaded,
        active_task_count=active_task_count,
        operational_risk_score=operational_risk_score,
        load_band=load_band,
    )

def compute_organization_workload_overview(
    employees: List[Dict[str, Any]],
    tasks: List[Dict[str, Any]],
    department_filter: Optional[str] = None,
) -> OrganizationWorkloadOverview:
    """
    Aggregates workload statistics across the entire organization or specified department.
    """
    # Compute per-employee workload
    workloads: List[EmployeeWorkloadStats] = []
    for emp in employees:
        stats = calculate_single_employee_workload(emp, tasks)
        if department_filter:
            if stats.department.lower() == department_filter.lower():
                workloads.append(stats)
        else:
            workloads.append(stats)

    total_employees = len(workloads)
    total_capacity = round(sum(w.weekly_capacity_hours for w in workloads), 2)
    total_allocated = round(sum(w.current_load_hours for w in workloads), 2)

    if total_capacity > 0:
        avg_utilization = round((total_allocated / total_capacity) * 100.0, 2)
    else:
        avg_utilization = 0.0

    overloaded_count = sum(1 for w in workloads if w.is_overloaded)
    underutilized_count = sum(1 for w in workloads if w.load_band == "optimal")

    # Department breakdown
    dept_map: Dict[str, Dict[str, float]] = {}
    dept_counts: Dict[str, int] = {}

    for w in workloads:
        dept = w.department or "General"
        if dept not in dept_map:
            dept_map[dept] = {"capacity": 0.0, "allocated": 0.0}
            dept_counts[dept] = 0
        dept_map[dept]["capacity"] += w.weekly_capacity_hours
        dept_map[dept]["allocated"] += w.current_load_hours
        dept_counts[dept] += 1

    dept_breakdowns: List[DepartmentWorkloadBreakdown] = []
    for dept, data in sorted(dept_map.items()):
        cap = round(data["capacity"], 2)
        alloc = round(data["allocated"], 2)
        util = round((alloc / cap * 100.0), 2) if cap > 0 else 0.0
        dept_breakdowns.append(
            DepartmentWorkloadBreakdown(
                department=dept,
                capacity_hours=cap,
                allocated_hours=alloc,
                utilization_pct=util,
                employee_count=dept_counts[dept],
            )
        )

    return OrganizationWorkloadOverview(
        total_employees=total_employees,
        total_capacity_hours=total_capacity,
        total_allocated_hours=total_allocated,
        average_utilization_pct=avg_utilization,
        overloaded_count=overloaded_count,
        underutilized_count=underutilized_count,
        department_breakdown=dept_breakdowns,
        employee_workloads=workloads,
    )

def compute_operational_burnout_insights(
    employees: List[Dict[str, Any]],
    tasks: List[Dict[str, Any]],
) -> OperationalBurnoutRiskResponse:
    """
    Computes heuristic operational risk indicators for organization members.
    Framed transparently as operational workload pressure metrics.
    """
    items: List[OperationalBurnoutRiskItem] = []

    for emp in employees:
        stats = calculate_single_employee_workload(emp, tasks)
        # Identify high or critical priority tasks
        emp_tasks = [
            t for t in tasks
            if str(t.get("assigned_to", "")) == stats.employee_id and is_task_active(t)
        ]
        high_pri_count = sum(
            1 for t in emp_tasks if str(t.get("priority", "")).lower() in ("high", "critical")
        )
        tight_deadlines_count = sum(
            1 for t in emp_tasks if t.get("due_date") is not None
        )

        risk_index = stats.operational_risk_score
        if risk_index >= 0.85:
            risk_level = "high"
        elif risk_index >= 0.70:
            risk_level = "elevated"
        elif risk_index >= 0.45:
            risk_level = "moderate"
        else:
            risk_level = "low"

        # Focus report on employees with non-negligible workload risks
        if risk_index >= 0.60 or stats.is_overloaded:
            items.append(
                OperationalBurnoutRiskItem(
                    profile_id=stats.employee_id,
                    full_name=stats.full_name,
                    department=stats.department,
                    consecutive_overload_weeks=2 if stats.is_overloaded else 1,
                    current_utilization_pct=stats.utilization_pct,
                    tight_deadlines_count=tight_deadlines_count,
                    high_priority_task_count=high_pri_count,
                    operational_risk_index=risk_index,
                    risk_level=risk_level,
                )
            )

    # Sort by highest risk index first
    items.sort(key=lambda x: x.operational_risk_index, reverse=True)

    return OperationalBurnoutRiskResponse(high_risk_employees=items)

def simulate_workload_redistribution(
    employees: List[Dict[str, Any]],
    tasks: List[Dict[str, Any]],
    department: Optional[str] = None,
    target_max_utilization_pct: float = 90.0,
) -> WorkloadRedistributionResponse:
    """
    Simulates task transfers from overloaded staff (> 100%) to teammates with capacity headroom.
    Ensures safe absorptions without exceeding target max utilization.
    """
    emp_stats_list = [calculate_single_employee_workload(e, tasks) for e in employees]
    stats_by_id = {s.employee_id: s for s in emp_stats_list}

    # Identify overloaded employees
    overloaded = [
        s for s in emp_stats_list
        if s.is_overloaded and (department is None or s.department.lower() == department.lower())
    ]
    # Sort most overloaded first
    overloaded.sort(key=lambda x: x.utilization_pct, reverse=True)

    proposals: List[WorkloadRedistributionProposalSchema] = []
    initial_overloaded_count = len(overloaded)
    resolved_overloads = 0

    # Clone active tasks to track reassignment simulation
    active_tasks = [t for t in tasks if is_task_active(t) and t.get("assigned_to")]

    # Track dynamic loads during simulation
    sim_loads = {s.employee_id: s.current_load_hours for s in emp_stats_list}

    for source in overloaded:
        source_id = source.employee_id
        source_tasks = [
            t for t in active_tasks
            if str(t.get("assigned_to", "")) == source_id
        ]
        # Sort tasks descending by estimated effort to find optimal relief
        source_tasks.sort(
            key=lambda t: float(t.get("estimated_hours") or 0.0),
            reverse=True
        )

        for task in source_tasks:
            raw_effort = task.get("estimated_hours") or 0.0
            try:
                task_hours = float(raw_effort)
            except (ValueError, TypeError):
                continue
            if task_hours <= 0:
                continue

            # Candidate targets in same organization/department
            candidates = []
            for target in emp_stats_list:
                target_id = target.employee_id
                if target_id == source_id:
                    continue
                if target.weekly_capacity_hours <= 0:
                    continue
                if department and target.department.lower() != department.lower():
                    continue

                curr_target_load = sim_loads[target_id]
                projected_target_load = curr_target_load + task_hours
                projected_util = (projected_target_load / target.weekly_capacity_hours) * 100.0

                if projected_util <= target_max_utilization_pct:
                    # Score candidate: prefer same department, then lower current utilization
                    same_dept_score = 1 if target.department == source.department else 0
                    candidates.append((same_dept_score, -projected_util, target, projected_target_load, projected_util))

            if candidates:
                candidates.sort(key=lambda c: (c[0], c[1]), reverse=True)
                _, _, best_target, target_proj_load, target_proj_util = candidates[0]
                target_id = best_target.employee_id

                source_proj_load = max(0.0, sim_loads[source_id] - task_hours)
                source_proj_util = (
                    round((source_proj_load / source.weekly_capacity_hours) * 100.0, 2)
                    if source.weekly_capacity_hours > 0 else 0.0
                )

                task_id = str(task.get("id", f"task-{len(proposals)}"))
                task_title = str(task.get("title", "Untitled Task"))

                proposal = WorkloadRedistributionProposalSchema(
                    id=f"prop-{source_id}-{task_id}",
                    task_id=task_id,
                    task_title=task_title,
                    task_hours=round(task_hours, 2),
                    source_employee=RedistributionEmployeeInfo(
                        id=source_id,
                        name=source.full_name,
                        current_load=round(sim_loads[source_id], 2),
                        projected_load=round(source_proj_load, 2),
                        weekly_capacity=source.weekly_capacity_hours,
                        projected_utilization_pct=source_proj_util,
                    ),
                    target_employee=RedistributionEmployeeInfo(
                        id=target_id,
                        name=best_target.full_name,
                        current_load=round(sim_loads[target_id], 2),
                        projected_load=round(target_proj_load, 2),
                        weekly_capacity=best_target.weekly_capacity_hours,
                        projected_utilization_pct=round(target_proj_util, 2),
                    ),
                    rationale=(
                        f"Transferring '{task_title}' ({task_hours:.1f}h) relieves {source.full_name} "
                        f"from {source.utilization_pct:.1f}% overload down to {source_proj_util:.1f}%, "
                        f"while {best_target.full_name} absorbs the deliverable safely to {target_proj_util:.1f}%."
                    ),
                )
                proposals.append(proposal)

                # Update simulation state
                sim_loads[source_id] = source_proj_load
                sim_loads[target_id] = target_proj_load
                if source_proj_load <= source.weekly_capacity_hours:
                    resolved_overloads += 1
                break # Propose 1 high-impact transfer per overloaded member

    return WorkloadRedistributionResponse(
        proposals=proposals,
        net_capacity_impact=NetCapacityImpactSchema(
            overloaded_reduced_count=resolved_overloads,
            average_utilization_delta=-round(sum(p.task_hours for p in proposals) / max(1, len(employees)), 2),
        ),
    )
