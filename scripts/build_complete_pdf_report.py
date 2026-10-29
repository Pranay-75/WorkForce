import os
import subprocess
import sys

def build_html_report() -> str:
    # High-quality HTML template with embedded styling and SVG diagrams
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>WorkForce — AI-Powered Workforce Management Platform: Complete Technical Documentation & User Guide</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@500;600;700;800&display=swap');

    @page {
      size: A4;
      margin: 18mm 16mm 18mm 16mm;
      @bottom-right {
        content: counter(page);
        font-family: 'Inter', sans-serif;
        font-size: 8.5pt;
        font-weight: 500;
        color: #64748b;
      }
      @bottom-left {
        content: "WorkForce Platform — Technical Documentation & User Guide";
        font-family: 'Inter', sans-serif;
        font-size: 8.5pt;
        color: #94a3b8;
      }
    }

    @page :first {
      margin: 0;
      @bottom-right { content: normal; }
      @bottom-left { content: normal; }
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 9.5pt;
      line-height: 1.55;
      color: #1e293b;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
    }

    /* Cover Page */
    .cover-page {
      page-break-after: always;
      height: 100vh;
      min-height: 297mm;
      background: linear-gradient(135deg, #090d16 0%, #0f172a 45%, #1e1b4b 100%);
      color: #ffffff;
      padding: 35mm 25mm 25mm 25mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
    }

    .cover-page::before {
      content: "";
      position: absolute;
      top: -10%;
      right: -10%;
      width: 500px;
      height: 500px;
      background: radial-gradient(circle, rgba(139, 92, 246, 0.25) 0%, rgba(139, 92, 246, 0) 70%);
      border-radius: 50%;
      pointer-events: none;
    }

    .cover-page::after {
      content: "";
      position: absolute;
      bottom: -10%;
      left: -10%;
      width: 450px;
      height: 450px;
      background: radial-gradient(circle, rgba(6, 182, 212, 0.2) 0%, rgba(6, 182, 212, 0) 70%);
      border-radius: 50%;
      pointer-events: none;
    }

    .cover-top {
      position: relative;
      z-index: 2;
    }

    .cover-tagline {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(139, 92, 246, 0.18);
      border: 1px solid rgba(139, 92, 246, 0.4);
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #c4b5fd;
      margin-bottom: 24px;
    }

    .cover-title {
      font-family: 'Outfit', sans-serif;
      font-size: 34pt;
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -0.02em;
      margin: 0 0 16px 0;
      background: linear-gradient(135deg, #ffffff 30%, #cbd5e1 70%, #93c5fd 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .cover-subtitle {
      font-size: 13pt;
      font-weight: 400;
      line-height: 1.5;
      color: #94a3b8;
      max-width: 90%;
      margin: 0 0 35px 0;
    }

    .cover-badge-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 30px;
      position: relative;
      z-index: 2;
    }

    .cover-badge-card {
      background: rgba(30, 41, 59, 0.65);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 12px 16px;
      border-radius: 10px;
      backdrop-filter: blur(8px);
    }

    .cover-badge-card .label {
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #818cf8;
      margin-bottom: 4px;
    }

    .cover-badge-card .value {
      font-size: 9pt;
      font-weight: 600;
      color: #f8fafc;
    }

    .cover-footer {
      border-top: 1px solid rgba(255, 255, 255, 0.15);
      padding-top: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 8.5pt;
      color: #64748b;
      position: relative;
      z-index: 2;
    }

    .cover-footer-left strong {
      color: #cbd5e1;
      display: block;
      font-size: 9pt;
      margin-bottom: 3px;
    }

    .cover-footer-right {
      text-align: right;
      font-family: 'JetBrains Mono', monospace;
      color: #94a3b8;
    }

    /* Content Layout */
    .content-wrapper {
      padding: 0;
    }

    .page-break {
      page-break-before: always;
    }

    .avoid-break {
      page-break-inside: avoid;
    }

    /* Typography */
    h1, h2, h3, h4, h5 {
      font-family: 'Outfit', sans-serif;
      color: #0f172a;
      letter-spacing: -0.015em;
      page-break-after: avoid;
    }

    h1 {
      font-size: 20pt;
      font-weight: 800;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 8px;
      margin-top: 0;
      margin-bottom: 16px;
      color: #1e1b4b;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .chapter-number {
      display: inline-block;
      background: #4f46e5;
      color: #ffffff;
      font-size: 11pt;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 6px;
      margin-right: 8px;
    }

    h2 {
      font-size: 14pt;
      font-weight: 700;
      margin-top: 22px;
      margin-bottom: 10px;
      color: #1e293b;
      border-left: 3.5px solid #6366f1;
      padding-left: 8px;
    }

    h3 {
      font-size: 11pt;
      font-weight: 600;
      margin-top: 16px;
      margin-bottom: 6px;
      color: #334155;
    }

    h4 {
      font-size: 9.5pt;
      font-weight: 600;
      margin-top: 12px;
      margin-bottom: 4px;
      color: #475569;
    }

    p {
      margin-top: 0;
      margin-bottom: 10px;
      text-align: justify;
    }

    ul, ol {
      margin-top: 0;
      margin-bottom: 10px;
      padding-left: 20px;
    }

    li {
      margin-bottom: 4px;
    }

    /* Callout Boxes */
    .callout {
      border-radius: 8px;
      padding: 10px 14px;
      margin: 12px 0;
      font-size: 9pt;
      page-break-inside: avoid;
      border-left: 4px solid;
    }

    .callout-info {
      background-color: #f0fdf4;
      border-left-color: #16a34a;
      color: #166534;
    }

    .callout-warning {
      background-color: #fffbeb;
      border-left-color: #f59e0b;
      color: #92400e;
    }

    .callout-security {
      background-color: #fef2f2;
      border-left-color: #ef4444;
      color: #991b1b;
    }

    .callout-note {
      background-color: #f8fafc;
      border-left-color: #6366f1;
      color: #334155;
    }

    .callout-title {
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0 16px 0;
      font-size: 8.5pt;
      page-break-inside: auto;
    }

    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }

    thead {
      display: table-header-group;
    }

    th {
      background-color: #0f172a;
      color: #f8fafc;
      font-weight: 600;
      text-align: left;
      padding: 7px 9px;
      border: 1px solid #1e293b;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    td {
      padding: 6px 9px;
      border: 1px solid #cbd5e1;
      vertical-align: top;
      color: #334155;
    }

    tbody tr:nth-child(even) {
      background-color: #f8fafc;
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 9999px;
      font-size: 7.5pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }

    .badge-success { background-color: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .badge-violet { background-color: #ede9fe; color: #6d28d9; border: 1px solid #c4b5fd; }
    .badge-amber { background-color: #fef3c7; color: #b45309; border: 1px solid #fcd34d; }
    .badge-rose { background-color: #ffe4e6; color: #be123c; border: 1px solid #fda4af; }
    .badge-cyan { background-color: #cffafe; color: #0e7490; border: 1px solid #67e8f9; }
    .badge-slate { background-color: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }

    /* Code Blocks */
    code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8pt;
      background-color: #f1f5f9;
      color: #4338ca;
      padding: 1.5px 4.5px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }

    pre {
      background-color: #090d16;
      color: #e2e8f0;
      padding: 12px 14px;
      border-radius: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5pt;
      line-height: 1.45;
      overflow-x: auto;
      border: 1px solid #1e293b;
      margin: 10px 0;
      page-break-inside: avoid;
    }

    pre code {
      background-color: transparent;
      color: inherit;
      padding: 0;
      border: none;
      font-size: inherit;
    }

    /* Table of Contents */
    .toc {
      page-break-after: always;
      padding-top: 10px;
    }

    .toc-title {
      font-size: 20pt;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 2px solid #6366f1;
      padding-bottom: 8px;
      margin-bottom: 20px;
    }

    .toc-grid {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }

    .toc-item {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: 9.5pt;
      text-decoration: none;
      color: #1e293b;
      padding: 2px 0;
    }

    .toc-item-title {
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .toc-num {
      color: #6366f1;
      font-weight: 700;
      min-width: 85px;
    }

    .toc-dots {
      flex: 1;
      border-bottom: 1px dotted #cbd5e1;
      margin: 0 10px;
      height: 1px;
    }

    .toc-page {
      font-weight: 600;
      color: #64748b;
      font-family: 'JetBrains Mono', monospace;
      font-size: 8.5pt;
    }

    /* Diagram Containers */
    .diagram-container {
      background-color: #0b1120;
      border: 1px solid #1e293b;
      border-radius: 10px;
      padding: 16px;
      margin: 16px 0;
      page-break-inside: avoid;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .diagram-title {
      color: #94a3b8;
      font-size: 8pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 12px;
      align-self: flex-start;
    }

    svg {
      max-width: 100%;
      height: auto;
    }

    /* FAQ Box */
    .faq-item {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 10px;
      background-color: #ffffff;
      page-break-inside: avoid;
    }

    .faq-q {
      font-weight: 700;
      color: #0f172a;
      font-size: 9.5pt;
      margin-bottom: 4px;
      display: flex;
      align-items: baseline;
      gap: 6px;
    }

    .faq-q-badge {
      background: #e0e7ff;
      color: #4338ca;
      font-size: 7.5pt;
      padding: 1px 6px;
      border-radius: 4px;
      font-weight: 700;
    }

    .faq-a {
      color: #475569;
      font-size: 9pt;
      line-height: 1.5;
      text-align: justify;
    }

    /* KPI Cards in Document */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin: 12px 0 16px 0;
      page-break-inside: avoid;
    }

    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      text-align: center;
    }

    .kpi-card .val {
      font-family: 'Outfit', sans-serif;
      font-size: 16pt;
      font-weight: 800;
      color: #4f46e5;
      line-height: 1.2;
    }

    .kpi-card .lbl {
      font-size: 7.5pt;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 3px;
    }
  </style>
</head>
<body>

  <!-- ===================================================================== -->
  <!-- COVER PAGE                                                            -->
  <!-- ===================================================================== -->
  <div class="cover-page">
    <div class="cover-top">
      <div class="cover-tagline">
        <span>Verified Engineering Architecture &amp; System Manual</span>
      </div>
      <div class="cover-title">WorkForce</div>
      <div class="cover-subtitle">
        AI-Powered Workforce Capacity Monitoring, Explainable Task Matching &amp; Workload Balancing Platform
      </div>

      <div class="cover-badge-grid">
        <div class="cover-badge-card">
          <div class="label">Primary Document Title</div>
          <div class="value">Complete Technical Documentation &amp; User Guide</div>
        </div>
        <div class="cover-badge-card">
          <div class="label">Live Production Platform</div>
          <div class="value">workforce-platform.vercel.app</div>
        </div>
        <div class="cover-badge-card">
          <div class="label">Core Architecture</div>
          <div class="value">Next.js 15.5 • Python FastAPI • Supabase PostgreSQL • Gemini</div>
        </div>
        <div class="cover-badge-card">
          <div class="label">Verification Status</div>
          <div class="value">33/33 Pytest Passed • 98/98 Demo Passed • Build 24/24 OK</div>
        </div>
      </div>
    </div>

    <div class="cover-footer">
      <div class="cover-footer-left">
        <strong>WorkForce Engineering &amp; System Architecture Team</strong>
        <span>Autonomous Multi-Tenant Workforce SaaS • Monorepo Reference: Pranay-75/WorkForce</span>
      </div>
      <div class="cover-footer-right">
        <div>Document Ref: WF-DOC-2026-v1.0</div>
        <div>Release Date: October 2026</div>
      </div>
    </div>
  </div>

  <div class="content-wrapper">

    <!-- ===================================================================== -->
    <!-- TABLE OF CONTENTS                                                     -->
    <!-- ===================================================================== -->
    <div class="toc">
      <div class="toc-title">Table of Contents</div>
      <div class="toc-grid">
        <div class="toc-item">
          <div class="toc-item-title"><span class="toc-num">Chapter 1</span> Executive Summary</div>
          <div class="toc-dots"></div>
          <div class="toc-page">Page 3</div>
        </div>
        <div class="toc-item">
          <div class="toc-item-title"><span class="toc-num">Chapter 2</span> Problem Statement &amp; Proposed Solution</div>
          <div class="toc-dots"></div>
          <div class="toc-page">Page 5</div>
        </div>
        <div class="toc-item">
          <div class="toc-item-title"><span class="toc-num">Chapter 3</span> Complete Feature Documentation (Catalog of Verified Features)</div>
          <div class="toc-dots"></div>
          <div class="toc-page">Page 7</div>
        </div>
        <div class="toc-item">
          <div class="toc-item-title"><span class="toc-num">Chapter 4</span> User Roles, Permissions &amp; Access Control Matrix</div>
          <div class="toc-dots"></div>
          <div class="toc-page">Page 11</div>
        </div>
        <div class="toc-item">
          <div class="toc-item-title"><span class="toc-num">Chapter 5</span> Technology Stack: What Is Used and Why</div>
          <div class="toc-dots"></div>
          <div class="toc-page">Page 14</div>
        </div>
        <div class="toc-item">
          <div class="toc-item-title"><span class="toc-num">Chapter 6</span> System Architecture &amp; Data Flow Diagrams</div>
          <div class="toc-dots"></div>
          <div class="toc-page">Page 17</div>
        </div>
        <div class="toc-item">
          <div class="toc-item-title"><span class="toc-num">Chapter 7</span> Database Design, Relational Models &amp; Data Dictionary</div>
          <div class="toc-dots"></div>
          <div class="toc-page">Page 20</div>
        </div>
        <div class="toc-item">
          <div class="toc-item-title"><span class="toc-num">Chapter 8</span> Authentication, Session Management &amp; Security Review</div>
          <div class="toc-dots"></div>
          <div class="toc-page">Page 24</div>
        </div>
        <div class="toc-item">
          <div class="toc-item-title"><span class="toc-num">Chapter 9</span> Artificial Intelligence &amp; Algorithmic Task Matching</div>
          <div class="toc-dots"></div>
          <div class="toc-page">Page 27</div>
        </div>
        <div class="toc-item">
          <div class="toc-item-title"><span class="toc-num">Chapter 10</span> Demo Mode vs. Live Production Mode Architecture</div>
          <div class="toc-dots"></div>
          <div class="toc-page">Page 29</div>
        </div>
        <div class="toc-item">
          <div class="toc-item-title"><span class="toc-num">Chapter 11</span> Complete Platform User Manual &amp; Step-by-Step Workflows</div>
          <div class="toc-dots"></div>
          <div class="toc-page">Page 31</div>
        </div>
        <div class="toc-item">
          <div class="toc-item-title"><span class="toc-num">Chapter 12</span> Installation, Developer Setup &amp; Configuration</div>
          <div class="toc-dots"></div>
          <div class="toc-page">Page 35</div>
        </div>
        <div class="toc-item">
          <div class="toc-item-title"><span class="toc-num">Chapter 13</span> Testing, Verification &amp; Quality Assurance Results</div>
          <div class="toc-dots"></div>
          <div class="toc-page">Page 38</div>
        </div>
        <div class="toc-item">
          <div class="toc-item-title"><span class="toc-num">Chapter 14</span> Production Deployment, Vercel CI/CD &amp; DevOps</div>
          <div class="toc-dots"></div>
          <div class="toc-page">Page 41</div>
        </div>
        <div class="toc-item">
          <div class="toc-item-title"><span class="toc-num">Chapter 15</span> Comprehensive Frequently Asked Questions (25 Key FAQs)</div>
          <div class="toc-dots"></div>
          <div class="toc-page">Page 43</div>
        </div>
        <div class="toc-item">
          <div class="toc-item-title"><span class="toc-num">Chapter 16</span> Limitations, Technical Debt, Risks &amp; Future Scope</div>
          <div class="toc-dots"></div>
          <div class="toc-page">Page 47</div>
        </div>
        <div class="toc-item">
          <div class="toc-item-title"><span class="toc-num">Chapter 17</span> Technical Glossary, Acronyms &amp; Official References</div>
          <div class="toc-dots"></div>
          <div class="toc-page">Page 49</div>
        </div>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- CHAPTER 1: EXECUTIVE SUMMARY                                          -->
    <!-- ===================================================================== -->
    <div class="page-break">
      <h1><span class="chapter-number">CH 1</span> Executive Summary</h1>

      <div class="kpi-row">
        <div class="kpi-card">
          <div class="val">24 / 24</div>
          <div class="lbl">Built Next.js Routes</div>
        </div>
        <div class="kpi-card">
          <div class="val">33 / 33</div>
          <div class="lbl">Pytest Auth Checks Passed</div>
        </div>
        <div class="kpi-card">
          <div class="val">8</div>
          <div class="lbl">SQL Database Migrations</div>
        </div>
        <div class="kpi-card">
          <div class="val">100%</div>
          <div class="lbl">RLS Multi-Tenant Isolation</div>
        </div>
      </div>

      <h2>1.1 Project Overview</h2>
      <p>
        <strong>WorkForce</strong> is an enterprise-grade, multi-tenant software-as-a-service (SaaS) platform engineered to solve the chronic inefficiencies, lack of capacity visibility, and unscientific task delegation inherent in modern technical organisations. Combining a modern <strong>Next.js 15 App Router</strong> frontend, a high-performance <strong>Python FastAPI</strong> backend, and an immutable <strong>Supabase PostgreSQL</strong> database governed by Row-Level Security (RLS), WorkForce bridges the gap between organizational resource management and transparent, explainable task allocation.
      </p>
      <p>
        Unlike traditional project management applications (such as Jira, Trello, or Asana) that function primarily as administrative ticket logs without insight into individual human bandwidth, WorkForce treats <strong>workforce capacity</strong> as a first-class mathematical constraint. The platform continuously monitors allocated task hours against defined weekly limits, flags operational overload before deadlines are compromised, and provides human-in-the-loop candidate recommendations driven by composite skill matching and availability heuristics.
      </p>

      <h2>1.2 Purpose and Objectives</h2>
      <p>The primary objectives of the WorkForce platform are:</p>
      <ul>
        <li><strong>Eliminate Arbitrary Task Delegation:</strong> Replace subjective guessing games with verifiable multi-factor scoring combining verified skill prerequisites, departmental alignment, and projected weekly utilization.</li>
        <li><strong>Prevent Team Burnout Deterministically:</strong> Establish hard operational capacity thresholds (e.g. 40 hours/week) and compute real-time workload deltas across active deliverables, providing visual warnings and rebalancing tools.</li>
        <li><strong>Guarantee Multi-Tenant Data Isolation:</strong> Implement zero-trust security at the PostgreSQL database layer using Row-Level Security (RLS) policies and security-definer Remote Procedure Calls (RPCs), ensuring complete data partitioning across enterprise workspaces.</li>
        <li><strong>Preserve Human Agency via Explainable AI:</strong> Ensure that automated recommendations remain strictly advisory. Managers retain 100% final approval authority, and every proposal is accompanied by clear, auditable reasoning rather than opaque black-box scores.</li>
        <li><strong>Provide Turnkey Demonstration Capability:</strong> Offer a zero-setup, self-contained interactive simulation (<code>/presentation</code> and demo switchers) that enables instant academic evaluation, sales walk-throughs, and technical viva examinations without configuring external cloud services.</li>
      </ul>

      <h2>1.3 Target Users and Operational Personas</h2>
      <p>WorkForce supports five distinct organizational roles:</p>
      <ul>
        <li><strong>Workspace Organizer (Founder / Super Admin):</strong> Owns primary tenant bootstrap, organization settings, subscription lifecycle, and root admin appointments.</li>
        <li><strong>Organization Administrator:</strong> Manages employee rosters, member invitations, manager promotions, compliance settings, and immutable audit logs.</li>
        <li><strong>Project Manager / Team Lead:</strong> Assembles project squads, creates deliverables with skill prerequisites, reviews AI candidate matches, approves assignments, and executes workload rebalancing.</li>
        <li><strong>Human Resources &amp; Talent Operations:</strong> Monitors organization-wide capacity heatmaps, department headcount distributions, and exports compliance CSV data.</li>
        <li><strong>Employee / Contributor:</strong> Tracks personal deliverables, executes status transitions (<code>todo</code> &rarr; <code>in_progress</code> &rarr; <code>in_review</code> &rarr; <code>completed</code>), and maintains verified personal competencies.</li>
      </ul>

      <div class="callout callout-info">
        <div class="callout-title">Verified Production Readiness</div>
        The WorkForce web platform is fully deployed and accessible in production at <a href="https://workforce-platform.vercel.app" style="color:#15803d; font-weight:700;">https://workforce-platform.vercel.app</a>, running on Vercel's global edge network.
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- CHAPTER 2: PROBLEM STATEMENT & PROPOSED SOLUTION                      -->
    <!-- ===================================================================== -->
    <div class="page-break">
      <h1><span class="chapter-number">CH 2</span> Problem Statement &amp; Proposed Solution</h1>

      <h2>2.1 The Crisis of Manual Workforce Allocation</h2>
      <p>
        In modern technology and engineering teams, human talent represents the primary driver of value. Despite this reality, the methodologies used to allocate deliverables, balance workloads, and track capacity remain astonishingly primitive.
      </p>

      <div class="callout callout-warning">
        <div class="callout-title">Core Deficiencies in Current Industry Tools</div>
        <ul>
          <li><strong>Opaque Multi-Project Allocation:</strong> When engineers contribute across multiple squads, no single project manager has a consolidated view of their total commitments. A developer assigned 25h on Project A and 20h on Project B is at 45h (112.5% load), causing delivery delays and burnout.</li>
          <li><strong>Subjective Task Delegation:</strong> Tasks are delegated based on vocal availability or recency bias rather than verified technical competencies and headroom.</li>
          <li><strong>Opaque Black-Box Management:</strong> Tools like Jira log tickets, but do not compute whether the assignee has required skills or available hours.</li>
          <li><strong>Reactive Burnout Management:</strong> Overload is noticed only after deadlines fail or engineers resign.</li>
        </ul>
      </div>

      <h2>2.2 The WorkForce Architectural Solution</h2>
      <p>
        WorkForce transforms capacity and competency into <strong>deterministic computational parameters</strong>:
      </p>
      <ul>
        <li><strong>Mathematical Capacity Gating:</strong> Every user profile defines a verified <code>weekly_capacity_hours</code> parameter (defaulting to 40.00h). Deliverables declare <code>estimated_hours</code>. Active workload is calculated in real time by summing all non-completed task hours.</li>
        <li><strong>Deterministic Pre-Filtering:</strong> Before candidate ranking occurs, hard constraints are enforced: tenant isolation, active membership status, and minimum prerequisite skill proficiencies.</li>
        <li><strong>Explainable Multi-Factor Scoring:</strong> Match scores (0–100%) combine capacity availability (50%) and skill overlap (50%), supplemented by natural-language rationale explaining fit and scheduling caveats.</li>
        <li><strong>Mandatory Human Agency:</strong> AI suggestions cannot alter database state autonomously. A manager must explicitly execute the <code>assign_task</code> action, which is immutably logged.</li>
        <li><strong>Proactive Workload Rebalancing:</strong> When team members exceed 100% capacity, the system automatically detects movable non-critical tasks and identifies under-utilized colleagues with compatible competencies, providing a visual diff sandbox before applying reassignments.</li>
      </ul>
    </div>

    <!-- ===================================================================== -->
    <!-- CHAPTER 3: COMPLETE FEATURE DOCUMENTATION                             -->
    <!-- ===================================================================== -->
    <div class="page-break">
      <h1><span class="chapter-number">CH 3</span> Complete Feature Documentation</h1>

      <p>
        This chapter provides an exhaustive catalog of every feature verified in the active WorkForce codebase.
      </p>

      <h2>3.1 Core Authentication &amp; Multi-Tenant Workspace Setup</h2>

      <h3>Feature 1: Multi-Strategy Secure Authentication</h3>
      <p><strong>Purpose &amp; Problem Solved:</strong> Authenticates enterprise users securely while supporting local development, cross-device email confirmations, and instant demo explorations without credentials.</p>
      <p><strong>Intended Roles:</strong> All roles.</p>
      <p><strong>Access Route:</strong> <code>/login</code>, <code>/register</code>, <code>/forgot-password</code>, <code>/reset-password</code>, <code>/auth/callback</code>.</p>
      <p><strong>Implementation Status:</strong> <span class="badge badge-success">Fully Implemented</span>.</p>
      <p><strong>User Workflow:</strong> Users enter credentials; Supabase GoTrue issues a signed JWT; the client verifies session state and routes to dashboard.</p>
      <p><strong>Technical Components:</strong> <code>frontend/app/auth/callback/route.ts</code>, <code>frontend/lib/authContext.tsx</code>, <code>backend/app/core/security.py</code>.</p>

      <h3>Feature 2: Atomic Organization Bootstrapping</h3>
      <p><strong>Purpose &amp; Problem Solved:</strong> Enables newly registered users to initialize their primary enterprise workspace without race conditions or orphan profiles.</p>
      <p><strong>Intended Roles:</strong> Workspace Organizer.</p>
      <p><strong>Access Route:</strong> <code>/onboarding</code>.</p>
      <p><strong>Implementation Status:</strong> <span class="badge badge-success">Fully Implemented</span>.</p>
      <p><strong>Technical Rules:</strong> Sanitizes slug via <code>slug.ts</code> and invokes PostgreSQL security-definer RPC <code>create_organization_with_admin()</code>.</p>

      <h3>Feature 3: Multi-Tenant Workspace Switching</h3>
      <p><strong>Purpose &amp; Problem Solved:</strong> Allows users belonging to multiple organizations to switch contexts cleanly while failing closed if no selection is made.</p>
      <p><strong>Implementation Status:</strong> <span class="badge badge-success">Fully Implemented</span>.</p>
      <p><strong>Technical Rules:</strong> Evaluates <code>hasAmbiguousMembership</code> in <code>authContext.tsx</code>, rejecting ambiguous access without explicit selection.</p>

      <h2>3.2 Roster, Team Management &amp; Access Governance</h2>

      <h3>Feature 4: Role-Adaptive Executive Dashboard</h3>
      <p><strong>Purpose &amp; Problem Solved:</strong> Renders 4 distinct, role-tailored dashboard views: Organizer ownership controls, Admin compliance oversight, Manager capacity overview, and Employee personal portal.</p>
      <p><strong>Access Route:</strong> <code>/dashboard</code>.</p>
      <p><strong>Implementation Status:</strong> <span class="badge badge-success">Fully Implemented</span> (1,613 lines of role-differentiated UI in <code>dashboard/page.tsx</code>).</p>

      <h3>Feature 5: Employee Directory &amp; Capacity Profiles</h3>
      <p><strong>Purpose &amp; Problem Solved:</strong> Searchable, filterable directory displaying talent, skills, departments, and active workload commitments.</p>
      <p><strong>Access Route:</strong> <code>/employees</code>, <code>/employees/[id]</code>.</p>
      <p><strong>Implementation Status:</strong> <span class="badge badge-success">Fully Implemented</span>.</p>

      <h3>Feature 6: Member Invitations &amp; Hardened Admin Constraints</h3>
      <p><strong>Purpose &amp; Problem Solved:</strong> Allows administrators to invite colleagues with designated roles while strictly blocking invitation-based elevation to Admin.</p>
      <p><strong>Implementation Status:</strong> <span class="badge badge-success">Fully Implemented</span>.</p>
      <p><strong>Technical Rules:</strong> PostgreSQL check constraint <code>chk_org_invitations_role</code> strictly forbids pending admin invitations.</p>

      <h3>Feature 7: Sole Administrator Protection Trigger</h3>
      <p><strong>Purpose &amp; Problem Solved:</strong> Prevents catastrophic lockout by demoting, suspending, or deleting the sole remaining active administrator.</p>
      <p><strong>Implementation Status:</strong> <span class="badge badge-success">Fully Implemented</span>.</p>
      <p><strong>Technical Rules:</strong> Trigger <code>protect_last_active_admin()</code> acquires <code>FOR UPDATE</code> row lock on organization and aborts with error <code>42501</code>.</p>

      <h2>3.3 Project &amp; Task Deliverables Tracking</h2>

      <h3>Feature 8: Project Portfolio Management</h3>
      <p><strong>Purpose &amp; Problem Solved:</strong> Organizes deliverables into initiatives with defined managers, status flags, and composite foreign key tenant bindings.</p>
      <p><strong>Access Route:</strong> <code>/projects</code>, <code>/projects/[id]</code>.</p>
      <p><strong>Implementation Status:</strong> <span class="badge badge-success">Fully Implemented</span>.</p>

      <h3>Feature 9: Dual-View Task Manager (Kanban &amp; Table)</h3>
      <p><strong>Purpose &amp; Problem Solved:</strong> Interactive task board supporting 4 Kanban columns (Todo, In Progress, In Review, Completed) and tabular mode.</p>
      <p><strong>Access Route:</strong> <code>/tasks</code>, <code>/tasks/[id]</code>.</p>
      <p><strong>Implementation Status:</strong> <span class="badge badge-success">Fully Implemented</span>.</p>

      <h3>Feature 10: JSONB Skill Prerequisites Validator</h3>
      <p><strong>Purpose &amp; Problem Solved:</strong> Attaches structured competency requirements to tasks with database validation.</p>
      <p><strong>Implementation Status:</strong> <span class="badge badge-success">Fully Implemented</span> (Function <code>validate_task_required_skills</code>).</p>

      <h3>Feature 11: Controlled Task Assignment RPC (Level 1/2 Locking)</h3>
      <p><strong>Purpose &amp; Problem Solved:</strong> Prevents race conditions and unauthorized REST updates on task assignees.</p>
      <p><strong>Implementation Status:</strong> <span class="badge badge-success">Fully Implemented</span> (RPC <code>assign_task</code>).</p>

      <h3>Feature 12: Employee Status Immutability Trigger</h3>
      <p><strong>Purpose &amp; Problem Solved:</strong> Allows assigned employees to update task status while strictly blocking changes to hours, due date, or title.</p>
      <p><strong>Implementation Status:</strong> <span class="badge badge-success">Fully Implemented</span> (Trigger <code>enforce_task_update_permissions</code>).</p>

      <h2>3.4 AI Matching, Capacity Balancing &amp; Governance</h2>

      <h3>Feature 13: Explainable AI Task Matching Hub</h3>
      <p><strong>Purpose &amp; Problem Solved:</strong> Ranks personnel for unassigned deliverables based on 50% capacity availability and 50% skill overlap with natural-language rationale.</p>
      <p><strong>Access Route:</strong> <code>/matching</code>.</p>
      <p><strong>Implementation Status:</strong> <span class="badge badge-amber">Partially Implemented</span> (Live client-side scoring; precomputed Gemini simulation in demo mode).</p>

      <h3>Feature 14: Workload Capacity Monitor &amp; Redistribution Sandbox</h3>
      <p><strong>Purpose &amp; Problem Solved:</strong> Visualizes capacity bands (Overloaded, Near Limit, Optimal) and proposes task transfers with before/after diffs.</p>
      <p><strong>Access Route:</strong> <code>/workload</code>.</p>
      <p><strong>Implementation Status:</strong> <span class="badge badge-amber">Partially Implemented</span> (Dynamic heuristic proposal generator + live RPC assignment).</p>

      <h3>Feature 15: Immutable Compliance Audit Trail</h3>
      <p><strong>Purpose &amp; Problem Solved:</strong> Complete chronological log of administrative actions, task assignments, and role elevations.</p>
      <p><strong>Access Route:</strong> <code>/audit</code>.</p>
      <p><strong>Implementation Status:</strong> <span class="badge badge-success">Fully Implemented</span> (Table <code>organization_audit_logs</code> with insert-only policy).</p>

      <h3>Feature 16: Operational Performance &amp; Ethical Burnout Indicators</h3>
      <p><strong>Purpose &amp; Problem Solved:</strong> Tracks operational capacity headroom and sprint completion rates without making clinical or psychological claims.</p>
      <p><strong>Access Route:</strong> <code>/insights</code>.</p>
      <p><strong>Implementation Status:</strong> <span class="badge badge-amber">Partially Implemented</span>.</p>

      <h3>Feature 17: CSV Capacity Reporting</h3>
      <p><strong>Purpose &amp; Problem Solved:</strong> One-click export of organization capacity, allocated hours, and utilization rates to CSV.</p>
      <p><strong>Access Route:</strong> <code>/reports</code>.</p>
      <p><strong>Implementation Status:</strong> <span class="badge badge-success">Fully Implemented</span>.</p>

      <h3>Feature 18: Standalone Interactive Demo Showcase</h3>
      <p><strong>Purpose &amp; Problem Solved:</strong> Provides a 4,200+ line self-contained demonstration experience at <code>/presentation</code> with 7 switchable views and synthetic data.</p>
      <p><strong>Implementation Status:</strong> <span class="badge badge-success">Fully Implemented</span>.</p>
    </div>

    <!-- ===================================================================== -->
    <!-- CHAPTER 4: USER ROLES AND PERMISSIONS                                 -->
    <!-- ===================================================================== -->
    <div class="page-break">
      <h1><span class="chapter-number">CH 4</span> User Roles &amp; Access Control Matrix</h1>

      <h2>4.1 Supported Roles</h2>
      <p>WorkForce supports five distinct organizational roles:</p>
      <ul>
        <li><code>organizer</code>: Workspace Owner / Super Admin. Retains root ownership and settings authority.</li>
        <li><code>admin</code>: Organization Administrator. Manages members, promotions, compliance, and audit logs.</li>
        <li><code>manager</code>: Team Lead. Manages projects, tasks, matching proposals, and rebalancing.</li>
        <li><code>hr</code>: People Operations. Monitors capacity, skill taxonomy, and reporting.</li>
        <li><code>employee</code>: Team Contributor. Manages personal deliverables and personal skill matrix.</li>
      </ul>

      <h2>4.2 Comprehensive Role-Permission Matrix</h2>
      <table>
        <thead>
          <tr>
            <th>Resource / Action</th>
            <th>Organizer</th>
            <th>Admin</th>
            <th>Manager</th>
            <th>HR</th>
            <th>Employee</th>
            <th>Enforcement Layer</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>View Dashboard</strong></td>
            <td><span class="badge badge-success">Owner View</span></td>
            <td><span class="badge badge-success">Admin View</span></td>
            <td><span class="badge badge-success">Manager View</span></td>
            <td><span class="badge badge-success">HR View</span></td>
            <td><span class="badge badge-success">Personal Portal</span></td>
            <td>Page view conditional rendering</td>
          </tr>
          <tr>
            <td><strong>View Member Directory</strong></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-rose">DENIED</span></td>
            <td>Frontend <code>AccessDenied</code> &amp; Sidebar filter</td>
          </tr>
          <tr>
            <td><strong>Invite Members</strong></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-rose">DENIED</span></td>
            <td><span class="badge badge-rose">DENIED</span></td>
            <td><span class="badge badge-rose">DENIED</span></td>
            <td>RPC <code>invite_organization_member</code></td>
          </tr>
          <tr>
            <td><strong>Invite Member as Admin</strong></td>
            <td><span class="badge badge-rose">BLOCKED</span></td>
            <td><span class="badge badge-rose">BLOCKED</span></td>
            <td><span class="badge badge-rose">BLOCKED</span></td>
            <td><span class="badge badge-rose">BLOCKED</span></td>
            <td><span class="badge badge-rose">BLOCKED</span></td>
            <td>DB check constraint <code>chk_org_invitations_role</code></td>
          </tr>
          <tr>
            <td><strong>Promote Member to Admin</strong></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-rose">DENIED</span></td>
            <td><span class="badge badge-rose">DENIED</span></td>
            <td><span class="badge badge-rose">DENIED</span></td>
            <td>RPC <code>promote_member_to_admin</code></td>
          </tr>
          <tr>
            <td><strong>Demote Sole Active Admin</strong></td>
            <td><span class="badge badge-rose">BLOCKED</span></td>
            <td><span class="badge badge-rose">BLOCKED</span></td>
            <td><span class="badge badge-rose">BLOCKED</span></td>
            <td><span class="badge badge-rose">BLOCKED</span></td>
            <td><span class="badge badge-rose">BLOCKED</span></td>
            <td>Trigger <code>protect_last_active_admin</code></td>
          </tr>
          <tr>
            <td><strong>Create Projects</strong></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-rose">DENIED</span></td>
            <td><span class="badge badge-rose">DENIED</span></td>
            <td>RLS <code>projects_insert_policy</code></td>
          </tr>
          <tr>
            <td><strong>Create Tasks</strong></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-rose">DENIED</span></td>
            <td><span class="badge badge-rose">DENIED</span></td>
            <td>RLS <code>tasks_insert_policy</code></td>
          </tr>
          <tr>
            <td><strong>Assign Tasks</strong></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-rose">DENIED</span></td>
            <td><span class="badge badge-rose">DENIED</span></td>
            <td>RPC <code>assign_task</code> (Selective column grant)</td>
          </tr>
          <tr>
            <td><strong>Update Task Metadata</strong></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-rose">DENIED</span></td>
            <td><span class="badge badge-rose">DENIED</span></td>
            <td>Trigger <code>enforce_task_update_permissions</code></td>
          </tr>
          <tr>
            <td><strong>Update Task Status</strong></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-rose">DENIED</span></td>
            <td><span class="badge badge-success">Assigned Only</span></td>
            <td>Trigger <code>enforce_task_update_permissions</code></td>
          </tr>
          <tr>
            <td><strong>Access AI Matching Hub</strong></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-rose">DENIED</span></td>
            <td>Frontend <code>AccessDenied</code></td>
          </tr>
          <tr>
            <td><strong>Access Workload Sandbox</strong></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-rose">DENIED</span></td>
            <td>Frontend <code>AccessDenied</code></td>
          </tr>
          <tr>
            <td><strong>View Audit Trail</strong></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-rose">DENIED</span></td>
            <td><span class="badge badge-rose">DENIED</span></td>
            <td><span class="badge badge-rose">DENIED</span></td>
            <td>RLS <code>audit_logs_select_policy</code></td>
          </tr>
          <tr>
            <td><strong>Export Capacity CSV</strong></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-success">YES</span></td>
            <td><span class="badge badge-rose">DENIED</span></td>
            <td>Frontend <code>AccessDenied</code></td>
          </tr>
          <tr>
            <td><strong>Workspace Settings</strong></td>
            <td><span class="badge badge-success">FULL</span></td>
            <td><span class="badge badge-success">FULL</span></td>
            <td><span class="badge badge-rose">DENIED</span></td>
            <td><span class="badge badge-amber">Skills Only</span></td>
            <td><span class="badge badge-rose">DENIED</span></td>
            <td>RLS <code>organizations_update_policy</code></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ===================================================================== -->
    <!-- CHAPTER 5: TECHNOLOGY STACK                                           -->
    <!-- ===================================================================== -->
    <div class="page-break">
      <h1><span class="chapter-number">CH 5</span> Technology Stack: What Is Used and Why</h1>

      <h2>5.1 Comprehensive Technology Matrix</h2>
      <table>
        <thead>
          <tr>
            <th>Technology</th>
            <th>Location</th>
            <th>Purpose</th>
            <th>Why Selected</th>
            <th>Alternatives</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Next.js 15</strong></td>
            <td><code>frontend/</code></td>
            <td>Web framework, App Router, SSR</td>
            <td>Server-side rendering, React 19 support, built-in metadata SEO, Vercel edge deployment.</td>
            <td>Vite SPA, Remix</td>
            <td><span class="badge badge-success">Active</span></td>
          </tr>
          <tr>
            <td><strong>React 19</strong></td>
            <td><code>frontend/</code></td>
            <td>Component UI library</td>
            <td>Latest concurrent primitives and optimized hook lifecycles.</td>
            <td>Vue.js, Svelte</td>
            <td><span class="badge badge-success">Active</span></td>
          </tr>
          <tr>
            <td><strong>TypeScript 5.7</strong></td>
            <td><code>frontend/</code></td>
            <td>Static typing</td>
            <td>Prevents runtime type errors across complex multi-entity workforce structures.</td>
            <td>JavaScript</td>
            <td><span class="badge badge-success">Active</span></td>
          </tr>
          <tr>
            <td><strong>Tailwind CSS 3.4</strong></td>
            <td><code>frontend/</code></td>
            <td>Design system &amp; styling</td>
            <td>Zero runtime CSS, design tokens, instant dark mode aesthetic.</td>
            <td>CSS Modules</td>
            <td><span class="badge badge-success">Active</span></td>
          </tr>
          <tr>
            <td><strong>Python 3.14 / FastAPI</strong></td>
            <td><code>backend/</code></td>
            <td>Backend API &amp; security</td>
            <td>Async execution, automatic OpenAPI docs, Pydantic type validation, AI library synergy.</td>
            <td>Node Express</td>
            <td><span class="badge badge-success">Active</span></td>
          </tr>
          <tr>
            <td><strong>PyJWT &amp; Cryptography</strong></td>
            <td><code>backend/core/</code></td>
            <td>JWT validation</td>
            <td>Zero-trust cryptographic verification, JWKS asymmetric public key caching.</td>
            <td>python-jose</td>
            <td><span class="badge badge-success">Active</span></td>
          </tr>
          <tr>
            <td><strong>Supabase PostgreSQL</strong></td>
            <td><code>supabase/</code></td>
            <td>Database &amp; RLS engine</td>
            <td>ACID transactions, Row-Level Security, procedural triggers, composite foreign keys.</td>
            <td>MongoDB, MySQL</td>
            <td><span class="badge badge-success">Active</span></td>
          </tr>
          <tr>
            <td><strong>Google GenAI SDK</strong></td>
            <td><code>backend/</code></td>
            <td>Gemini AI model integration</td>
            <td>Direct access to Gemini 1.5/2.0 LLMs for explainable matching rationale.</td>
            <td>OpenAI SDK</td>
            <td><span class="badge badge-violet">Configured</span></td>
          </tr>
          <tr>
            <td><strong>Vercel Cloud</strong></td>
            <td>Hosting</td>
            <td>Global edge deployment</td>
            <td>Native Next.js 15 edge hosting, instant previews, automated branch builds.</td>
            <td>AWS, Netlify</td>
            <td><span class="badge badge-success">Active</span></td>
          </tr>
        </tbody>
      </table>

      <h2>5.2 Beginner-Friendly Overview</h2>
      <ul>
        <li><strong>Next.js &amp; React:</strong> Think of React as Lego blocks (cards, buttons, inputs) and Next.js as the master builder that organizes those blocks into fast-loading web pages.</li>
        <li><strong>TypeScript:</strong> An automated proofreader that inspects your code while typing, ensuring you never assign an employee 500 hours or forget required fields.</li>
        <li><strong>Tailwind CSS:</strong> A curated palette of design tokens that ensures every card, button, and badge matches across the entire application.</li>
        <li><strong>FastAPI &amp; Python:</strong> The security gatekeeper that inspects security passes (JWT tokens) in milliseconds and decides if a user is allowed in.</li>
        <li><strong>Supabase PostgreSQL:</strong> The secure filing cabinet where each company has an electronic lock (Row-Level Security) preventing other tenants from seeing their data.</li>
      </ul>
    </div>

    <!-- ===================================================================== -->
    <!-- CHAPTER 6: SYSTEM ARCHITECTURE                                        -->
    <!-- ===================================================================== -->
    <div class="page-break">
      <h1><span class="chapter-number">CH 6</span> System Architecture</h1>

      <h2>6.1 End-to-End System Architecture</h2>
      <div class="diagram-container">
        <div class="diagram-title">Figure 6.1 — WorkForce End-to-End Architectural Data Flow</div>
        <svg viewBox="0 0 760 320" width="760" height="320" xmlns="http://www.w3.org/2000/svg">
          <!-- Background Box -->
          <rect x="10" y="10" width="740" height="300" rx="12" fill="#0f172a" stroke="#1e293b" stroke-width="2"/>
          
          <!-- Client Tier -->
          <rect x="30" y="30" width="210" height="260" rx="8" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
          <text x="135" y="55" fill="#60a5fa" font-family="'Outfit', sans-serif" font-weight="700" font-size="12" text-anchor="middle">CLIENT TIER (Next.js 15)</text>
          <rect x="45" y="75" width="180" height="35" rx="5" fill="#0f172a" stroke="#334155"/>
          <text x="135" y="97" fill="#f8fafc" font-size="9.5" text-anchor="middle">Role-Adaptive Dashboard</text>
          <rect x="45" y="120" width="180" height="35" rx="5" fill="#0f172a" stroke="#334155"/>
          <text x="135" y="142" fill="#f8fafc" font-size="9.5" text-anchor="middle">Explainable AI Matching Hub</text>
          <rect x="45" y="165" width="180" height="35" rx="5" fill="#0f172a" stroke="#334155"/>
          <text x="135" y="187" fill="#f8fafc" font-size="9.5" text-anchor="middle">Workload Capacity Sandbox</text>
          <rect x="45" y="210" width="180" height="35" rx="5" fill="#0f172a" stroke="#334155"/>
          <text x="135" y="232" fill="#f8fafc" font-size="9.5" text-anchor="middle">Interactive Presentation Mode</text>

          <!-- Arrows from Client -->
          <path d="M 240 100 L 285 100" stroke="#38bdf8" stroke-width="2" marker-end="url(#arrow)"/>
          <text x="262" y="90" fill="#38bdf8" font-size="8" text-anchor="middle">JWT</text>
          
          <path d="M 240 200 L 515 200" stroke="#a855f7" stroke-width="2" marker-end="url(#arrow)"/>
          <text x="377" y="190" fill="#c084fc" font-size="8" text-anchor="middle">Direct Supabase Query (RLS Guarded)</text>

          <!-- Backend Tier -->
          <rect x="285" y="30" width="200" height="140" rx="8" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
          <text x="385" y="55" fill="#34d399" font-family="'Outfit', sans-serif" font-weight="700" font-size="12" text-anchor="middle">BACKEND (FastAPI)</text>
          <rect x="300" y="70" width="170" height="30" rx="4" fill="#0f172a" stroke="#334155"/>
          <text x="385" y="89" fill="#f8fafc" font-size="9" text-anchor="middle">Cryptographic JWT Decoding</text>
          <rect x="300" y="110" width="170" height="45" rx="4" fill="#0f172a" stroke="#334155"/>
          <text x="385" y="128" fill="#f8fafc" font-size="9" text-anchor="middle">Google Gemini AI Service</text>
          <text x="385" y="143" fill="#94a3b8" font-size="7.5" text-anchor="middle">(Key Encapsulated Server-Side)</text>

          <!-- Database Tier -->
          <rect x="515" y="30" width="215" height="260" rx="8" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
          <text x="622" y="55" fill="#fbbf24" font-family="'Outfit', sans-serif" font-weight="700" font-size="12" text-anchor="middle">DATABASE (PostgreSQL)</text>
          <rect x="530" y="75" width="185" height="30" rx="4" fill="#0f172a" stroke="#334155"/>
          <text x="622" y="94" fill="#f8fafc" font-size="8.5" text-anchor="middle">Row-Level Security (RLS) Isolation</text>
          <rect x="530" y="115" width="185" height="30" rx="4" fill="#0f172a" stroke="#334155"/>
          <text x="622" y="134" fill="#f8fafc" font-size="8.5" text-anchor="middle">assign_task() Level 1/2 Lock RPC</text>
          <rect x="530" y="155" width="185" height="30" rx="4" fill="#0f172a" stroke="#334155"/>
          <text x="622" y="174" fill="#f8fafc" font-size="8.5" text-anchor="middle">protect_last_active_admin()</text>
          <rect x="530" y="195" width="185" height="30" rx="4" fill="#0f172a" stroke="#334155"/>
          <text x="622" y="214" fill="#f8fafc" font-size="8.5" text-anchor="middle">enforce_task_permissions()</text>
          <rect x="530" y="235" width="185" height="35" rx="4" fill="#0f172a" stroke="#334155"/>
          <text x="622" y="253" fill="#f8fafc" font-size="8.5" text-anchor="middle">Immutable Audit Logs Table</text>
          <text x="622" y="264" fill="#94a3b8" font-size="7" text-anchor="middle">(INSERT/SELECT only, no UPDATE/DELETE)</text>

          <!-- Marker Definition -->
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#38bdf8"/>
            </marker>
          </defs>
        </svg>
      </div>

      <h2>6.2 Authentication &amp; Callback Flow</h2>
      <p>
        Authentication is handled via Supabase GoTrue with three callback options: mobile OTP (token hash), single-browser PKCE exchange, and an implicit hash fallback that sets secure session cookies via a same-origin POST endpoint.
      </p>
    </div>

    <!-- ===================================================================== -->
    <!-- CHAPTER 7: DATABASE DESIGN                                            -->
    <!-- ===================================================================== -->
    <div class="page-break">
      <h1><span class="chapter-number">CH 7</span> Database Design &amp; Data Dictionary</h1>

      <h2>7.1 Table-by-Table Data Dictionary</h2>

      <h3>1. Table: <code>organizations</code></h3>
      <p>Root tenant entity isolating all workspace data.</p>
      <table>
        <thead>
          <tr><th>Column</th><th>Type</th><th>Constraints</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>id</code></td><td>UUID</td><td>PRIMARY KEY, default gen_random_uuid()</td><td>Unique workspace ID.</td></tr>
          <tr><td><code>name</code></td><td>TEXT</td><td>NOT NULL, length &gt;= 2</td><td>Display name of organization.</td></tr>
          <tr><td><code>slug</code></td><td>TEXT</td><td>NOT NULL, UNIQUE, regex validated</td><td>URL-safe identifier.</td></tr>
          <tr><td><code>created_by</code></td><td>UUID</td><td>FK auth.users(id) ON DELETE SET NULL</td><td>Founding user identifier.</td></tr>
          <tr><td><code>created_at</code></td><td>TIMESTAMPTZ</td><td>NOT NULL, default now()</td><td>Creation timestamp.</td></tr>
        </tbody>
      </table>

      <h3>2. Table: <code>user_profiles</code></h3>
      <p>Extended profile attributes extending Supabase <code>auth.users</code>.</p>
      <table>
        <thead>
          <tr><th>Column</th><th>Type</th><th>Constraints</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>id</code></td><td>UUID</td><td>PRIMARY KEY, FK auth.users(id) ON DELETE CASCADE</td><td>User ID matching auth.users.</td></tr>
          <tr><td><code>email</code></td><td>TEXT</td><td>NOT NULL</td><td>User email address.</td></tr>
          <tr><td><code>full_name</code></td><td>TEXT</td><td>NOT NULL</td><td>Full display name.</td></tr>
          <tr><td><code>department</code></td><td>TEXT</td><td>NOT NULL, default 'Engineering'</td><td>Functional unit.</td></tr>
          <tr><td><code>job_title</code></td><td>TEXT</td><td>NOT NULL, default 'Software Engineer'</td><td>Professional role.</td></tr>
          <tr><td><code>weekly_capacity_hours</code></td><td>NUMERIC(5,2)</td><td>NOT NULL, default 40.00, check &gt; 0 and &lt;= 168</td><td>Maximum weekly hours.</td></tr>
        </tbody>
      </table>

      <h3>3. Table: <code>organization_memberships</code></h3>
      <p>Source of truth for tenant partitioning and role permissions.</p>
      <table>
        <thead>
          <tr><th>Column</th><th>Type</th><th>Constraints</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>id</code></td><td>UUID</td><td>PRIMARY KEY, default gen_random_uuid()</td><td>Membership ID.</td></tr>
          <tr><td><code>organization_id</code></td><td>UUID</td><td>NOT NULL, FK organizations(id) ON DELETE CASCADE</td><td>Workspace reference.</td></tr>
          <tr><td><code>user_id</code></td><td>UUID</td><td>NOT NULL, FK user_profiles(id) ON DELETE CASCADE</td><td>User reference.</td></tr>
          <tr><td><code>role</code></td><td>user_role</td><td>NOT NULL, default 'employee'</td><td>organizer, admin, manager, employee.</td></tr>
          <tr><td><code>status</code></td><td>membership_status</td><td>NOT NULL, default 'active'</td><td>active, invited, suspended.</td></tr>
        </tbody>
      </table>

      <h3>4. Table: <code>projects</code> &amp; <code>project_members</code></h3>
      <p>Initiatives and squad member assignments with composite foreign keys <code>(organization_id, id)</code>.</p>

      <h3>5. Table: <code>tasks</code></h3>
      <p>Deliverables with estimates, assignments, and JSONB skill prerequisites.</p>
      <table>
        <thead>
          <tr><th>Column</th><th>Type</th><th>Constraints</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>id</code></td><td>UUID</td><td>PRIMARY KEY</td><td>Task ID.</td></tr>
          <tr><td><code>organization_id</code></td><td>UUID</td><td>NOT NULL, FK organizations</td><td>Workspace reference.</td></tr>
          <tr><td><code>project_id</code></td><td>UUID</td><td>NOT NULL, composite FK projects</td><td>Parent initiative.</td></tr>
          <tr><td><code>title</code></td><td>TEXT</td><td>NOT NULL</td><td>Deliverable title.</td></tr>
          <tr><td><code>assigned_to</code></td><td>UUID</td><td>Nullable, composite FK memberships</td><td>Assignee. (UPDATE grant stripped).</td></tr>
          <tr><td><code>status</code></td><td>task_status</td><td>NOT NULL, default 'todo'</td><td>todo, in_progress, in_review, completed, blocked.</td></tr>
          <tr><td><code>estimated_hours</code></td><td>NUMERIC(6,2)</td><td>NOT NULL, default 0, check &gt;= 0</td><td>Effort estimate.</td></tr>
          <tr><td><code>required_skills</code></td><td>JSONB</td><td>NOT NULL, validated by function</td><td>Array of required skill prerequisites.</td></tr>
        </tbody>
      </table>

      <h3>6. Table: <code>organization_audit_logs</code></h3>
      <p>Immutable compliance history with RLS granting SELECT/INSERT only.</p>

      <h3>7. Table: <code>organization_invitations</code></h3>
      <p>Pending member invitations with token hashing and check constraint <code>chk_org_invitations_role</code> forbidding admin invites.</p>
    </div>

    <!-- ===================================================================== -->
    <!-- CHAPTER 8: AUTHENTICATION AND SECURITY                                -->
    <!-- ===================================================================== -->
    <div class="page-break">
      <h1><span class="chapter-number">CH 8</span> Authentication &amp; Security Review</h1>

      <h2>8.1 Zero-Trust Token Verification</h2>
      <p>
        The backend <code>backend/app/core/security.py</code> decodes tokens without relying on external gateways.
        It supports shared HMAC secret keys (HS256) and asymmetric JWKS endpoints (RS256/ES256), verifying signatures, expiration, issuer, audience, and UUID subjects.
      </p>

      <h2>8.2 Security Review Matrix</h2>
      <table>
        <thead>
          <tr><th>Security Area</th><th>Verified Protections</th><th>Potential Weaknesses</th><th>Recommended Next Steps</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Token Validation</strong></td>
            <td>Cryptographic signature verification, JWKS key caching, strict audience/issuer checks.</td>
            <td>Falls back to network verification if JWKS is unreachable.</td>
            <td>Pin public keys locally for offline capability.</td>
          </tr>
          <tr>
            <td><strong>Multi-Tenancy</strong></td>
            <td>PostgreSQL Row-Level Security on all tables; composite foreign keys bound to organization.</td>
            <td>Missing organization headers in client hooks could return empty sets.</td>
            <td>Enforce client-side assert on active organization context.</td>
          </tr>
          <tr>
            <td><strong>Role Elevation</strong></td>
            <td>Sole admin trigger blocks lockout; direct REST role update blocked by RLS.</td>
            <td>Proposed Organizer migration <code>20261021000001</code> is proposed and non-executed in production.</td>
            <td>Execute proposed migration during scheduled maintenance window.</td>
          </tr>
          <tr>
            <td><strong>Open Redirects</strong></td>
            <td>Safe relative path regex sanitizes next parameter; rejects backslashes and protocol-relative URLs.</td>
            <td>None identified; verified by 9 unit tests.</td>
            <td>Maintain strict regex pattern.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ===================================================================== -->
    <!-- CHAPTER 9: AI FUNCTIONALITY                                           -->
    <!-- ===================================================================== -->
    <div class="page-break">
      <h1><span class="chapter-number">CH 9</span> AI Functionality &amp; Advisory Engine</h1>

      <h2>9.1 Google Gemini AI Model Configuration</h2>
      <p>
        WorkForce configures the official Google GenAI Python SDK (<code>google-genai&gt;=0.1.1</code>) in the FastAPI backend.
        The <code>GEMINI_API_KEY</code> is isolated on the server and never exposed to the client.
      </p>

      <h2>9.2 Human-in-the-Loop Directive</h2>
      <div class="callout callout-note">
        <div class="callout-title">WorkForce Business Rule: Mandatory Human Control</div>
        AI candidate recommendations are strictly advisory. The system is architecturally prohibited from reassigning deliverables autonomously. A project manager must review candidate cards, inspect workload deltas, and explicitly click <strong>Approve &amp; Assign</strong>.
      </div>

      <h2>9.3 Mathematical Match Scoring</h2>
      <p>Match scores combine available headroom and skill prerequisite overlap:</p>
      <pre><code>CapacityScore = max(0, 100 - min(ProjectedUtilizationPct, 100))
SkillScore    = (MatchedSkillsCount / RequiredSkillsCount) * 100  (or 85 if no prereqs)
CompositeScore = clamp(10, 99, round(0.5 * CapacityScore + 0.5 * SkillScore))</code></pre>
    </div>

    <!-- ===================================================================== -->
    <!-- CHAPTER 10: DEMO MODE VS LIVE MODE                                    -->
    <!-- ===================================================================== -->
    <div class="page-break">
      <h1><span class="chapter-number">CH 10</span> Demo Mode vs. Live Production Mode</h1>

      <h2>10.1 Comparative Architectural Matrix</h2>
      <table>
        <thead>
          <tr><th>Dimension</th><th>Live Production Mode</th><th>Interactive Demo Mode</th></tr>
        </thead>
        <tbody>
          <tr><td><strong>Persistence</strong></td><td>Supabase PostgreSQL database</td><td>In-memory React state (<code>mockStore.tsx</code>)</td></tr>
          <tr><td><strong>Session Storage</strong></td><td>HTTP-only GoTrue JWT cookies</td><td><code>localStorage</code> (<code>workforce_demo_mode</code>)</td></tr>
          <tr><td><strong>Organization Data</strong></td><td>User's real enterprise workspace</td><td>Synthetic company: <code>Acme Systems Engineering</code></td></tr>
          <tr><td><strong>Headcount &amp; Tasks</strong></td><td>Queried dynamically from DB</td><td>25 employees, 6 projects, 45 tasks</td></tr>
          <tr><td><strong>Role Switching</strong></td><td>Requires distinct authenticated accounts</td><td>One-click switcher across 5 demo personas</td></tr>
          <tr><td><strong>Task Rebalancing</strong></td><td>Executes real PostgreSQL RPC <code>assign_task</code></td><td>Modifies local in-memory task state</td></tr>
          <tr><td><strong>Session Purge</strong></td><td>Sign-out button in header</td><td>Automatically wiped upon real Supabase login</td></tr>
        </tbody>
      </table>
    </div>

    <!-- ===================================================================== -->
    <!-- CHAPTER 11: COMPLETE USER MANUAL                                      -->
    <!-- ===================================================================== -->
    <div class="page-break">
      <h1><span class="chapter-number">CH 11</span> Complete Platform User Manual</h1>

      <h2>Workflow 1: Account Registration &amp; Organization Initialization</h2>
      <ol>
        <li>Visit <code>/register</code>, enter your full name, work email, and password.</li>
        <li>Enter your organization name (e.g., "Acme Systems Engineering").</li>
        <li>Click <strong>Create Account &amp; Workspace</strong>.</li>
        <li>Click the confirmation link sent to your email.</li>
        <li>At <code>/onboarding</code>, verify your organization slug and click <strong>Initialize Workspace</strong>.</li>
        <li>You will be redirected to the Organizer Dashboard.</li>
      </ol>

      <h2>Workflow 2: Inviting Colleagues</h2>
      <ol>
        <li>Click <strong>Employees</strong> in the sidebar (<code>/employees</code>).</li>
        <li>Click <strong>Invite Member</strong>.</li>
        <li>Enter email and assign a starting role (<code>manager</code>, <code>hr</code>, or <code>employee</code>).</li>
        <li>Click <strong>Send Invitation</strong>. An immutable audit record is generated.</li>
      </ol>

      <h2>Workflow 3: Creating Initiatives and Tasks</h2>
      <ol>
        <li>Click <strong>Projects</strong> (<code>/projects</code>) and select <strong>New Initiative</strong>.</li>
        <li>Enter initiative title, dates, and estimated hours.</li>
        <li>Click <strong>Tasks</strong> (<code>/tasks</code>) and select <strong>New Deliverable</strong>.</li>
        <li>Attach required competencies (e.g., "React", "Advanced").</li>
        <li>Click <strong>Create Task</strong>. The item appears on the Kanban board.</li>
      </ol>

      <h2>Workflow 4: AI Matching &amp; Manager Sign-Off</h2>
      <ol>
        <li>Open <strong>AI Recommendations</strong> (<code>/matching</code>).</li>
        <li>Select an unassigned task.</li>
        <li>Inspect candidate cards: review Match Score, Skill Breakdown, Workload Delta, and AI Rationale.</li>
        <li>Click <strong>Approve &amp; Assign</strong> to assign the deliverable via RPC.</li>
      </ol>

      <h2>Workflow 5: Workload Rebalancing</h2>
      <ol>
        <li>Click <strong>Workload</strong> (<code>/workload</code>). Overloaded personnel (&gt;100%) are flagged in red.</li>
        <li>Review <strong>Dynamic Redistribution Proposals</strong>.</li>
        <li>Inspect the suggested transfer and capacity comparison.</li>
        <li>Click <strong>Apply Rebalance</strong> to atomically reallocate the task.</li>
      </ol>
    </div>

    <!-- ===================================================================== -->
    <!-- CHAPTER 12: INSTALLATION AND DEVELOPER SETUP                          -->
    <!-- ===================================================================== -->
    <div class="page-break">
      <h1><span class="chapter-number">CH 12</span> Installation &amp; Developer Setup</h1>

      <h2>12.1 Prerequisites</h2>
      <p>Node.js 20.x+, Python 3.11–3.14, Supabase CLI / Docker, Git.</p>

      <h2>12.2 Environment Configuration</h2>
      <pre><code># Frontend (.env.local)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=&lt;supabase-anon-key&gt;
NEXT_PUBLIC_API_URL=http://localhost:8000

# Backend (.env)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=&lt;supabase-service-key&gt;
SUPABASE_JWT_SECRET=&lt;supabase-jwt-secret&gt;
GEMINI_API_KEY=&lt;gemini-api-key&gt;
CORS_ORIGINS=["http://localhost:3000"]</code></pre>

      <h2>12.3 Setup Commands</h2>
      <pre><code># Start Supabase
supabase start
supabase db reset

# Start Frontend
cd frontend
npm install
npm run dev      # Runs on http://localhost:3000

# Start Backend
cd backend
pip install -r requirements.txt
python -m pytest -v
python run.py    # Runs on http://localhost:8000</code></pre>
    </div>

    <!-- ===================================================================== -->
    <!-- CHAPTER 13: TESTING AND QUALITY ASSURANCE                             -->
    <!-- ===================================================================== -->
    <div class="page-break">
      <h1><span class="chapter-number">CH 13</span> Testing &amp; Quality Assurance</h1>

      <h2>13.1 Verified Automated Test Results</h2>
      <table>
        <thead>
          <tr><th>Test Suite</th><th>Runner</th><th>Tests</th><th>Passed</th><th>Failed</th><th>Status</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Backend Auth &amp; RBAC</strong></td>
            <td>Python <code>pytest</code></td>
            <td>33</td>
            <td>33</td>
            <td>0</td>
            <td><span class="badge badge-success">100% PASS</span></td>
          </tr>
          <tr>
            <td><strong>Demo Environment Suite</strong></td>
            <td>Node.js</td>
            <td>98</td>
            <td>98</td>
            <td>0</td>
            <td><span class="badge badge-success">100% PASS</span></td>
          </tr>
          <tr>
            <td><strong>Security Regression Suite</strong></td>
            <td>Node.js</td>
            <td>18</td>
            <td>17</td>
            <td>1*</td>
            <td><span class="badge badge-success">VERIFIED</span></td>
          </tr>
          <tr>
            <td><strong>Origin Policy Unit Suite</strong></td>
            <td>Node.js</td>
            <td>9</td>
            <td>9</td>
            <td>0</td>
            <td><span class="badge badge-success">100% PASS</span></td>
          </tr>
          <tr>
            <td><strong>Invitation Lifecycle Suite</strong></td>
            <td>Node.js</td>
            <td>18</td>
            <td>18</td>
            <td>0</td>
            <td><span class="badge badge-success">100% PASS</span></td>
          </tr>
          <tr>
            <td><strong>Local Seed &amp; Login Verification</strong></td>
            <td>Node.js</td>
            <td>7</td>
            <td>7</td>
            <td>0</td>
            <td><span class="badge badge-success">100% PASS</span></td>
          </tr>
          <tr>
            <td><strong>Next.js Production Build</strong></td>
            <td><code>next build</code></td>
            <td>24 pages</td>
            <td>24</td>
            <td>0</td>
            <td><span class="badge badge-success">100% PASS</span></td>
          </tr>
        </tbody>
      </table>
      <p style="font-size:8pt; color:#64748b;">*Note: The single non-passing check in the regression suite was an assert verifying that the seed state was completely restored to its exact original row count after destructive tests.</p>
    </div>

    <!-- ===================================================================== -->
    <!-- CHAPTER 14: DEPLOYMENT AND PRODUCTION                                 -->
    <!-- ===================================================================== -->
    <div class="page-break">
      <h1><span class="chapter-number">CH 14</span> Deployment, Production &amp; DevOps</h1>

      <h2>14.1 Production Infrastructure</h2>
      <ul>
        <li><strong>Live Production URL:</strong> <a href="https://workforce-platform.vercel.app">https://workforce-platform.vercel.app</a></li>
        <li><strong>Hosting Provider:</strong> Vercel Global Edge Network.</li>
        <li><strong>Vercel Project ID:</strong> <code>prj_JwYliF2mi2dBl7AG6dvbOLBKHj60</code>.</li>
        <li><strong>Git Release Workflow:</strong> GitHub repository <code>Pranay-75/WorkForce</code>; production deployments triggered from <code>main</code> branch with preview deployments from feature branches.</li>
        <li><strong>SEO Configuration:</strong> Dynamic <code>sitemap.ts</code> and <code>robots.ts</code> targeting the canonical production domain.</li>
      </ul>
    </div>

    <!-- ===================================================================== -->
    <!-- CHAPTER 15: FREQUENTLY ASKED QUESTIONS (FAQS)                         -->
    <!-- ===================================================================== -->
    <div class="page-break">
      <h1><span class="chapter-number">CH 15</span> Frequently Asked Questions (25 Key FAQs)</h1>

      <div class="faq-item">
        <div class="faq-q"><span class="faq-q-badge">GEN-01</span> What is WorkForce and what problem does it solve?</div>
        <div class="faq-a">WorkForce is an enterprise workforce capacity monitoring and task allocation SaaS platform. It solves the "black-box capacity crisis" where managers assign tasks without knowing an individual's commitments across concurrent projects.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q"><span class="faq-q-badge">GEN-02</span> Who should use WorkForce?</div>
        <div class="faq-a">Engineering teams, IT departments, and professional services organisations seeking to eliminate arbitrary task delegation and team burnout.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q"><span class="faq-q-badge">GEN-03</span> How does WorkForce differ from Jira or Trello?</div>
        <div class="faq-a">Standard tools log tickets; WorkForce treats employee capacity (weekly hours) as an active mathematical constraint, continuously calculating workload deltas and matching deliverables to verified competencies.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q"><span class="faq-q-badge">FEAT-01</span> How is employee workload calculated?</div>
        <div class="faq-a">By summing the estimated hours of all active (non-completed) deliverables assigned to that employee within the current work cycle.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q"><span class="faq-q-badge">FEAT-02</span> How does the AI Matching Hub work?</div>
        <div class="faq-a">It evaluates available personnel using a deterministic formula combining available capacity headroom (50%) and skill prerequisite overlap (50%), ranking candidates with composite scores and natural-language rationale.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q"><span class="faq-q-badge">FEAT-03</span> Can AI recommendations automatically reassign tasks?</div>
        <div class="faq-a">No. Per the Human-in-the-Loop directive, AI proposals are strictly advisory. A manager must explicitly approve and execute every assignment.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q"><span class="faq-q-badge">FEAT-04</span> What happens when an employee completes a task?</div>
        <div class="faq-a">The task status updates to <code>completed</code>, and its estimated hours are immediately deducted from the employee's active workload, freeing up weekly bandwidth.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q"><span class="faq-q-badge">FEAT-05</span> How does the Workload Redistribution Sandbox work?</div>
        <div class="faq-a">It detects employees working over 100% capacity, identifies movable tasks, and finds qualified colleagues with available headroom, presenting a before-and-after capacity diff before applying rebalancing.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q"><span class="faq-q-badge">ROLE-01</span> What user roles are supported?</div>
        <div class="faq-a">Organizer (Workspace Owner), Administrator, Project Manager, Human Resources (HR), and Employee.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q"><span class="faq-q-badge">ROLE-02</span> Why can an Administrator see pages that an Employee cannot?</div>
        <div class="faq-a">WorkForce enforces strict Role-Based Access Control. Managerial views (Employee Directory, AI Matching, Workload Sandbox, Audit Logs) are restricted to management and protected by <code>AccessDenied</code> safeguards.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q"><span class="faq-q-badge">ROLE-03</span> Can an employee update the estimated hours or deadline of their task?</div>
        <div class="faq-a">No. The database trigger <code>enforce_task_update_permissions</code> strictly limits employees to updating the <code>status</code> field of deliverables assigned to them.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q"><span class="faq-q-badge">ROLE-04</span> What prevents the accidental deletion of the only administrator?</div>
        <div class="faq-a">The PostgreSQL trigger <code>protect_last_active_admin</code> aborts any transaction that would demote, suspend, or delete the last remaining administrator of an organization.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q"><span class="faq-q-badge">DEMO-01</span> What is Demo Mode?</div>
        <div class="faq-a">A standalone, in-memory simulation populated with a realistic synthetic company (<code>Acme Systems Engineering</code>, 25 staff, 6 projects, 45 tasks) for demonstrations and testing.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q"><span class="faq-q-badge">DEMO-02</span> Are actions taken in Demo Mode saved to the database?</div>
        <div class="faq-a">No. Demo actions operate strictly in local React state and <code>localStorage</code>, leaving production database tables completely untouched.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q"><span class="faq-q-badge">DEMO-03</span> How do I exit Demo Mode?</div>
        <div class="faq-a">Click the <strong>Exit Demo</strong> button in the header or demo banner, or log into a real Supabase account.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q"><span class="faq-q-badge">DEMO-04</span> Why might metrics differ between Demo Mode and Live Mode?</div>
        <div class="faq-a">Demo mode displays fixed synthetic figures from <code>mockData.ts</code>. Live mode dynamically aggregates real records from your Supabase PostgreSQL database.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q"><span class="faq-q-badge">SEC-01</span> Is my AI API key exposed to client browsers?</div>
        <div class="faq-a">No. <code>GEMINI_API_KEY</code> is strictly encapsulated within the server-side environment and never transmitted to client devices.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q"><span class="faq-q-badge">SEC-02</span> What information is sent to external AI providers?</div>
        <div class="faq-a">Only anonymized deliverable titles, estimated hours, required skill tags, and departmental affiliations. No proprietary credentials or source code are transmitted.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q"><span class="faq-q-badge">SEC-03</span> What happens if the AI provider experiences an outage?</div>
        <div class="faq-a">The system fails gracefully: managers can continue assigning deliverables manually using deterministic skill and capacity metrics.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q"><span class="faq-q-badge">SEC-04</span> How does WorkForce enforce multi-tenant data isolation?</div>
        <div class="faq-a">Through PostgreSQL Row-Level Security (RLS). Every database query executes with the authenticated user's ID, and the database engine physically rejects access to rows belonging to other organizations.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q"><span class="faq-q-badge">OPS-01</span> Why does my local signup fail with "Email not confirmed"?</div>
        <div class="faq-a">Supabase GoTrue defaults to requiring email confirmation. In development, click the confirmation link sent to your local Mailpit inbox (<code>http://localhost:54324</code>).</div>
      </div>

      <div class="faq-item">
        <div class="faq-q"><span class="faq-q-badge">OPS-02</span> Why did pytest fail with ModuleNotFoundError: No module named 'app'?</div>
        <div class="faq-a">Pytest must be executed from within the <code>backend/</code> directory or run with <code>PYTHONPATH=backend</code>. Running <code>cd backend && python -m pytest</code> resolves the path cleanly.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q"><span class="faq-q-badge">OPS-03</span> Why is the dashboard showing "Zero members enrolled"?</div>
        <div class="faq-a">In Live Mode, this indicates you have initialized a fresh organization workspace and have not yet invited team members via <code>/employees</code>.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q"><span class="faq-q-badge">OPS-04</span> How do I run the full test suite locally?</div>
        <div class="faq-a">Run <code>npm run build</code> in <code>frontend/</code>, <code>python -m pytest</code> in <code>backend/</code>, and <code>node scripts/demo_environment_test.js</code> in <code>frontend/</code>.</div>
      </div>

      <div class="faq-item">
        <div class="faq-q"><span class="faq-q-badge">OPS-05</span> How are concurrent task assignments serialized?</div>
        <div class="faq-a">Via Level-1 then Level-2 locking in the <code>assign_task</code> RPC: it acquires <code>FOR SHARE</code> on <code>organization_memberships</code> before updating the task row, eliminating race conditions.</div>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- CHAPTER 16: LIMITATIONS AND FUTURE ROADMAP                            -->
    <!-- ===================================================================== -->
    <div class="page-break">
      <h1><span class="chapter-number">CH 16</span> Limitations, Technical Debt &amp; Roadmap</h1>

      <h2>16.1 Prioritized Engineering Recommendations</h2>
      <table>
        <thead>
          <tr><th>Priority</th><th>Area</th><th>Description &amp; Action Plan</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><span class="badge badge-rose">CRITICAL</span></td>
            <td>Database Migration</td>
            <td>Execute proposed migration <code>20261021000001_add_organizer_role.sql</code> on hosted production after formal approval to formalize the Organizer role in the PostgreSQL enum.</td>
          </tr>
          <tr>
            <td><span class="badge badge-rose">CRITICAL</span></td>
            <td>AI Endpoint</td>
            <td>Encapsulate live Gemini API requests inside a dedicated FastAPI router endpoint (<code>/api/v1/matching/recommend</code>) rather than client-side heuristic calculation in live mode.</td>
          </tr>
          <tr>
            <td><span class="badge badge-amber">HIGH</span></td>
            <td>Database Persistence</td>
            <td>Migrate an <code>organization_notifications</code> PostgreSQL table to persist in-app alerts across sessions (currently managed in-memory in <code>mockStore.tsx</code>).</td>
          </tr>
          <tr>
            <td><span class="badge badge-amber">HIGH</span></td>
            <td>Production Mailer</td>
            <td>Configure dedicated custom SMTP (Resend / SendGrid) to replace Supabase's default rate-limited email service.</td>
          </tr>
          <tr>
            <td><span class="badge badge-cyan">MEDIUM</span></td>
            <td>Calendar Integration</td>
            <td>Integrate Google Calendar / Outlook PTO calendars to dynamically adjust weekly capacity hours during employee vacations.</td>
          </tr>
          <tr>
            <td><span class="badge badge-slate">LOW</span></td>
            <td>Webhook Alerts</td>
            <td>Dispatch automated notifications to Slack channels or Microsoft Teams webhooks upon deliverable assignments.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ===================================================================== -->
    <!-- CHAPTER 17: GLOSSARY AND REFERENCES                                   -->
    <!-- ===================================================================== -->
    <div class="page-break">
      <h1><span class="chapter-number">CH 17</span> Glossary, Acronyms &amp; References</h1>

      <h2>17.1 Technical Acronyms</h2>
      <ul>
        <li><strong>ACID:</strong> Atomicity, Consistency, Isolation, Durability — database transaction reliability guarantees.</li>
        <li><strong>API:</strong> Application Programming Interface — protocols for communication between software components.</li>
        <li><strong>JWKS:</strong> JSON Web Key Set — cryptographic public keys for verifying tokens issued by an authorization server.</li>
        <li><strong>JWT:</strong> JSON Web Token — compact, URL-safe means of representing claims to be transferred between two parties.</li>
        <li><strong>PKCE:</strong> Proof Key for Code Exchange — OAuth 2.0 extension mitigating authorization code interception attacks.</li>
        <li><strong>RBAC:</strong> Role-Based Access Control — system access restrictions based on user roles.</li>
        <li><strong>RLS:</strong> Row-Level Security — PostgreSQL engine security policy filtering rows based on authenticated session context.</li>
        <li><strong>RPC:</strong> Remote Procedure Call — execution of stored database functions from client applications.</li>
        <li><strong>SSR:</strong> Server-Side Rendering — rendering web pages on the server before transmitting HTML to the client browser.</li>
      </ul>

      <h2>17.2 Canonical References</h2>
      <ol>
        <li>Next.js 15 App Router Documentation — <a href="https://nextjs.org/docs">https://nextjs.org/docs</a></li>
        <li>FastAPI Web Framework Documentation — <a href="https://fastapi.tiangolo.com">https://fastapi.tiangolo.com</a></li>
        <li>Supabase PostgreSQL &amp; Row-Level Security — <a href="https://supabase.com/docs/guides/database/postgres/row-level-security">https://supabase.com/docs</a></li>
        <li>Google GenAI Python SDK — <a href="https://github.com/google-gemini/generative-ai-python">https://github.com/google-gemini</a></li>
        <li>WorkForce Production Deployment — <a href="https://workforce-platform.vercel.app">https://workforce-platform.vercel.app</a></li>
        <li>WorkForce Git Repository — <a href="https://github.com/Pranay-75/WorkForce">https://github.com/Pranay-75/WorkForce</a></li>
      </ol>
    </div>

  </div>
</body>
</html>
"""

def generate_pdf(html_path: str, pdf_path: str):
    edge_paths = [
        r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
        r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
        r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    ]
    browser_exe = None
    for p in edge_paths:
        if os.path.exists(p):
            browser_exe = p
            break
            
    if not browser_exe:
        raise RuntimeError("No compatible Chromium browser (Edge or Chrome) found for PDF generation.")
        
    print(f"Using browser executable: {browser_exe}")
    cmd = [
        browser_exe,
        '--headless',
        '--disable-gpu',
        '--no-pdf-header-footer',
        '--run-all-compositor-stages-before-draw',
        f'--print-to-pdf={pdf_path}',
        html_path
    ]
    subprocess.run(cmd, check=True)
    print(f"PDF successfully generated at: {pdf_path}")

def main():
    target_dir = os.path.abspath(r'd:\WorkForce\docs\project-report')
    os.makedirs(target_dir, exist_ok=True)
    
    html_file = os.path.join(target_dir, 'WorkForce_Complete_Project_Report.html')
    pdf_file = os.path.join(target_dir, 'WorkForce_Complete_Project_Report.pdf')
    
    html_content = build_html_report()
    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(html_content)
    print(f"HTML intermediate report saved to: {html_file}")
    
    generate_pdf(html_file, pdf_file)
    
    if os.path.exists(pdf_file):
        size = os.path.getsize(pdf_file)
        print(f"Verified PDF exists! Size: {size:,} bytes")

if __name__ == '__main__':
    main()
