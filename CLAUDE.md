# LexiFlow — Claude Code Instructions

## Project

LexiFlow is a personalized vocabulary review tool. Users create their own terms; the app handles spaced repetition scheduling. No built-in word lists, no built-in AI.

## Tech Stack

- FastAPI + synchronous SQLAlchemy ORM + Pydantic v2 + SQLite + pytest + httpx

## Commands (run from project root)

```bash
uvicorn backend.main:app --reload        # start backend
pytest backend/tests                      # run tests
# API docs at http://localhost:8000/docs
```

## File Responsibilities

```
backend/
  main.py          → FastAPI app, CORS, router mounting, /health
  database.py      → engine, SessionLocal, Base, get_db, SQLite FK pragma
  models.py        → SQLAlchemy ORM classes only (Term, ReviewLog)
  schemas.py       → Pydantic request/response schemas + ReviewScheduleResult + TermStatus/ReviewRating types
  crud.py          → all database read/write operations; calls utils helpers
  scheduler.py     → review scheduling algorithm; no DB access, no HTTP awareness
  routers/terms.py → /terms endpoints; calls crud, handles 404
  routers/reviews.py → /reviews/today, /terms/{term_id}/reviews endpoints
  utils/time.py    → utc_now() helper
  utils/tags.py    → tags_to_string(), string_to_tags()
  tests/conftest.py → test DB setup, dependency override, client fixture
```

## Hard Rules

- Use synchronous SQLAlchemy. Do not use async SQLAlchemy or aiosqlite.
- Use Pydantic v2: `ConfigDict(from_attributes=True)`, not `class Config: orm_mode = True`.
- Use `Literal` types for status and rating, not raw `str`:
  ```python
  TermStatus = Literal["new", "learning", "mastered"]
  ReviewRating = Literal["forgot", "hard", "good", "easy"]
  ```
- Use UTC everywhere. Never use `datetime.now()` or `datetime.utcnow()`. Use `from backend.utils.time import utc_now`.
- For SQLAlchemy column defaults, pass function reference `default=utc_now`, not call result `default=utc_now()`.
- `models.py` is for SQLAlchemy models only. `schemas.py` is for Pydantic schemas only. Never mix them.
- Database operations belong in `crud.py`. Routers must not contain SQLAlchemy queries.
- Review scheduling belongs in `scheduler.py`. It must not import database or FastAPI modules.
- Tag conversion belongs in `utils/tags.py`. Routers must not do tag conversion directly.
- Tests must use an isolated in-memory SQLite database (StaticPool). Never use `backend/data/vocab.db` in tests.
- Enable SQLite foreign key support via `PRAGMA foreign_keys = ON` in `database.py` connection event.
- `backend/` is a Python package. All imports use package prefix: `from backend.models import Term`.

## Database

Two tables only: `terms`, `review_logs`. No `daily_stats`, no `users`.

### terms

```
id, term, language(default "en"), definition(default ""),
examples(default ""), usage_context(default ""), tags(comma string, default ""),
status(default "new"), ease_factor(default 2.5), interval_days(default 0),
repetitions(default 0), created_at, updated_at, last_reviewed_at(NULL), next_review_at(NULL)
```

- `term` allows duplicates (no unique constraint).
- `next_review_at = NULL` on creation. Set after first review.

### review_logs

```
id, term_id(FK cascade), rating, reviewed_at,
previous_next_review_at(nullable), new_next_review_at, interval_days_after
```

- Cascade delete when parent term is deleted.
- `reviewed_at` uses `default=utc_now` (function reference), not `default=utc_now()`.

## API Contract

```
GET    /health
POST   /terms
GET    /terms                          ?skip=0&limit=50&status=&tag=
GET    /terms/{term_id}
PUT    /terms/{term_id}
DELETE /terms/{term_id}                → {"detail": "Term deleted"}
GET    /reviews/today                  ?new_limit=10
POST   /terms/{term_id}/reviews
GET    /terms/{term_id}/reviews
```

- `GET /terms`: skip default 0, limit default 50 (min 1, max 100), status optional, tag optional.
- `GET /reviews/today`: new_limit default 10 (min 0, max 50). Returns `{"due_reviews": [...], "new_terms": [...]}`.
- `due_reviews`: status != "new" AND next_review_at IS NOT NULL AND next_review_at <= now.
- `new_terms`: status == "new", order by created_at asc, limit new_limit.
- `POST /terms`: only `term` is required. `language` defaults "en". `definition/examples/usage_context` default "". `tags` defaults [].
- `PUT /terms/{term_id}`: omitted fields remain unchanged. If `tags` is omitted, keep existing tags. If `tags=[]` is explicitly provided, clear tags.
- `POST /terms/{term_id}/reviews`: creates review_log, calls scheduler, updates term fields.
- Missing term_id → 404. Invalid rating/status → 422.

## Scheduler

- `scheduler.py` exposes `calculate_next_review(rating, current_interval_days, ease_factor, repetitions, now)`.
- Returns `ReviewScheduleResult` (Pydantic model in schemas.py).
- Accepts optional `now` parameter for testability.
- v0.1 simple mapping: forgot=1d, hard=3d, good=7d, easy=14d.
- `ease_factor` stays unchanged in v0.1.
- Status transitions: forgot→learning(rep=0), hard→learning(rep+1), good→mastered if rep>=3 else learning(rep+1), easy→mastered if rep>=2 else learning(rep+1).

## CORS

Configure in `main.py` from day one:
```python
["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"]
```

## Timestamp Rules

- `created_at`: set once on creation.
- `updated_at`: set on creation, term update, and review submission.
- `last_reviewed_at`: set only on review submission.
- `next_review_at`: NULL on creation, set by scheduler after review.

## Do NOT Implement in v0.1

Authentication, user system, daily_stats table, full SM-2, Docker, deployment, PostgreSQL, React frontend, built-in AI API, prompt marketplace, payment, community features.

## Work Style

- Work in small steps. Do not generate the entire backend at once.
- After each step, explain: what changed, which files changed, how to run, how to test, what to learn.
- Add Chinese comments to key functions.
