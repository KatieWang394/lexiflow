# LexiFlow

A personalized vocabulary review app with spaced repetition scheduling.

## Why LexiFlow?

Existing flashcard apps (Anki, Quizlet, etc.) rely on built-in word lists. But when you're studying specialized terminology, niche language patterns, or multilingual phrases, those lists don't help.

LexiFlow takes a different approach: **it has no built-in word list**. You create your own terms — words, phrases, technical jargon, anything in any language — and LexiFlow handles the review scheduling. In the age of AI, you can generate definitions and examples with your own tools. The flashcard app just needs to do one thing well: manage your memory.

## Features (v0.1)

- **Create your own terms** — add words, phrases, or expressions in any language with definitions, examples, usage context, and tags
- **Spaced repetition scheduling** — each term is scheduled for review based on how well you remember it
- **Today's review queue** — get a daily list of terms due for review plus new terms to learn
- **Review history** — track how each term's review progressed over time
- **Tag-based organization** — filter terms by tags like "GRE", "CS", "日语N2"

## Tech Stack

- **Backend:** Python, FastAPI, SQLAlchemy ORM, Pydantic v2, SQLite
- **Testing:** pytest, httpx, FastAPI TestClient
- **Frontend:** React + TypeScript + Vite

## Quick Start

### Prerequisites

- Python 3.11+
- pip

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/lexiflow.git
cd lexiflow

python -m venv .venv
source .venv/bin/activate        # macOS/Linux
# .venv\Scripts\activate         # Windows

pip install -r backend/requirements.txt
```

### Run

```bash
uvicorn backend.main:app --reload
```

Open http://localhost:8000/docs for interactive API documentation.

For the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 for the app.

### Test

```bash
pytest backend/tests
```

## API Overview

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| POST | /terms | Create a term |
| GET | /terms | List terms (with pagination and filters) |
| GET | /terms/{term_id} | Get a single term |
| PUT | /terms/{term_id} | Update a term |
| DELETE | /terms/{term_id} | Delete a term and its review history |
| GET | /reviews/today | Get today's review queue |
| POST | /terms/{term_id}/reviews | Submit a review result |
| GET | /terms/{term_id}/reviews | View review history for a term |

## Review Ratings

When reviewing a term, rate your recall:

- **forgot** — no memory at all → review again tomorrow
- **hard** — partially remembered → review in 3 days
- **good** — remembered correctly → review in 7 days
- **easy** — instantly recalled → review in 14 days

## Known Limitations (v0.1)

- Tag filtering uses simple string matching, which may produce false positives (e.g., searching for "AI" could match "RAID"). A normalized tag system is planned for a future version.
- No user authentication — single-user local app.
- Review scheduling uses a simplified algorithm. Full SM-2 implementation is planned for v0.2.

## Future Plans

- Review UI refinements and richer progress views
- SM-2 spaced repetition algorithm
- Daily statistics and learning trends
- User accounts and data sync
- Community prompt template sharing

## License

MIT
