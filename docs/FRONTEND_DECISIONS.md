# LexiFlow Frontend Architecture Decisions

This document records all frontend architecture decisions made before coding began, based on discussions between Claude, GPT, and the developer. Each entry includes the conclusion, the reasoning, and relevant context.

When reviewing frontend code or making changes, check this document first to ensure consistency.

---

## F01: Use React + TypeScript + Vite

**Conclusion:** Frontend framework is React with TypeScript, scaffolded by Vite.

**Reason:** React is the most widely used frontend framework in the job market. TypeScript catches type errors early and aligns naturally with the backend's Pydantic type system. Vite provides fast dev server startup and HMR. No SSR needed — LexiFlow is a pure client-side SPA that fetches all data from the FastAPI backend.

**What we ruled out:** Next.js and Remix add a Node server layer that's unnecessary for a single-user local app. The extra complexity would hurt both development speed and interview explainability.

---

## F02: Use Tailwind CSS + shadcn/ui with scoped visual customization

**Conclusion:** Styling uses Tailwind CSS utility classes. Base UI components come from shadcn/ui, added via CLI as needed (e.g., `npx shadcn-ui add button`).

**Reason:** shadcn/ui copies component source code into the project rather than hiding it behind a package. This means every Button, Card, and Dialog is owned code that can be inspected and modified — a strong point for internship interviews ("I understand how this component works, not just its API"). Tailwind CSS is the dominant styling approach at US startups and appears frequently in job postings.

shadcn/ui components are added via the current official CLI, e.g. `npx shadcn@latest add button`.

**What we ruled out:** Ant Design skews toward enterprise admin dashboards, which doesn't match LexiFlow's lightweight tool aesthetic. MUI is mature but visually heavy. Pure CSS/CSS Modules are instructive but slow for MVP delivery.

**MVP constraint:** Keep shadcn/ui as the base component layer and avoid building a broad design system. Scoped visual customization is allowed where it directly supports the product experience, such as the ReviewPage gradient background, fixed term header, answer reveal area, and solid rating blocks. Do not add dark mode or a global theme overhaul in v0.1.

---

## F03: Use React Router v6 for SPA routing

**Conclusion:** Client-side routing via React Router v6. Primary app routes:

```
/                 → ReviewPage
/terms            → TermListPage
/terms/new        → AddTermPage
/terms/:id        → TermDetailPage
/terms/:id/edit   → EditTermPage
/me               → ProfilePage
/review           → redirect to /
```

**Reason:** The app is a client-side SPA — all data comes from FastAPI via HTTP, no server-side rendering needed. React Router v6 is the standard choice for this pattern.

**Why these routes:** The backend already exposes `PUT /terms/{term_id}`. Editing is a core workflow because users are encouraged to create terms quickly (only `term` is required) and fill in definition/examples/usage_context later. AddTermPage and EditTermPage share a `TermForm` component but live at different routes. The root route opens ReviewPage directly so the app starts at the core daily-review loop. `/review` remains as a compatibility redirect to `/`.

**Route ordering note:** Define `/terms/new` before `/terms/:id` in the route config. React Router v6 handles static-vs-dynamic ranking well, but explicit ordering is clearer for readers.

---

## F04: Use TanStack Query for server state management

**Conclusion:** All data that originates from the backend (terms list, term detail, today's review queue, review history) is managed by TanStack Query (React Query).

**Reason:** Nearly all state in LexiFlow is "server state" — cached copies of backend data. TanStack Query handles fetching, caching, background refetching, loading/error states, and cache invalidation out of the box.

**Critical pattern — review submission:**

```
User submits rating
  → POST /terms/{id}/reviews
  → Backend updates term (next_review_at, status, interval_days, repetitions, etc.)
  → Frontend invalidates todayReviews + terms queries
  → TanStack Query refetches fresh data from backend
```

The frontend never guesses how backend fields change. It submits the rating and trusts the response.

**What we ruled out:** Redux and Zustand solve client-side state (theme toggle, sidebar open/close). LexiFlow v0.1 has almost no client-side state, so these add complexity without benefit.

---

## F05: Do not use Redux or Zustand in v0.1

**Conclusion:** No global state library. Use TanStack Query for server state and React's built-in `useState` for simple UI state (e.g., modal open, form field values).

**Reason:** There is no client-side state complex enough to justify a dedicated store. If future features (user preferences, complex editor state) require one, Zustand is the lightest option to add later.

---

## F06: Use React Hook Form for term forms

**Conclusion:** AddTermPage and EditTermPage use React Hook Form to manage form state, validation, and submission.

**Reason:** The term form has 6 fields (term, language, definition, examples, usage_context, tags). Managing these with individual `useState` calls creates boilerplate and makes validation awkward. React Hook Form reduces boilerplate, manages validation, error messages, and submit state cleanly.

**Shared component:** Both Add and Edit pages render a `TermForm` component. AddTermPage passes no initial values. EditTermPage pre-fills from `GET /terms/{id}` response.

---

## F07: Use axios through a centralized API layer

**Conclusion:** HTTP requests go through an axios instance configured in `src/api/client.ts`. Only files under `src/api/` may import or call axios. Pages and components access data through hooks, never through axios directly.

**Reason:** This mirrors the backend's rule that routers never write SQLAlchemy queries — they call `crud.py`. Same principle: separate "how we talk to the server" from "what the UI renders."

**Structure:**

```
src/api/
  client.ts       → axios instance with baseURL from env var
  terms.ts        → getTerms(), getTerm(), createTerm(), updateTerm(), deleteTerm()
  reviews.ts      → getTodayReviews(), submitReview(), getTermReviews()
```

**Environment variable:** `VITE_API_BASE_URL` defaults to `http://localhost:8000`.

---

## F08: Manually define API types in src/types/api.ts

**Conclusion:** TypeScript interfaces for API request/response shapes are hand-written in `src/types/api.ts`, kept aligned with backend `schemas.py`.

**Reason:** The backend has only 2 models and ~7 schemas. Hand-writing types takes 5 minutes and avoids the toolchain overhead of OpenAPI code generation (openapi-typescript, build steps, generated code maintenance). When the project grows to 20+ endpoints, reconsider auto-generation.

**Core types:**

```typescript
type TermStatus = "new" | "learning" | "mastered";
type ReviewRating = "forgot" | "hard" | "good" | "easy";
type ReviewMode = "flashcard" | "typing";

interface Term { id: number; term: string; status: TermStatus; ... }
interface TermCreate { term: string; language?: string; ... }
interface TermUpdate { term?: string; language?: string; ... }
interface ReviewCreate { rating: ReviewRating; }
interface ReviewLog { id: number; term_id: number; rating: ReviewRating; ... }
interface TodayReviewsResponse { due_reviews: Term[]; new_terms: Term[]; }
```

**Naming convention:** Response types end with `Response` when it helps clarity (e.g., `TodayReviewsResponse`). Model types like `Term` don't need the suffix since they map directly to the backend model.

---

## F09: MVP review interaction is flashcard reveal + rating buttons

**Conclusion:** The ReviewPage MVP implements flashcard-style review only:

```
Top fixed area: term + language/tags
  → User taps the lower recall area
Lower revealed area: definition + examples + usage_context
  → User clicks 认识 / 模糊 / 忘记
  → Next card (or completion screen)
```

**Reason:** Input-based (typing) review introduces significant complexity: case sensitivity, whitespace handling, multi-language approximate matching, typo tolerance. These are real problems but not MVP problems.

**Future extensibility:** The `ReviewMode` type is defined from day one:

```typescript
type ReviewMode = "flashcard" | "typing";
```

MVP only implements the `"flashcard"` branch. Adding typing mode later means adding a new component and a conditional render, not restructuring the page.

**Rating mapping:** The UI uses three learner-friendly rating buttons. They map to the existing backend `ReviewRating` values without changing the API: 认识→`good`, 模糊→`hard`, 忘记→`forgot`. The `easy` backend rating remains available for future UI expansion, but the current ReviewPage does not expose it. The buttons must not display predicted scheduling dates; the backend remains the single source of truth for interval and next-review calculations.

**Queue ordering:** The review page must present `due_reviews` and `new_terms` as distinct groups, not merged into a single shuffled queue. This preserves the user's ability to see "how many reviews vs how many new terms today" and supports future controls for daily new-term limits or review/new ratio adjustments.

---

## F10: Do not duplicate backend scheduler logic in the frontend

**Conclusion:** The frontend never calculates `next_review_at`, `interval_days`, status transitions, or any scheduling values. It submits a rating and uses whatever the backend returns.

**Reason:** The scheduler is the component most likely to be upgraded (from simple mapping to SM-2). If the frontend has its own copy of scheduling logic, every algorithm change requires updating two places. The backend is the single source of truth for scheduling.

**What the frontend displays:** After submitting a review, show the updated term data from the backend response (new status, next review date). Do not predict these values client-side.

---

## F11: Frontend converts UTC timestamps to local display time

**Conclusion:** The backend stores and returns all timestamps in UTC (as established in backend decision D09). The frontend is responsible for converting UTC to the user's local timezone for display.

**Reason:** Backend stays timezone-agnostic. Display logic belongs in the presentation layer. A utility function in `src/lib/utils.ts` handles the conversion so it's consistent across all pages.

---

## F12: Organize src/ by responsibility, not by feature domain

**Conclusion:** Top-level `src/` directories are organized by what the code does, not which feature it belongs to:

```
src/
  api/           → HTTP request functions (axios calls)
  hooks/         → Custom React hooks (TanStack Query wrappers)
  pages/         → Page-level components, one per route
  components/    → Reusable UI components
    ui/          → shadcn/ui generated components
  types/         → TypeScript type definitions
  lib/           → Utility functions
```

**Reason:** LexiFlow has only two feature domains (terms and reviews). Feature-based folders (`features/terms/`, `features/reviews/`) would add nesting depth without reducing complexity. Responsibility-based organization mirrors the backend structure (routers/, utils/, models/) and is easier to navigate at this scale.

**Component organization:** Start with components flat under `components/`. If the count grows past ~10 and feels cluttered, add shallow grouping (`components/terms/`, `components/review/`, `components/layout/`). Don't pre-organize — let the need emerge.

---

## F13: ReviewPage MVP uses useState, not useReducer

**Conclusion:** The ReviewPage manages local UI state with `useState`:

```typescript
const [currentIndex, setCurrentIndex] = useState(0);
const [isRevealed, setIsRevealed] = useState(false);
```

Combined with TanStack Query's mutation `isPending` for submit-in-progress state.

**Reason:** `useReducer` is the right tool when state transitions become complex or interdependent. For MVP, the review flow has only two pieces of local state (which card, whether flipped). Starting with `useState` is more readable and easier to debug for a developer still learning React patterns.

**Upgrade path:** If the review page grows (typing mode, streak tracking, undo, animation state), refactor to `useReducer` with explicit action types. This is a localized refactor within one page, not an architectural change.

---

## Build Plan

Development order is designed to reach the core product loop as fast as possible: **create term → see it in today's queue → review it → see updated schedule**.

```
Step 1:  Initialize Vite + React + TypeScript, Tailwind CSS, and shadcn/ui.

Step 2:  Create API foundation.
         - Configure axios client with VITE_API_BASE_URL.
         - Test backend connection with GET /health (temporary helper or manual browser/curl check).
         - Define API types in src/types/api.ts.

Step 3:  Create app shell.
         - Add React Router with ReviewPage at /, term routes, /me, and /review redirect.
         - Add TanStack Query provider.
         - Add AppLayout with bottom navigation.
         - Create placeholder pages for all routes.

Step 4:  Build AddTermPage.
         - Use React Hook Form.
         - Submit POST /terms.
         - Redirect or show success state after creation.
         (This comes first because ReviewPage needs terms to exist.)

Step 5:  Build ReviewPage.
         - Fetch GET /reviews/today.
         - Show due_reviews first, then new_terms.
         - Fixed term header → lower-area reveal → rate → next card → completion.
         - Submit rating via POST /terms/{id}/reviews.
         - Invalidate queries after submission.

Step 6:  Build TermListPage.
         - Fetch GET /terms with pagination.
         - Add status filter and tag filter.
         - Link to detail and edit pages.

Step 7:  Build TermDetailPage.
         - Fetch GET /terms/{id}.
         - Fetch GET /terms/{id}/reviews for review history.
         - Display term fields and history timeline.

Step 8:  Build EditTermPage.
         - Reuse TermForm component from Step 4.
         - Pre-fill from GET /terms/{id}.
         - Submit PUT /terms/{id}.
         - Handle clearing tags with explicit empty list.

Step 9:  Fold HomePage into ReviewPage empty state and add ProfilePage.
         - / opens ReviewPage directly.
         - Empty state offers Add Term and Browse Terms actions.
         - Bottom navigation keeps three tabs: 复习, 词条, 我的.

Step 10: Polish.
         - Loading states (skeleton or spinner).
         - Error states (network failure, 404, 422).
         - Empty states (no terms yet, no reviews due).
         - Basic responsive layout for mobile.
         - Small transitions where they improve UX.
```

---

## What is NOT in Frontend v0.1

- Dark mode or global custom theme overhaul
- Typing-based review mode
- Daily statistics dashboard
- Drag-and-drop or complex animations
- PWA / offline support
- User authentication UI
- Deployment configuration
- E2E testing (Playwright/Cypress)
- Internationalization (i18n)

---

## Product Alignment Decisions

These guard against the frontend drifting into a generic CRUD app. They encode the product vision, not technical choices.

---

### P01: LexiFlow remains content-source agnostic

**Conclusion:** The app must not assume where definitions, examples, or usage contexts come from. They may be written by the user, copied from books, generated by external AI tools, or collected from real-world usage.

**Reason:** LexiFlow's core value is "you manage what to remember, we manage when to review." It is not an AI-powered flashcard generator. The UI should say "Add your own definition" rather than "Generate with AI." If prompt templates or AI integration are added in future versions, they remain optional conveniences, not core features.

**Practical impact on UI:** AddTermPage should use neutral labels ("Term or phrase", "Definition", "Examples") and textarea placeholders that acknowledge multiple sources (e.g., "Paste from your notes, reading, or AI-generated output") without privileging any single one.

---

### P02: Term creation supports quick capture and later enrichment

**Conclusion:** The AddTerm flow must make `term` the only required field. All other fields should look and feel optional. The UI should support the workflow: capture now, enrich later.

**Reason:** Users encountering a new term — in a meeting, while reading, during conversation — should be able to save it in seconds with zero friction. Requiring a complete definition upfront conflicts with this "quick capture" use case. The backend already enforces this (only `term` is required per D19), but the frontend must reinforce it visually: optional fields should not demand attention or feel like empty gaps that need filling.

---

### P03: The UI must support arbitrary languages, phrases, and domain-specific terms

**Conclusion:** The frontend must not assume English-only single words. Input fields must handle multilingual text, multi-word phrases, technical jargon, and long examples. UI copy should use "term", "phrase", or "expression" — never "word" alone.

**Reason:** The product exists specifically because existing flashcard apps don't serve users studying specialized terminology, niche language patterns, or multilingual phrases. If the frontend's labels, input widths, placeholder text, or layout assumptions break for non-English or multi-word inputs, it undermines the core product promise.

**Practical impact:** Use textarea (not single-line input) for `examples` and `usage_context`. Do not constrain `language` to a dropdown of common languages — a free text input (with optional suggestions) is more flexible. Test with real multilingual content during development (e.g., Japanese phrases, Chinese technical terms, long English idioms).
