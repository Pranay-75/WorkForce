# WorkForce: AI-Powered Workforce Capacity SaaS

WorkForce is an intelligent workforce capacity and explainable task matching SaaS platform built with Next.js, Python FastAPI, Supabase PostgreSQL, and Google Gemini.

---

## 🚀 Phase 1 Acceptance Complete: Frontend Design System & Role Experience

Phase 1 UI development and acceptance testing are 100% complete and verified.

### 🎭 Simulated Role-Adaptive Navigation & Views
Using the **Demo Role Switcher** in the top header:
1. **Manager (Sarah Connor)**:
   - Access to: Dashboard, Employee Directory, Projects, Task Kanban, AI Recommendations Hub, Capacity Heatmap & Redistribution Sandbox, Reports, and Notifications.
   - Dashboard View: Real-time org utilization, workload heatmap, pending AI approval cards, and overload risk flags.
2. **Admin / HR (Chloe Dubois)**:
   - Access to: Dashboard, Employee Directory, Skill Taxonomy Administration, Projects, Tasks, Reports, Immutable Compliance Audit Logs, and Workspace Settings / Demo Seeder.
   - Dashboard View: Organization headcount, functional unit bandwidth, active initiatives, and recent compliance logs.
3. **Employee (Alex Chen / Priya Patel)**:
   - Access to: Personal Dashboard, Projects, Tasks (My Tasks), and Notifications.
   - Dashboard View: Personal weekly load meter (e.g. 32h / 40h), "My Active Tasks" queue with direct progress advancement buttons, personal skill matrix, and personal deadlines.

---

## 🛠️ Local Development & Quick Start

### Prerequisites
- Node.js `20.x` or higher
- npm `10.x` or higher

### Commands to Run Locally:
```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install dependencies (if not already installed)
npm install

# 3. Start the production server (Fast & fully optimized)
npm run build
npm run start

# Or run in development hot-reload mode:
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or [/dashboard](http://localhost:3000/dashboard)) in your browser.

---

## 📂 Project Architecture

```
WorkForce/
├── frontend/               # Next.js 15 App Router, React 19, Tailwind CSS
│   ├── app/                # 15 Static & Dynamic routes
│   │   ├── dashboard/      # Role-adaptive dashboard (Employee / Manager / Admin)
│   │   ├── employees/      # Directory & [id] profile pages
│   │   ├── projects/       # Portfolio & [id] project board pages
│   │   ├── tasks/          # Kanban board, Table & [id] task detail pages
│   │   ├── matching/       # Explainable AI Matching Hub with Manager approvals
│   │   ├── workload/       # Capacity Heatmap & Redistribution Sandbox
│   │   ├── insights/       # Operational Risk Matrix & velocity charts
│   │   ├── reports/        # Utilization tables & working CSV export
│   │   ├── audit/          # Immutable compliance audit log
│   │   ├── notifications/  # In-app alert triage & dispatch
│   │   └── settings/       # Org settings & one-click synthetic seeder
│   ├── components/
│   │   ├── layout/         # AppSidebar (role-filtered), AppHeader (demo switcher), AppShell
│   │   └── ui/             # Button, Badge, Card, MetricCard, ProgressBar, DataTable, Dialog, etc.
│   └── lib/                # mockStore.tsx (reactive state), mockData.ts, types.ts
├── docs/                   # Full System Specifications
│   ├── PRODUCT_SPEC.md
│   ├── SCREEN_MAP.md
│   ├── DATA_MODEL.md
│   ├── API_SPEC.md
│   └── ACCEPTANCE_TESTS.md
├── AGENTS.md               # Mandatory architectural constitution & rules
└── README.md
```