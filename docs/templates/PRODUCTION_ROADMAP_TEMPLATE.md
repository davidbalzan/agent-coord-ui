---
title: "Production Roadmap Template"
tags: [agent-coord-ui/template]
aliases: ["Roadmap Template"]
---

# [Project Name] - Production Roadmap

> Single source of truth for the project's journey from current state to production readiness. Updated as phases progress and priorities shift.

---

## 🎯 Current Focus

**Phase**: Phase [N] - [Phase Name — the active development phase]
**Task**: [Current task name — the specific work item being executed right now]
**Status**: [🚧 In Progress / ⏸️ Blocked / ✅ Complete — current execution status]
**Branch**: `[branch-name — the git branch where active work is happening]`
**Blocking Issues**: [List any blockers preventing progress, or "None" if unblocked]

---

## 📊 Current State Assessment

### ✅ What We Have

- [Feature/capability that is built and working — describe functional state, e.g., "Authentication with JWT tokens, tested against PostgreSQL"]
- [Feature/capability that is built and working — include quality indicators like test coverage or performance metrics]
- [Feature/capability that is built and working — note any limitations or known issues]
- [Infrastructure that is set up — e.g., "CI/CD pipeline with GitHub Actions, deploys to staging on merge"]

### 🚨 What's Missing for Production

- [Critical gap — describe what's missing, why it matters, and the risk of shipping without it, e.g., "Rate limiting: API is vulnerable to abuse without request throttling"]
- [Critical gap — describe impact on users/business, e.g., "Error monitoring: No visibility into production failures, mean time to detect is unknown"]
- [Critical gap — describe technical debt or quality concern, e.g., "Test coverage at 45%: Key user flows untested, refactoring is risky"]
- [Critical gap — describe operational concern, e.g., "No database backup strategy: Single point of failure for all user data"]

### 📈 Production Readiness Score

- **Functional Completeness**: [X]% — [Brief explanation of what's included in this assessment]
- **Test Coverage**: [X]% — [Current coverage and target, e.g., "45% current → 80% target"]
- **Security Posture**: [Low/Medium/High] — [Brief assessment, e.g., "Auth works but no rate limiting, CORS too permissive"]
- **Operational Readiness**: [Low/Medium/High] — [Brief assessment, e.g., "No monitoring, no alerting, manual deploys"]

---

## 🗺️ Phase Overview

### Phase 1: [Phase Name — e.g., "Foundation & Core Infrastructure"]

**Goal**: [One-liner that describes the measurable outcome of this phase, e.g., "Users can sign up, log in, and access the main dashboard with data persisted in PostgreSQL"]
**Duration**: [X] weeks — [Brief justification for estimate, e.g., "Based on 3 major features with 2-3 day estimates each"]
**Status**: [🟢 Complete / 🟡 In Progress / ⚪ Not Started]

**Key Deliverables**:

- [ ] [Deliverable with acceptance criteria — e.g., "User authentication: signup, login, logout, password reset flows all functional with email verification"]
- [ ] [Deliverable with acceptance criteria — e.g., "Database schema: Core tables created with migrations, seeding script for dev data"]
- [ ] [Deliverable with acceptance criteria — e.g., "API health monitoring: /health endpoint returns status, uptime, and version"]

**Dependencies**: [What must exist before this phase starts — e.g., "None — this is the foundation phase"]
**Risks**: [Primary risk and mitigation — e.g., "Schema design may need revision; mitigate by starting with minimal viable schema"]

---

### Phase 2: [Phase Name — e.g., "Core Features & Business Logic"]

**Goal**: [One-liner measurable outcome, e.g., "All primary user workflows are functional, tested, and performant under expected load"]
**Duration**: [X] weeks — [Brief justification]
**Status**: [🟢 Complete / 🟡 In Progress / ⚪ Not Started]

**Key Deliverables**:

- [ ] [Deliverable with acceptance criteria — describe what "done" looks like for this feature]
- [ ] [Deliverable with acceptance criteria — include measurable targets where possible]
- [ ] [Deliverable with acceptance criteria — note integration points with other phases]

**Dependencies**: [What must be complete — e.g., "Phase 1 complete: auth, database, and core API operational"]
**Risks**: [Primary risk — e.g., "Third-party API integration may have rate limits; mitigate with caching layer"]

---

### Phase 3: [Phase Name — e.g., "Polish, Security & Production Hardening"]

**Goal**: [One-liner measurable outcome, e.g., "Application is secure, performant, monitored, and ready for public launch"]
**Duration**: [X] weeks — [Brief justification]
**Status**: [🟢 Complete / 🟡 In Progress / ⚪ Not Started]

**Key Deliverables**:

- [ ] [Deliverable with acceptance criteria — e.g., "Rate limiting: 100 req/min per IP on public endpoints, 1000 req/min for authenticated"]
- [ ] [Deliverable with acceptance criteria — e.g., "Error monitoring: Sentry integrated, alerts configured for error rate > 1%"]

**Dependencies**: [What must be complete — e.g., "Phase 2 complete: all core features functional and tested"]
**Risks**: [Primary risk — e.g., "Performance optimization may reveal architectural issues; budget extra time for refactoring"]

---

## 📊 Implementation Priority Matrix

| Phase           | Priority                            | Blocks Other Phases?           | Complexity                              | Duration  | Key Risk                |
| --------------- | ----------------------------------- | ------------------------------ | --------------------------------------- | --------- | ----------------------- |
| Phase 1: [Name] | [🔴 Critical / 🟡 High / 🟢 Medium] | [Yes → blocks Phase 2, 3 / No] | [Low/Medium/High — brief justification] | [X weeks] | [One-line risk summary] |
| Phase 2: [Name] | [Priority]                          | [What it blocks]               | [Complexity]                            | [X weeks] | [Risk summary]          |
| Phase 3: [Name] | [Priority]                          | [What it blocks]               | [Complexity]                            | [X weeks] | [Risk summary]          |

**Critical Path**: [Describe the sequence of dependent phases that determines the minimum project duration, e.g., "Phase 1 → Phase 2 → Phase 3 (sequential, ~12 weeks total)"]

---

## ⚡ Quick Wins (Can Start Immediately)

> Tasks that provide immediate value with minimal risk and effort. Execute these in parallel with phase work.

1. **[Quick win name]** ([estimated duration, e.g., "2 hours"])
   - [What to do — be specific enough that a developer can start immediately]
   - [Expected impact — e.g., "Reduces page load by ~200ms" or "Fixes confusing error message"]
   - [How to validate — e.g., "Run lighthouse audit, confirm score > 90"]

2. **[Quick win name]** ([estimated duration])
   - [What to do]
   - [Expected impact]

3. **[Quick win name]** ([estimated duration])
   - [What to do]
   - [Expected impact]

---

## 📈 Success Metrics

### Technical Metrics

- [ ] [Metric with specific target — e.g., "API response time: p95 < 200ms for all endpoints"]
- [ ] [Metric with specific target — e.g., "Test coverage: > 80% line coverage across all packages"]
- [ ] [Metric with specific target — e.g., "Build time: < 60 seconds for full production build"]
- [ ] [Metric with specific target — e.g., "Zero critical/high severity security vulnerabilities"]

### Business Metrics

- [ ] [Metric with specific target — e.g., "User onboarding: < 2 minutes from signup to first value"]
- [ ] [Metric with specific target — e.g., "Uptime: 99.9% availability during business hours"]

### Operational Metrics

- [ ] [Metric with specific target — e.g., "Mean time to detect failures: < 5 minutes"]
- [ ] [Metric with specific target — e.g., "Deployment frequency: ability to deploy multiple times per day"]

---

## 🔄 Revision History

| Date                       | Change                  | Reason                                     |
| -------------------------- | ----------------------- | ------------------------------------------ |
| [Date of initial creation] | Initial roadmap created | [Project kickoff / sprint planning / etc.] |

---

## 🔗 Related Documents

- **[[TECH_STACK|Tech Stack]]** - Technology choices and versions
- **[[ARCHITECTURE_GUIDE|Architecture Guide]]** - System design and patterns
- **[[DECISIONS|Decisions Log]]** - Architectural Decision Records
- **[Phase Details](./phases/)** - Detailed phase task breakdowns with checklists
- **[[CURRENT_FOCUS|Current Focus]]** - What's actively being worked on right now
