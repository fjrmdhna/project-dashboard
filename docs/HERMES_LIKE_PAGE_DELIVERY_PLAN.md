# TLM Page Delivery Plan

## 1. Objectives & Success Criteria
- Deliver the TLM dashboard page with complexity and interaction parity to `src/app/hermes-5g/page.tsx`.
- Keep end-to-end load (TTFB + hydration) under 2.5s on a mid-tier device over 4G, measured via Lighthouse P90.
- Maintain server cost targets by reusing existing Supabase datasets or limiting new queries to <3 per view.
- Ship with full observability: tracers for key API routes and baseline Web Vitals in Vercel Analytics.

## 2. Scope & Assumptions
- The page targets authenticated internal users with existing role definitions; no new auth flows required.
- Visual design follows existing Hermes design system tokens (`globals.css`, shared card components).
- Data resides either in existing Hermes Supabase schemas or in extension tables with defined indexes.
- No breaking changes to current Hermes flows; shared hooks must remain backwards compatible.

## 3. Architecture Overview
- **Routing**: register the page under `src/app/tlm/page.tsx` with co-located `layout.tsx` when needed.
- **Data Layer**: prefer SSR with incremental caching (`revalidateTag`) for semi-static sections; fall back to client SWR for highly interactive widgets.
- **API Surface**: add lean handler modules in `src/app/api/tlm/*/route.ts`, reusing helpers from `src/lib/hermes-5g-utils.ts`.
- **Caching**: adopt the `useApiCache` hook pattern; tag server responses so `POST /revalidate` can refresh targeted widgets.
- **Error Handling**: extend `FilterContext` and `Hermes5GContext` patterns to expose loading/error states to cards.

## 4. Data Contract & Supabase Work
- Document request/response payloads for each endpoint in `docs/api/tlm.md`.
- For new queries, create Supabase SQL snippets with:
  - Parameterized filters aligned to UI controls (date range, vendor, region, etc.).
  - Covering indexes on filtered columns; validate plans via `EXPLAIN ANALYZE`.
- Add RLS rules mirroring Hermes policies, and update `supabase.ts` types via `supabase gen types`.

## 5. UI/UX Design Track
- Produce annotated wireframes covering desktop (1920x1080) and wallboard (1080x1920) breakpoints.
- Define skeleton/loading states per card, referencing `FiveGActivatedCard.tsx` and other precedents.
- Confirm filter interactions (single vs. multi-select) and update shared components (`FilterBar.tsx`, `MultiSelect.tsx`) if behavior diverges.
- Schedule design sign-off before engineering kicks off Feature Implementation phase.

## 6. Implementation Phases
1. **Planning & Setup (1-2d)**
   - Align on KPI list, data sources, and ownership.
   - Stub page route, layout, and feature flag (e.g., `NEXT_PUBLIC_ENABLE_<SEGMENT>`).
2. **Data Layer Build (3-5d)**
   - Implement API routes with typed handlers and unit tests (`route.test.ts`).
   - Add Supabase migrations/index scripts; run against staging.
3. **UI Assembly (4-6d)**
   - Compose reusable cards; create new ones under `src/components/cards`.
   - Integrate hooks (`useTopIssueData`, etc.) or create analogues with shared utility functions.
4. **Integration & Polish (2-3d)**
   - Wire filters, contexts, and global layout elements.
   - Add analytics instrumentation (button clicks, filter usage) using existing telemetry hooks.
5. **Hardening (2d)**
   - Cross-browser QA, responsive checks on Wallboard layout.
   - Performance tune (bundle analyzer, React Profiler), ensure lazy imports for heavy charts.

## 7. Testing Strategy
- **Unit**: API route handlers, hooks, and utility functions using Jest setup already in repo.
- **Integration**: Playwright or Cypress smoke covering filter-to-card data flow.
- **Performance**: Automated Lighthouse CI via Vercel or GitHub Actions; capture metrics pre/post launch.
- **Regression**: Maintain Hermes regression suite to ensure shared components remain stable.

## 8. Deployment & Release
- Use preview deployments for stakeholder validation; gate main branch merge on QA checklist.
- Run `next build` and Supabase migrations in staging pipeline before production promotion.
- Roll out behind feature flag; perform progressive exposure (0% → 25% → 100%) while monitoring logs.
- Document rollback plan: toggle feature flag off, revert API route to return 503 cached response if necessary.

## 9. Observability & Maintenance
- Instrument API routes with request timing and error counters (OpenTelemetry if available).
- Configure Vercel alerts for elevated TTFB or Edge Function failures tied to new endpoints.
- Schedule post-launch review (T+7 days) to analyze usage, Supabase query costs, and backlog next steps.
- Keep plan updated in this document; record decisions and deviations for future audit.
