
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import Client, create_client
from datetime import datetime, timezone
from typing import Literal
import json
import urllib.error
import urllib.request

load_dotenv()

print("Gemini API key loaded:", bool(os.getenv("GEMINI_API_KEY")))

app = FastAPI(
    title="CallPilot API",
    version="1.0.0",
    description="Backend for the CallPilot cold-call assistant",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://call-pilot-rho.vercel.app",
        "http://localhost:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StartCallRequest(BaseModel):
    prospect_name: str = Field(
        default="Unnamed prospect",
        min_length=1,
        max_length=200,
    )


def get_supabase() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")

    if not url or not key:
        raise HTTPException(
            status_code=500,
            detail="Supabase configuration is missing on the server.",
        )

    try:
        return create_client(url, key)
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not initialize the database connection.",
        )


class SaveStageRequest(BaseModel):
    stage_status: Literal[
        "reached", "completed", "skipped", "abandoned"
    ] = "completed"
    what_happened: str | None = Field(default=None, max_length=500)
    prospect_words: str | None = Field(default=None, max_length=5000)


class CloseCallRequest(BaseModel):
    current_stage: int = Field(ge=1, le=8)
    outcome: str = Field(min_length=1, max_length=200)
    next_step: str | None = Field(default=None, max_length=1000)
    what_happened: str | None = Field(default=None, max_length=500)
    prospect_words: str | None = Field(default=None, max_length=5000)


@app.patch("/calls/{call_id}/stages/{stage_number}")
def save_stage(
    call_id: str,
    stage_number: int,
    request: SaveStageRequest,
):
    if not 1 <= stage_number <= 8:
        raise HTTPException(
            status_code=422,
            detail="Stage number must be between 1 and 8.",
        )

    db = get_supabase()

    try:
        existing = (
            db.table("calls")
            .select("id,status,current_stage")
            .eq("id", call_id)
            .limit(1)
            .execute()
        )

        if not existing.data:
            raise HTTPException(status_code=404, detail="Call not found.")

        call = existing.data[0]

        if call["status"] != "in_progress":
            raise HTTPException(
                status_code=409,
                detail="This call is already closed.",
            )

        db.table("call_stage_results").upsert(
            {
                "call_id": call_id,
                "stage_number": stage_number,
                "stage_status": request.stage_status,
                "what_happened": request.what_happened,
                "prospect_words": request.prospect_words,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="call_id,stage_number",
        ).execute()

        db.table("calls").update(
            {
                "current_stage": max(
                    call["current_stage"], stage_number
                )
            }
        ).eq("id", call_id).execute()

        return {
            "message": "Stage saved successfully",
            "call_id": call_id,
            "stage_number": stage_number,
        }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not save stage results.",
        )


@app.post("/calls/{call_id}/close")
def close_call(call_id: str, request: CloseCallRequest):
    db = get_supabase()

    try:
        existing = (
            db.table("calls")
            .select("id,status,current_stage")
            .eq("id", call_id)
            .limit(1)
            .execute()
        )

        if not existing.data:
            raise HTTPException(status_code=404, detail="Call not found.")

        call = existing.data[0]

        if call["status"] != "in_progress":
            raise HTTPException(
                status_code=409,
                detail="This call is already closed.",
            )

        # Save the current stage before closing the call.
        db.table("call_stage_results").upsert(
            {
                "call_id": call_id,
                "stage_number": request.current_stage,
                "stage_status": "completed",
                "what_happened": request.what_happened,
                "prospect_words": request.prospect_words,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="call_id,stage_number",
        ).execute()

        result = (
            db.table("calls")
            .update(
                {
                    "current_stage": max(
                        call["current_stage"], request.current_stage
                    ),
                    "outcome": request.outcome,
                    "next_step": request.next_step,
                    "ended_at": datetime.now(timezone.utc).isoformat(),
                    "status": "completed",
                }
            )
            .eq("id", call_id)
            .eq("status", "in_progress")
            .execute()
        )

        if not result.data:
            raise HTTPException(
                status_code=409,
                detail="Call could not be closed. Refresh and try again.",
            )

        return {
            "message": "Call closed successfully",
            "call": result.data[0],
        }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not close the call.",
        )


@app.get("/calls/{call_id}")
def get_call(call_id: str):
    db = get_supabase()

    try:
        result = (
            db.table("calls")
            .select("*")
            .eq("id", call_id)
            .limit(1)
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=404, detail="Call not found.")

        stages = (
            db.table("call_stage_results")
            .select("*")
            .eq("call_id", call_id)
            .order("stage_number")
            .execute()
        )

        return {
            "call": result.data[0],
            "stages": stages.data,
        }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not retrieve call details.",
        )

@app.get("/")
def root():
    return {"message": "CallPilot API is running"}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "callpilot-api",
    }


@app.post("/calls", status_code=201)
def start_call(request: StartCallRequest):
    db = get_supabase()

    try:
        call_result = (
            db.table("calls")
            .insert({
                "prospect_name": request.prospect_name.strip()
                or "Unnamed prospect",
                "current_stage": 1,
                "status": "in_progress",
            })
            .execute()
        )

        if not call_result.data:
            raise HTTPException(
                status_code=500,
                detail="The call could not be created.",
            )

        call = call_result.data[0]

        db.table("call_stage_results").insert({
            "call_id": call["id"],
            "stage_number": 1,
            "stage_status": "reached",
        }).execute()

        return {
            "message": "Call started successfully",
            "call": call,
        }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail=(
                "Could not save the call. "
                "Check the backend configuration and database schema."
            ),
        )


@app.get("/calls")
def list_calls():
    db = get_supabase()

    try:
        result = (
            db.table("calls")
            .select("*")
            .order("started_at", desc=True)
            .limit(100)
            .execute()
        )

        return {"calls": result.data}

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Could not retrieve call history.",
        )

@app.post("/calls/{call_id}/summary")
def generate_call_summary(call_id: str):
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is not configured on the backend."
        )

    db = get_supabase()

    try:
        # 1. Retrieve the saved call.
        call_result = (
            db.table("calls")
            .select("*")
            .eq("id", call_id)
            .limit(1)
            .execute()
        )

        if not call_result.data:
            raise HTTPException(
                status_code=404,
                detail="Call not found."
            )

        call = call_result.data[0]

        # 2. Retrieve all saved stage results.
        stage_result = (
            db.table("call_stage_results")
            .select("*")
            .eq("call_id", call_id)
            .order("stage_number")
            .execute()
        )

        stages = stage_result.data or []

        # 3. Prepare the information for Gemini.
        call_information = {
            "prospect_name": call.get("prospect_name"),
            "current_stage": call.get("current_stage"),
            "outcome": call.get("outcome"),
            "next_step": call.get("next_step"),
            "stage_results": [
                {
                    "stage_number": stage.get("stage_number"),
                    "status": stage.get("stage_status"),
                    "what_happened": stage.get("what_happened"),
                    "prospect_words": stage.get("prospect_words"),
                }
                for stage in stages
            ],
        }

        prompt = f"""
You are an assistant helping a caller review a prospect conversation.

Create a concise, factual call summary using only the information provided.
Do not invent facts or assume that a meeting was booked.
If information is missing, explicitly say it was not recorded.

Include these sections:
1. Call summary
2. Main concern or objection
3. Agreed next step
4. Missing information

Keep the entire summary under 180 words.

Saved call information:
{json.dumps(call_information, ensure_ascii=False)}
"""

        # 4. Call Gemini through its REST API.
        url = (
            "https://generativelanguage.googleapis.com/"
            "v1beta/models/gemini-3.8-flash:generateContent"
        )

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 500,
            },
        }

        request = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": api_key,
            },
            method="POST",
        )

        with urllib.request.urlopen(request, timeout=120) as response:
            gemini_data = json.loads(
                response.read().decode("utf-8")
            )

        # 5. Extract the generated text.
        candidates = gemini_data.get("candidates", [])

        if not candidates:
            raise HTTPException(
                status_code=502,
                detail="Gemini returned no summary. Try again."
            )

        parts = candidates[0].get("content", {}).get("parts", [])
        summary = "\n".join(
            part["text"]
            for part in parts
            if part.get("text")
        ).strip()

        if not summary:
            raise HTTPException(
                status_code=502,
                detail="Gemini returned an empty summary."
            )

        # 6. Save the summary to Supabase.
        (
            db.table("calls")
            .update({"ai_summary": summary})
            .eq("id", call_id)
            .execute()
        )

        return {
            "call_id": call_id,
            "summary": summary,
            "message": "AI summary generated and saved successfully."
        }

    except HTTPException:
        raise

    except TimeoutError:
        print("Gemini request timed out after 120 seconds.")

        raise HTTPException(
            status_code=504,
            detail=(
                "Gemini took too long to respond. "
                "Please try again in a moment."
            )
        )
        
    except urllib.error.HTTPError as exc:
        # Show a useful error without exposing the API key.
        error_body = exc.read().decode("utf-8", errors="replace")
        print("Gemini API error:", exc.code, error_body[:1000])

        raise HTTPException(
            status_code=502,
            detail=(
                f"Gemini API returned HTTP {exc.code}. "
                "Check the backend terminal for details."
            )
        )

    except urllib.error.URLError as exc:
        print("Gemini connection error:", exc)

        raise HTTPException(
            status_code=502,
            detail=(
                "Could not connect to Gemini. "
                "Check your internet connection and try again."
            )
        )

    except Exception as exc:
        print("Call summary error:", repr(exc))

        raise HTTPException(
            status_code=500,
            detail="Could not generate or save the call summary."
        )
