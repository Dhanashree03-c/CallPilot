# CallPilot — Cold-Call Assistance Surface

**Live application:** https://call-pilot-rho.vercel.app/

**Backend health check:** `https://callpilot-w4et.onrender.com/health`

CallPilot is a lightweight calling-assistance application designed to help callers navigate a structured prospect conversation, capture important information, record call outcomes, and generate AI-powered summaries.

## Problem

During a cold call, a caller must listen, decide how to respond, follow the conversation, and remember important details simultaneously. This creates a risk of losing context or failing to record useful information.

CallPilot provides a structured calling workflow with stage guidance, action selection, prospect-word capture, persistent call history, and AI-generated summaries.

## Features

- **Structured call stages:** Organizes a conversation into stages with a purpose and suggested actions.
- **Prospect-word capture:** Records the prospect's words separately from the caller's selected action.
- **Persistent call records:** Saves calls, stage results, outcomes, and next steps to Supabase.
- **Call history:** Retrieves previously saved calls.
- **AI-generated call summaries:** Uses the Gemini REST API to summarize saved call information, including the conversation, main concern, next step, and missing information.
- **Backend API:** Uses FastAPI to manage call operations, database access, and LLM requests.

## Live Demo

Open the application:

https://call-pilot-rho.vercel.app/

The backend health endpoint should return a JSON response indicating that the API is healthy.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, Vite |
| Backend | Python, FastAPI |
| Database | Supabase |
| LLM | Google Gemini REST API |
| Frontend hosting | Vercel |
| Backend hosting | Render |

The Gemini request is made from the backend using Python's built-in HTTP and JSON libraries. The Gemini API key is stored as a backend environment variable and is not exposed in the frontend.

## Architecture

1. The React frontend collects call information and sends requests to the FastAPI backend.
2. FastAPI creates and retrieves call records and saves stage results and outcomes in Supabase.
3. When a summary is requested, the backend retrieves the saved call data and sends a summarization prompt to Gemini.
4. The generated summary is saved to the call record and returned to the frontend for display.

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/` | API root |
| POST | `/calls` | Start a call |
| GET | `/calls` | Retrieve call history |
| GET | `/calls/{call_id}` | Retrieve a call and its stage results |
| PATCH | `/calls/{call_id}/stages/{stage_number}` | Save stage information |
| POST | `/calls/{call_id}/close` | Save the final outcome and close a call |
| POST | `/calls/{call_id}/summary` | Generate and save an AI summary |

## Local Setup

### Prerequisites

- Python 3
- Node.js and npm
- A Supabase project
- A Google AI Studio API key

### Backend

From the project root:

```bash
cd backend
python -m venv .venv
```

Activate the environment.

Windows:

```powershell
.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create `backend/.env` and configure the environment variables expected by the backend:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_key
GEMINI_API_KEY=your_gemini_api_key
```

Ensure the Supabase variable names match those used in `main.py`. Do not commit `.env` or expose secret keys.

Start the API:

```bash
uvicorn main:app --reload
```

Local API documentation is available at `http://127.0.0.1:8000/docs`.

### Frontend

Open a second terminal:

```bash
cd frontend
npm install
```

Create `frontend/.env` with the local backend URL:

```env
VITE_API_URL=http://127.0.0.1:8000
```

Start the frontend:

```bash
npm run dev
```

Open the local URL printed by Vite.

## Environment Variables

| Variable | Used by | Purpose |
|---|---|---|
| `VITE_API_URL` | Frontend | Base URL for the FastAPI backend |
| `GEMINI_API_KEY` | Backend | Authenticates Gemini API requests |
| Supabase URL variable | Backend | Identifies the Supabase project |
| Supabase key variable | Backend | Authenticates backend database access |

Use the exact Supabase variable names defined in `main.py`. Keep all private keys in local environment files or the hosting provider's environment settings.

## Database

Supabase stores call records, stage results, selected actions, prospect words, outcomes, next steps, and AI summaries.

The database schema and any setup SQL should be included in the repository so another developer can reproduce the database structure. Remove credentials and private project information before publishing SQL or configuration files.

## Design Decision

One key design decision was to separate the caller's selected action from the prospect's actual words.

The selected action provides structured information about what happened, while the prospect's words preserve the context and reasoning behind the response. Keeping them separate makes the record more useful for review and reduces the risk of confusing an interpretation with a direct statement.

## Assessment Demo

The video walkthrough demonstrates a call based on a provided assessment transcript, explains the calling workflow, shows saved information and the AI summary, and discusses the design decision above.

Transcript demonstrated: **[Insert the actual transcript filename or identifier]**

## Future Improvements

- Suggest the next stage based on the latest prospect response.
- Add clearer validation and recovery for failed network requests.
- Improve history filters and detailed call review.
- Evaluate summary quality across more representative conversations.

## Security Notes

- Never commit API keys, `.env` files, database passwords, or private credentials.
- Keep Gemini requests on the backend.
- Configure CORS to allow only the intended frontend origins.
- Use only the minimum database permissions required by the backend.

---

Built as a cold-call assistance surface for the Forward Deployed Engineer assessment.