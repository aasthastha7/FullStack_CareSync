# CareSync

Caregiver-first operating system for home-care teams. Caregivers check in via GPS, follow personalised care plans, log vitals, manage shift schedules, and message colleagues — all from a single mobile-friendly app.

## Architecture

```
React (Vite) SPA          FastAPI (Python)           Supabase
┌────────────────┐  /api  ┌─────────────────┐  psycopg2  ┌────────────────┐
│  Frontend/     │ ────── │  backend/app/   │ ────────── │  PostgreSQL    │
│  TypeScript    │ proxy  │  routers/       │            │  Auth (GoTrue) │
└────────────────┘        └─────────────────┘            └────────────────┘
```

The React frontend talks to the FastAPI backend via `/api` (proxied by Vite in dev). The backend authenticates users through Supabase Auth REST endpoints and reads/writes data in Supabase PostgreSQL using psycopg2.

## Folder structure

```
CareSync/
├── backend/
│   ├── app/               # FastAPI application
│   │   ├── main.py        # Entry point, CORS, router wiring
│   │   ├── database.py    # psycopg2 connection helper & SQL setup runner
│   │   └── routers/       # auth, caregiver, shifts, alerts, mood, chat, staff, sync, support_contacts
│   ├── sql/               # Idempotent SQL scripts (schema, seed, migrations)
│   ├── requirements.txt   # Python dependencies
│   ├── .env.example       # Template for backend environment variables
│   ├── check_tables.py    # Database verification script
│   └── test_database_connection.py
│
└── Frontend/
    ├── src/
    │   ├── screens/       # Page components (Dashboard, CarePlan, Wellbeing, Chat, etc.)
    │   ├── components/    # Reusable UI primitives
    │   ├── context/       # React context (auth state)
    │   └── lib/           # API client, date/time helpers, utilities
    ├── package.json
    ├── vite.config.ts
    └── tailwind.config.js
```

## Environment variables

### Backend (`backend/.env`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Supabase pooler) |
| `SUPABASE_URL` | Supabase project URL (used for Auth REST API) |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (default: `http://localhost:5173`) |

### Frontend

No environment variables required. The Vite dev server proxies `/api` requests to `http://localhost:8000`.

## Running locally (Windows PowerShell)

### Prerequisites

- Python 3.12+
- Node.js 18+
- A Supabase project with the database password

### 1. Backend

```powershell
cd E:\vibecoding\CareSync\backend

# Create and activate a virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
Copy-Item .env.example .env
# Edit .env — fill in DATABASE_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY

# Run the SQL setup scripts (creates tables, seeds data, applies migrations)
python -m app.database

# Verify the database
python check_tables.py

# Start the API server
uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### 2. Frontend

```powershell
cd E:\vibecoding\CareSync\Frontend

npm install
npm run dev
```

The app runs at `http://localhost:5173`.

### SQL setup scripts

The `python -m app.database` command runs the following scripts in order (all idempotent):

| Script | Purpose |
|---|---|
| `schema.sql` | Core tables, triggers, RLS policies, grants |
| `seed_staff.sql` | Staff directory seed data |
| `003_signup_improvements.sql` | Unique email constraint, idempotent signup trigger |
| `004_support_contacts.sql` | Crisis helpline reference table |
| `005_support_requests_extend.sql` | Extend support_requests + GPS check-in columns |
| `006_upcoming_shifts.sql` | Backfill upcoming shifts for existing users |
| `007_timezone_fix.sql` | Add timezone column (Australia/Sydney default), timezone-aware trigger |

## Features

- **Shift management** — today's shift, upcoming shifts, check-in via GPS
- **Care plans** — task checklists, vitals logging (temp, pulse, BP), shift reports
- **Wellbeing support** — mood check-ins, mental health day requests, shift swap requests, fatigue/injury reporting
- **Alerts** — schedule updates, medication reminders, supply notifications
- **Chat** — HIPAA-style secure messaging between colleagues
- **Staff directory** — searchable colleague profiles, attendance history
- **Timezone-aware** — all dates displayed in Australia/Sydney (AEST/AEDT); "today" computed per-user

## Live URL

> **TODO** — add deployed URL here

## License

Private — not for distribution.