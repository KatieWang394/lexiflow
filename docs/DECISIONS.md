# LexiFlow Architecture Decisions

This document records all architecture and implementation decisions made before coding began. Each entry includes the conclusion, the reasoning, and which files are affected.

When reviewing code or making changes, check this document first to ensure consistency.

---

## D01: Use FastAPI instead of Flask

**Conclusion:** Backend framework is FastAPI.

**Reason:** FastAPI has built-in async support (even though we use sync for now), automatic OpenAPI docs, native Pydantic integration, and dependency injection. Combined with SQLAlchemy and Pydantic, it forms a standard, resume-worthy Python backend stack.

**Impacted files:** main.py, all routers, requirements.txt.

---

## D02: Use synchronous SQLAlchemy ORM, not async or raw SQL

**Conclusion:** Synchronous SQLAlchemy ORM. No async, no aiosqlite, no raw SQL strings.

**Reason:** This is a local SQLite project. Async adds complexity (aiosqlite, async_sessionmaker, event loop issues) with no performance benefit. ORM gives us type safety, relationship management, and a cleaner resume narrative than hand-written SQL.

**Impacted files:** database.py, models.py, crud.py, tests/conftest.py.

---

## D03: Separate models.py and schemas.py

**Conclusion:** `models.py` contains SQLAlchemy ORM classes. `schemas.py` contains Pydantic models. They are never mixed in the same file.

**Reason:** Database structure and API structure serve different purposes. For example, `TermCreate` only requires `term` as input, but the database `Term` model has 15+ fields with system-generated defaults. Mixing them makes it impossible to express "required for creation" vs "exists in database" cleanly.

**Impacted files:** models.py, schemas.py, crud.py, all routers.

---

## D04: Use Pydantic v2 style

**Conclusion:** Use `ConfigDict(from_attributes=True)`, not the legacy `class Config: orm_mode = True`.

**Reason:** Pydantic v2 is the current version. Using v1 patterns in a new project would be unnecessarily outdated.

**Impacted files:** schemas.py.

---

## D05: Use Literal types for status and rating

**Conclusion:** Define `TermStatus = Literal["new", "learning", "mastered"]` and `ReviewRating = Literal["forgot", "hard", "good", "easy"]` in schemas.py. Use these types everywhere instead of raw `str`.

**Reason:** Provides compile-time hints and runtime validation. Invalid values automatically return 422 without manual checking in routers.

**Impacted files:** schemas.py, scheduler.py, crud.py.

---

## D06: Two tables only — terms and review_logs

**Conclusion:** v0.1 uses only `terms` and `review_logs`. No `daily_stats`, `users`, or `tags` table.

**Reason:** Statistics can be computed from review_logs via aggregation queries. A tags normalization table adds complexity without clear v0.1 benefit. Users table is deferred until authentication is needed. Adding any of these later does not require modifying existing tables.

**Impacted files:** models.py, crud.py.

---

## D07: New terms have next_review_at = NULL

**Conclusion:** When a term is created, `next_review_at` is set to NULL. It gets a real datetime only after the first review.

**Reason:** This cleanly separates the two lists in `GET /reviews/today`. Due reviews query: `status != "new" AND next_review_at IS NOT NULL AND next_review_at <= now`. New terms query: `status == "new"`. Since new terms have NULL for next_review_at, they can never appear in due_reviews, preventing overlap.

**Impacted files:** models.py, schemas.py, crud.py, routers/reviews.py, tests/test_reviews.py.

---

## D08: Tags stored as comma-separated string, API uses list[str]

**Conclusion:** Database stores tags as `"GRE,CS,academic"`. API accepts and returns `["GRE", "CS", "academic"]`. Conversion helpers live in `utils/tags.py`, called by `crud.py`.

**Reason:** A normalized tags table (tags + term_tags) is overkill for v0.1. Comma-separated strings are simple to implement and query. The known limitation is that `contains` filtering may produce false positives (e.g., "AI" matching "RAID"). This is acceptable for MVP and documented in README.

**Impacted files:** models.py, schemas.py, crud.py, utils/tags.py, routers/terms.py.

---

## D09: Use UTC everywhere

**Conclusion:** All datetimes are stored and computed in UTC. Use `datetime.now(timezone.utc)` via a `utc_now()` helper in `utils/time.py`. Never use `datetime.now()` or `datetime.utcnow()`.

**Reason:** Local time causes bugs when the development machine, server, and user are in different timezones. UTC is the standard for backend storage. Frontend converts to local time for display.

**Impacted files:** utils/time.py, models.py, crud.py, scheduler.py, all tests.

---

## D10: SQLAlchemy column defaults use function references

**Conclusion:** Write `default=utc_now` (function reference), not `default=utc_now()` (call result).

**Reason:** `default=utc_now()` evaluates once at import time and every row gets the same timestamp. `default=utc_now` evaluates per-row at insert time, which is correct behavior.

**Impacted files:** models.py.

---

## D11: backend/ is a Python package

**Conclusion:** `backend/` has `__init__.py`. All commands run from project root. Imports use `from backend.xxx import yyy`.

**Reason:** Consistent import paths across uvicorn, pytest, and IDE. Avoids the "cd backend first" problem where different tools resolve imports differently.

**Impacted files:** All files (import statements), __init__.py files.

---

## D12: Scheduler is a pure function module

**Conclusion:** `scheduler.py` contains `calculate_next_review()` which accepts data values, returns a `ReviewScheduleResult` Pydantic model. It does not import database, FastAPI, or HTTP modules.

**Reason:** Separation of concerns. The scheduling algorithm is the most likely component to be upgraded (from simple mapping to SM-2). By isolating it, algorithm changes don't require touching API or database code.

**Impacted files:** scheduler.py, schemas.py (ReviewScheduleResult definition).

---

## D13: Scheduler accepts optional `now` parameter

**Conclusion:** `calculate_next_review(..., now: datetime | None = None)`. Internally uses `now or utc_now()`.

**Reason:** Testability. Without this, tests depend on the real clock and can flake around midnight boundaries. With a fixed `now`, test assertions on `next_review_at` are deterministic.

**Impacted files:** scheduler.py, tests/test_scheduler.py.

---

## D14: v0.1 uses simplified scheduling, not full SM-2

**Conclusion:** forgot=1d, hard=3d, good=7d, easy=14d. ease_factor stays at 2.5. Status transitions based on repetition count thresholds.

**Reason:** SM-2 is well-documented but adds complexity that isn't needed to validate the product idea. The simple mapping is easy to explain in interviews and easy to test. Upgrading to SM-2 later only changes `scheduler.py` internals.

**Impacted files:** scheduler.py, tests/test_scheduler.py.

---

## D15: Three status values — new, learning, mastered

**Conclusion:** Status enum has three values. A fourth value `reviewing` was considered and rejected for v0.1.

**Reason:** The simplified scheduler doesn't need the distinction between "learning" and "reviewing". Three values cover all user-facing states. Adding a fourth value later is a non-breaking change (new enum member + migration).

**Impacted files:** schemas.py, models.py, scheduler.py, crud.py.

---

## D16: No familiarity field in v0.1

**Conclusion:** The `familiarity` field (0-5 integer) is not included.

**Reason:** It overlaps with `ease_factor`, `repetitions`, and `status`. If the frontend needs a user-facing "proficiency" indicator, it can be computed from existing fields without storing a redundant value.

**Impacted files:** models.py, schemas.py, scheduler.py.

---

## D17: last_reviewed_at stored in terms table

**Conclusion:** `last_reviewed_at` is a denormalized field on the `terms` table, even though it could be derived from review_logs.

**Reason:** Makes the term object self-contained for API responses. Frontend can display "last reviewed 3 days ago" without a separate query. The update cost is one extra field assignment during review submission.

**Impacted files:** models.py, crud.py, routers/reviews.py.

---

## D18: Cascade delete review_logs when term is deleted

**Conclusion:** Deleting a term automatically deletes all its review_logs via SQLAlchemy cascade and SQLite ON DELETE CASCADE.

**Reason:** Orphan review_logs serve no purpose. Keeping them would require handling nullable term_id or broken references.

**Impacted files:** models.py, database.py (FK pragma), tests/test_reviews.py.

---

## D19: definition, examples, usage_context are optional

**Conclusion:** All three default to empty string. Only `term` is required to create a new entry.

**Reason:** Users should be able to quickly add a term and fill in details later. Requiring definition at creation time adds friction that conflicts with the "quick capture" use case.

**Impacted files:** models.py, schemas.py (TermCreate).

---

## D20: term allows duplicates

**Conclusion:** No unique constraint on `term` or `(term, language)`.

**Reason:** The same word in different languages or contexts may have different meanings. A unique constraint would force users to merge entries that should be separate. Duplicate warnings can be added later as a frontend feature without database changes.

**Impacted files:** models.py.

---

## D21: Test database isolation

**Conclusion:** Tests use in-memory SQLite with StaticPool, injected via FastAPI dependency override. Development database is never touched by tests.

**Reason:** Test data must not pollute development data. In-memory databases are fast and automatically cleaned up. StaticPool ensures the same connection is reused within a test session (required for SQLite in-memory to persist across queries).

**Impacted files:** tests/conftest.py, database.py (get_db must be overridable).

---

## D22: CORS configured from day one

**Conclusion:** `main.py` includes CORS middleware allowing localhost React origins (5173, 3000) before any frontend work begins.

**Reason:** Forgetting CORS causes confusing browser errors during frontend integration. Adding it early costs nothing and prevents a debugging detour later.

**Impacted files:** main.py.

---

## D23: GET /reviews/today returns two separate lists

**Conclusion:** Response structure is `{"due_reviews": [...], "new_terms": [...]}` with `new_limit` parameter (default 10, max 50).

**Reason:** Separating due reviews from new terms gives the frontend control over how to present them (e.g., "12 reviews today + 10 new words"). Mixing them into one list would lose this distinction.

**Impacted files:** schemas.py (TodayReviewsResponse), crud.py, routers/reviews.py.

---

## D24: DELETE returns JSON message, not 204

**Conclusion:** `DELETE /terms/{term_id}` returns `{"detail": "Term deleted"}` with status 200.

**Reason:** Easier to test and debug than 204 No Content. For a learning project, explicit responses are more instructive.

**Impacted files:** routers/terms.py.

## D25: No concurrency control in v0.1

**Conclusion:** create_review() has no locking or optimistic concurrency control.

**Reason:** v0.1 is a single-user local SQLite app with no concurrent access. Adding row-level locking or optimistic concurrency is deferred until multi-user PostgreSQL migration.

**Impacted files:** crud.py, models.py (future).

---

## D26: {"tags": null} treated as omitted

**Conclusion:** PUT /terms/{id} with {"tags": null} behaves identically to omitting the tags field — existing tags are preserved.

**Reason:** Pydantic parses both cases as None. The update logic uses `if data.tags is not None` to decide whether to update. This is tested but not in the original API contract. Documented here for clarity.

**Impacted files:** schemas.py, crud.py, test_terms.py.