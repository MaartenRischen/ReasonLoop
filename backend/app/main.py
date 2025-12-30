"""FastAPI main application with WebSocket support for real-time reasoning updates."""

import asyncio
import logging
from typing import Dict, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import json
import re

from .schemas import (
    ReasoningConfig,
    ReasoningRequest,
    ReasoningEvent,
    Session,
    SessionSummary,
    InjectFeedback,
    TaskAnalysisRequest,
    TaskAnalysisResponse,
    ModelRecommendation,
    APIKeyInput,
    APIKeyStatus,
    APIKeysResponse,
    ProviderUsage,
    ModelUsage,
    UsageResponse
)
from .reasoning_engine import reasoning_loop, retry_reasoning
from .openrouter import fetch_models_from_api, get_client
from .providers import load_api_keys, save_api_keys, load_usage, save_usage, reload_client


# Task analysis prompt for the LLM
TASK_ANALYSIS_PROMPT = '''You are an expert AI model selector. Analyze the given task and recommend the optimal LLM configuration.

AVAILABLE MODELS (use exact IDs):
- anthropic/claude-opus-4.5: Best for creative writing, nuanced analysis, complex reasoning
- anthropic/claude-sonnet-4: Fast, great all-rounder, good for most tasks
- openai/o3-pro: Deep reasoning, math, logic, proofs (slower but thorough)
- openai/o3: Good reasoning, faster than o3-pro
- openai/gpt-5: Latest GPT, excellent general intelligence
- google/gemini-2.5-pro: Strong multimodal, good reasoning
- google/gemini-2.5-flash: Very fast, cost-effective, good for simple tasks

TASK TO ANALYZE:
{task}

{vision_note}

Respond with ONLY valid JSON (no markdown, no explanation):
{{
  "task_type": "<Creative|Coding|Math|Analysis|Research|General|Vision>",
  "task_summary": "<one sentence summary>",
  "generator": {{
    "model_id": "<exact model ID>",
    "reason": "<why this model for generation>"
  }},
  "critic": {{
    "model_id": "<exact model ID>",
    "reason": "<why this model for critique>"
  }},
  "refiner": {{
    "model_id": "<exact model ID>",
    "reason": "<why this model for final refinement>"
  }},
  "temperature": <0.3-0.9 based on task>,
  "max_iterations": <3-7 based on complexity>
}}'''

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# In-memory session storage (for MVP, replace with SQLite later)
sessions: Dict[str, Session] = {}
active_websockets: Dict[str, list[WebSocket]] = {}
session_controls: Dict[str, dict] = {}  # stop flags, injected feedback, etc.


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("ReasonLoop backend starting up...")
    # Test OpenRouter connection
    client = get_client()
    if await client.test_connection():
        logger.info("OpenRouter connection successful")
    else:
        logger.warning("OpenRouter connection failed - check API key")
    yield
    logger.info("ReasonLoop backend shutting down...")


app = FastAPI(
    title="ReasonLoop API",
    description="Iterative AI Reasoning System",
    version="0.1.0",
    lifespan=lifespan
)

# CORS for frontend (allow all origins for flexibility)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# REST API Endpoints
# =============================================================================

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "ReasonLoop"}


@app.get("/api/models")
async def list_models():
    """List available LLM models from OpenRouter."""
    models = await fetch_models_from_api()
    return {"models": models}


@app.post("/api/models/test")
async def test_model_connection():
    """Test connection to OpenRouter."""
    client = get_client()
    success = await client.test_connection()
    return {"connected": success}


@app.post("/api/analyze-task", response_model=TaskAnalysisResponse)
async def analyze_task(request: TaskAnalysisRequest):
    """
    Use an LLM to analyze the task and recommend optimal models.
    Returns structured recommendations for generator, critic, and refiner.
    """
    client = get_client()

    vision_note = "NOTE: The task includes images/PDFs, so prefer vision-capable models." if request.has_vision_content else ""

    prompt = TASK_ANALYSIS_PROMPT.format(
        task=request.task[:2000],  # Limit task length
        vision_note=vision_note
    )

    try:
        # Use Gemini Flash for fast, cheap analysis
        response = await client.complete(
            prompt=prompt,
            model="google/gemini-2.5-flash",
            temperature=0.3,
            max_tokens=1000
        )

        # Parse JSON response
        # Clean up potential markdown formatting
        json_str = response.strip()
        if json_str.startswith("```"):
            json_str = re.sub(r'^```(?:json)?\s*', '', json_str)
            json_str = re.sub(r'\s*```$', '', json_str)

        result = json.loads(json_str)

        return TaskAnalysisResponse(
            task_type=result.get("task_type", "General"),
            task_summary=result.get("task_summary", ""),
            generator=ModelRecommendation(
                model_id=result["generator"]["model_id"],
                reason=result["generator"]["reason"]
            ),
            critic=ModelRecommendation(
                model_id=result["critic"]["model_id"],
                reason=result["critic"]["reason"]
            ),
            refiner=ModelRecommendation(
                model_id=result["refiner"]["model_id"],
                reason=result["refiner"]["reason"]
            ),
            temperature=float(result.get("temperature", 0.7)),
            max_iterations=int(result.get("max_iterations", 5))
        )

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse task analysis JSON: {e}")
        logger.error(f"Raw response: {response}")
        # Return sensible defaults on parse failure
        return TaskAnalysisResponse(
            task_type="General",
            task_summary="Could not analyze task",
            generator=ModelRecommendation(
                model_id="anthropic/claude-sonnet-4",
                reason="Default fallback model"
            ),
            critic=ModelRecommendation(
                model_id="openai/o3",
                reason="Strong reasoning for critique"
            ),
            refiner=ModelRecommendation(
                model_id="anthropic/claude-opus-4.5",
                reason="High quality for final output"
            ),
            temperature=0.7,
            max_iterations=5
        )
    except Exception as e:
        logger.error(f"Task analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Task analysis failed: {str(e)}")


@app.post("/api/reasoning/start")
async def start_reasoning(request: ReasoningRequest):
    """
    Start a new reasoning session.
    Returns the session ID. Use WebSocket to receive real-time updates.
    """
    config = request.config or ReasoningConfig()
    session = Session(
        task=request.task,
        context=request.context,
        context_files=request.context_files,
        config=config
    )
    sessions[session.id] = session
    session_controls[session.id] = {"stop": False, "paused": False, "feedback": None}
    return {"session_id": session.id, "status": "created"}


@app.get("/api/reasoning/{session_id}")
async def get_session(session_id: str):
    """Get session status and results."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    session = sessions[session_id]
    return session.model_dump()


@app.post("/api/reasoning/{session_id}/inject")
async def inject_feedback(session_id: str, feedback: InjectFeedback):
    """Inject human feedback into an active reasoning session."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    if session_id not in session_controls:
        raise HTTPException(status_code=400, detail="Session not active")

    session_controls[session_id]["feedback"] = feedback.feedback
    return {"status": "feedback_injected"}


@app.post("/api/reasoning/{session_id}/stop")
async def stop_session(session_id: str):
    """Stop an active reasoning session."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    if session_id in session_controls:
        session_controls[session_id]["stop"] = True
    sessions[session_id].status = "stopped"
    return {"status": "stopped"}


@app.post("/api/reasoning/{session_id}/pause")
async def pause_session(session_id: str):
    """Pause an active reasoning session."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    if sessions[session_id].status != "running":
        raise HTTPException(status_code=400, detail="Session is not running")
    if session_id in session_controls:
        session_controls[session_id]["paused"] = True
    sessions[session_id].status = "paused"
    return {"status": "paused"}


@app.post("/api/reasoning/{session_id}/resume")
async def resume_session(session_id: str):
    """Resume a paused reasoning session."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    if sessions[session_id].status != "paused":
        raise HTTPException(status_code=400, detail="Session is not paused")
    if session_id in session_controls:
        session_controls[session_id]["paused"] = False
    sessions[session_id].status = "running"
    return {"status": "running"}


@app.post("/api/reasoning/{session_id}/retry")
async def retry_session(session_id: str):
    """
    'Not good enough' - retry reasoning with the rejected output.
    Returns immediately. Use WebSocket for updates.
    """
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[session_id]
    if not session.final_output and not session.iterations:
        raise HTTPException(status_code=400, detail="No output to retry from")

    session_controls[session_id] = {"stop": False, "feedback": None}
    return {"status": "retry_started"}


@app.get("/api/sessions")
async def list_sessions():
    """List all saved sessions."""
    summaries = []
    for session in sessions.values():
        summaries.append(SessionSummary(
            id=session.id,
            task=session.task[:100] + "..." if len(session.task) > 100 else session.task,
            status=session.status,
            final_score=session.final_score,
            iteration_count=len(session.iterations),
            created_at=session.created_at,
            starred=session.starred,
            tags=session.tags
        ))
    return {"sessions": [s.model_dump() for s in summaries]}


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a session."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    del sessions[session_id]
    if session_id in session_controls:
        del session_controls[session_id]
    return {"status": "deleted"}


# =============================================================================
# BYOK (Bring Your Own Key) Endpoints
# =============================================================================

def mask_api_key(key: str) -> str:
    """Mask an API key for display, showing only first and last few characters."""
    if len(key) <= 12:
        return "***"
    return f"{key[:6]}...{key[-4:]}"


@app.get("/api/keys", response_model=APIKeysResponse)
async def get_api_keys():
    """Get all configured API keys (masked for security)."""
    keys = load_api_keys()
    providers = ["anthropic", "openai", "google", "openrouter"]

    statuses = []
    for provider in providers:
        key = keys.get(provider)
        statuses.append(APIKeyStatus(
            provider=provider,
            configured=bool(key),
            masked_key=mask_api_key(key) if key else None
        ))

    return APIKeysResponse(keys=statuses)


@app.post("/api/keys")
async def set_api_key(key_input: APIKeyInput):
    """Set or update an API key for a provider."""
    keys = load_api_keys()
    keys[key_input.provider] = key_input.key
    save_api_keys(keys)
    reload_client()  # Refresh the multi-provider client
    return {
        "status": "saved",
        "provider": key_input.provider,
        "masked_key": mask_api_key(key_input.key)
    }


@app.delete("/api/keys/{provider}")
async def delete_api_key(provider: str):
    """Remove an API key for a provider."""
    if provider not in ["anthropic", "openai", "google", "openrouter"]:
        raise HTTPException(status_code=400, detail="Invalid provider")

    keys = load_api_keys()
    if provider in keys:
        del keys[provider]
        save_api_keys(keys)
        reload_client()

    return {"status": "deleted", "provider": provider}


@app.get("/api/usage", response_model=UsageResponse)
async def get_usage():
    """Get usage statistics for all providers and models."""
    usage = load_usage()

    providers = [
        ProviderUsage(
            provider=name,
            input_tokens=data.get("input_tokens", 0),
            output_tokens=data.get("output_tokens", 0),
            cost=data.get("cost", 0.0),
            requests=data.get("requests", 0)
        )
        for name, data in usage.get("providers", {}).items()
    ]

    models = [
        ModelUsage(
            model=name,
            input_tokens=data.get("input_tokens", 0),
            output_tokens=data.get("output_tokens", 0),
            cost=data.get("cost", 0.0),
            requests=data.get("requests", 0)
        )
        for name, data in usage.get("models", {}).items()
    ]

    total = usage.get("total", {})

    return UsageResponse(
        providers=providers,
        models=models,
        total_input_tokens=total.get("input_tokens", 0),
        total_output_tokens=total.get("output_tokens", 0),
        total_cost=total.get("cost", 0.0),
        last_updated=usage.get("last_updated")
    )


@app.post("/api/usage/reset")
async def reset_usage():
    """Reset all usage statistics."""
    save_usage({
        "providers": {},
        "models": {},
        "total": {"input_tokens": 0, "output_tokens": 0, "cost": 0.0}
    })
    return {"status": "reset"}


# =============================================================================
# Leaderboard Update Endpoint
# =============================================================================

LEADERBOARD_PROMPT = '''You are an AI model researcher. Analyze the current LLM landscape and provide an updated leaderboard.

Based on your knowledge of the latest AI models available (as of late 2025), provide a ranked list of the best models.

For each model, provide:
- id: The OpenRouter model ID (e.g., "anthropic/claude-opus-4.5")
- name: Human-readable name
- provider: Company name
- tier: "flagship" (best intelligence), "mid" (best value), or "budget" (fast & cheap)
- score: Intelligence score 1-100 (your assessment of overall capability)
- price: Approximate $ per 1M tokens (average of input/output)
- contextWindow: e.g., "200K", "1M", "2M"
- strengths: Array of 3-4 key strengths
- color: Tailwind color class (text-orange-400 for Anthropic, text-green-400 for OpenAI, text-blue-400 for Google, text-slate-300 for others)

Focus on:
1. Flagship: Top 4-5 most intelligent models regardless of cost
2. Mid-tier: 4-5 best value models (good intelligence, reasonable cost)
3. Budget: 3-4 fastest/cheapest models that are still capable

Respond with ONLY valid JSON:
{
  "version": "2025-12",
  "models": [
    {
      "id": "anthropic/claude-opus-4.5",
      "name": "Claude Opus 4.5",
      "provider": "Anthropic",
      "tier": "flagship",
      "score": 98,
      "price": 5.0,
      "contextWindow": "200K",
      "strengths": ["Reasoning", "Coding", "Creative Writing", "Analysis"],
      "color": "text-orange-400"
    }
    // ... more models
  ]
}'''


@app.post("/api/leaderboard/update")
async def update_leaderboard():
    """
    Use LLM to analyze the current model landscape and update the leaderboard.
    This is the "ultrathink" feature - deep analysis of available models.
    """
    client = get_client()

    try:
        # Use a capable model for analysis
        response = await client.complete(
            prompt=LEADERBOARD_PROMPT,
            model="anthropic/claude-sonnet-4.5",
            temperature=0.3,
            max_tokens=4000
        )

        # Parse JSON response
        json_str = response.strip()
        if json_str.startswith("```"):
            json_str = re.sub(r'^```(?:json)?\s*', '', json_str)
            json_str = re.sub(r'\s*```$', '', json_str)

        result = json.loads(json_str)

        return {
            "version": result.get("version", "2025-12"),
            "models": result.get("models", [])
        }

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse leaderboard JSON: {e}")
        logger.error(f"Raw response: {response}")
        raise HTTPException(status_code=500, detail="Failed to parse leaderboard update")
    except Exception as e:
        logger.error(f"Leaderboard update failed: {e}")
        raise HTTPException(status_code=500, detail=f"Leaderboard update failed: {str(e)}")


# =============================================================================
# WebSocket Handler
# =============================================================================

@app.websocket("/ws/reasoning/{session_id}")
async def websocket_reasoning(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time reasoning updates.
    Connect to this after calling /api/reasoning/start.
    """
    await websocket.accept()
    logger.info(f"WebSocket connected for session {session_id}")

    if session_id not in sessions:
        await websocket.send_json({"error": "Session not found"})
        await websocket.close()
        return

    # Track this websocket
    if session_id not in active_websockets:
        active_websockets[session_id] = []
    active_websockets[session_id].append(websocket)

    session = sessions[session_id]
    controls = session_controls.get(session_id, {"stop": False, "paused": False, "feedback": None})

    async def send_event(event: ReasoningEvent):
        """Send event to all connected websockets for this session."""
        event_data = event.model_dump(mode="json")
        for ws in active_websockets.get(session_id, []):
            try:
                await ws.send_json(event_data)
            except Exception as e:
                logger.error(f"Failed to send to websocket: {e}")

    def should_stop():
        return controls.get("stop", False)

    def is_paused():
        return controls.get("paused", False)

    def get_feedback():
        feedback = controls.get("feedback")
        if feedback:
            controls["feedback"] = None  # Clear after reading
        return feedback

    try:
        # Run the reasoning loop
        async for event in reasoning_loop(
            session=session,
            on_event=send_event,
            should_stop=should_stop,
            is_paused=is_paused,
            injected_feedback=get_feedback
        ):
            # Event already sent via on_event callback
            pass

        logger.info(f"Reasoning completed for session {session_id}")

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for session {session_id}")
    except Exception as e:
        logger.error(f"Error in reasoning loop: {e}")
        await websocket.send_json({
            "type": "session_error",
            "session_id": session_id,
            "content": str(e)
        })
    finally:
        # Clean up websocket tracking
        if session_id in active_websockets:
            active_websockets[session_id] = [
                ws for ws in active_websockets[session_id] if ws != websocket
            ]


@app.websocket("/ws/reasoning/{session_id}/retry")
async def websocket_retry(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for retry reasoning."""
    await websocket.accept()
    logger.info(f"WebSocket connected for retry session {session_id}")

    if session_id not in sessions:
        await websocket.send_json({"error": "Session not found"})
        await websocket.close()
        return

    session = sessions[session_id]

    async def send_event(event: ReasoningEvent):
        event_data = event.model_dump(mode="json")
        try:
            await websocket.send_json(event_data)
        except Exception as e:
            logger.error(f"Failed to send to websocket: {e}")

    try:
        async for event in retry_reasoning(session=session, on_event=send_event):
            pass
        logger.info(f"Retry completed for session {session_id}")
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for retry session {session_id}")
    except Exception as e:
        logger.error(f"Error in retry reasoning: {e}")
        await websocket.send_json({
            "type": "session_error",
            "session_id": session_id,
            "content": str(e)
        })


# =============================================================================
# Run with: uvicorn app.main:app --reload --port 8000
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
