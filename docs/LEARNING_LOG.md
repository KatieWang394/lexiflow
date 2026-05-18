# LexiFlow Learning Log

This is a personal learning journal. After each development step, write a short entry about what you learned. This is not an architectural document — AI coding assistants do not need to read this.

The goal: when you interview about this project, you can explain every technical decision in your own words.

---

## 2026-05-18 — Architecture planning

What I did:
- Defined the full project architecture across multiple rounds of discussion with Claude and GPT
- Made decisions about tech stack, database schema, API design, module responsibilities, and testing strategy
- Produced four project documents: CLAUDE.md, DECISIONS.md, README.md, LEARNING_LOG.md

What I learned:
- The difference between SQLAlchemy ORM models and Pydantic schemas, and why they must be separated
- Why `datetime.now()` is dangerous in backend code (timezone ambiguity) and why UTC is the standard
- Why SQLAlchemy column defaults should use function references (`default=utc_now`) not call results (`default=utc_now()`)
- Why `next_review_at = NULL` for new terms cleanly separates new terms from due reviews in the today queue
- The concept of cascade delete and why orphan review records should be cleaned up
- How FastAPI dependency injection works conceptually (get_db can be overridden in tests)
- Why testing with an isolated in-memory database matters

What I still need to understand better:
- How SQLAlchemy sessions and transactions actually work
- How FastAPI TestClient and dependency overrides work in practice
- How Pydantic v2's `ConfigDict(from_attributes=True)` converts ORM objects to response models
- The actual SM-2 algorithm (for v0.2)

---

<!-- Template for future entries:

## YYYY-MM-DD — Step title

What I did:
-

What I learned:
-

What I still need to understand better:
-

-->
