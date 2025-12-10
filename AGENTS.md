# 🤖 Triage Tracker — Agent Execution Guide

This document defines how AI coding agents MUST operate within the Triage Tracker repository.  
Agents must follow all standards, conventions, and design rules documented here.

Failure to follow these rules will result in inconsistent UI, broken architectural boundaries, or schema drift.  
Do **not** generate code outside these guidelines.

---

# 📁 Repository Structure Overview

- `/frontend` — Vue 3 + TypeScript + Vite + Tailwind v4 + DaisyUI v5
- `/backend` — NestJS API + Prisma ORM + Worker services
- `/docker-compose.dev.yml` — Local development stack (Postgres, Redis, RedisInsight)
- `/docs` — UI rules, ORM rules, architectural specifications

Agents MUST consult all relevant documents before generating or modifying code.

---

# 🎨 UI Development Rules

## Agents MUST follow:

### **`frontend/docs/ui-consistency-contract.md`**

This is the primary authority for UI:

- No custom inline CSS
- Only approved spacing & radius scale
- Only semantic DaisyUI classes
- Use the provided UI primitives (`UiButton`, `UiCard`, etc.)
- Form fields must use `UiFormField`

---

### **`frontend/docs/agents-ui-usage.md`**

Agents MUST:

- Import UI components from `@/components/ui`
- Use the AppShell layout patterns
- Follow the theme rules (`nord` / `nord-dark`)
- Avoid arbitrary Tailwind classes

---

## Notifications

Agents MUST use the application's notification system for user-facing errors and confirmations in the UI. Use the `useNotifications` composable (e.g. `const { success, error } = useNotifications()`) to surface errors instead of silently ignoring failures or using `console.error`. Non-fatal failures that affect user operations should still surface a brief error notification.


## ⚠️ IF A UI pattern is not supported:

Agents MUST update the shared UI component library — NOT create ad-hoc styles in pages.

---

# 💾 Backend & Database Rules

## Agents MUST follow:

### **`prisma_integration_spec.md`**

This defines:

- ORM: Prisma
- How to modify `schema.prisma`
- How to generate and **run** new database migrations
- What commands to use to apply migration changes
- How to incorporate new fields or relations
- How NestJS modules integrate with Prisma
- The structure of Incidents, Timeline Events, and Summaries

**When migrations change**, agents MUST run the following command to apply them:

```bash
docker compose -f docker-compose.dev.yml exec api npx prisma migrate deploy
```

Agents MUST NOT:

- Introduce raw SQL migrations unless explicitly asked
- Create database schemas in code
- Duplicate models or drift from schema.prisma

---

# ⚙️ Backend Architecture Rules

The backend consists of:

1. **API service (`src`)**
2. **Worker service (`src/worker`)**
3. **BullMQ queueing (via Redis)** — for background tasks
4. **Prisma ORM** — single source of truth for models
5. **Postgres** — primary datastore

Agents MUST:

- Keep API controllers thin
- Implement core logic in service classes
- NEVER query the database directly (use PrismaService)
- Use dependency injection as per NestJS conventions
- Place worker-related logic in `worker/` modules

---

# 🧠 Worker Agent Rules

The worker service handles:

- AI summary generation
- Processing Slack events
- Running scheduled tasks
- Writing timeline events + summaries into Postgres

Agents MUST ensure:

- No UI logic runs in the worker
- No API-layer imports are introduced
- Prisma interactions follow the schema spec
- Timeline events use the enums provided in `schema.prisma`

---

# 🧩 Frontend → Backend Interface Rules

When modifying frontend API calls:

Agents MUST:

- Use the correct endpoints defined in backend controllers
- Handle errors gracefully
- Maintain type safety using TypeScript
- Never hardcode backend URLs (use environment variables when applicable)

---

# 🧪 Testing & Validation Rules

Agents should:

- Add lightweight tests when modifying backend flows
- Follow NestJS testing conventions (module isolation)
- Avoid snapshot tests for dynamic UI

---

# 📚 Agent Workflow Summary

When asked to implement or update a feature:

1. **Read the relevant design documents**

   - `frontend/docs/ui-consistency-contract.md`
   - `frontend/docs/agents-ui-usage.md`
   - `prisma_integration_spec.md`

2. **Locate the correct module(s)**  
   Do NOT create duplicate modules or abandon existing patterns.

3. **Implement changes while respecting boundaries**

   - Frontend → Vue components + API calls
   - Backend → NestJS modules + Prisma queries
   - Worker → Background tasks + BullMQ processors

4. **Run through the UI or API checklist**  
   Ensure no violations of the UI contract or ORM schema.

5. **Avoid architectural drift**  
   All new capabilities MUST fit the existing layout.

---

# 🏁 Final Notes to Agents

- When in doubt: **update shared abstractions**, not individual pages/services.
- Do NOT guess schema or styling rules — always consult the documented sources.
- If a task conflicts with a design rule, notify the user instead of improvising.
- Keep your changes organized, typed, and consistent with project conventions.

Thank you for contributing to Triage Tracker.  
Follow this document strictly.
