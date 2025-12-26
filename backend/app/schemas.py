from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime
import uuid


class ReasoningConfig(BaseModel):
    """Configuration for a reasoning session."""
    generator_model: str = "anthropic/claude-3.5-sonnet"
    critic_model: str = "anthropic/claude-3.5-sonnet"
    refiner_model: str = "anthropic/claude-3.5-sonnet"
    temperature: float = Field(default=0.7, ge=0, le=1)
    max_tokens: int = Field(default=4096, ge=100, le=32000)
    max_iterations: int = Field(default=5, ge=1, le=20)
    score_threshold: float = Field(default=8.0, ge=1, le=10)
    improvement_delta: float = Field(default=0.5, ge=0, le=5)
    criteria: Optional[str] = None  # Custom evaluation criteria


class ContextFile(BaseModel):
    """A file attached as context (can be text or base64-encoded binary)."""
    name: str
    content: str
    type: str
    size: int
    isBase64: bool = False
    mimeType: Optional[str] = None


class ReasoningRequest(BaseModel):
    """Request to start a reasoning session."""
    task: str = Field(..., min_length=1)
    context: Optional[str] = None
    context_files: Optional[List[ContextFile]] = None
    config: Optional[ReasoningConfig] = None


class CritiqueResult(BaseModel):
    """Structured critique from the critic model."""
    strengths: List[str] = []
    weaknesses: List[str] = []
    suggestions: List[str] = []
    score: float = Field(default=5.0, ge=1, le=10)
    raw_critique: str = ""


class Iteration(BaseModel):
    """A single iteration in the reasoning loop."""
    number: int
    generation: str = ""
    generation_model: str = ""
    critique: Optional[CritiqueResult] = None
    critique_model: str = ""
    refinement_plan: str = ""
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ReasoningEvent(BaseModel):
    """Event emitted during reasoning, sent over WebSocket."""
    type: Literal[
        "session_started",
        "generation_start",
        "generation_chunk",
        "generation_complete",
        "critique_start",
        "critique_chunk",
        "critique_complete",
        "iteration_complete",
        "session_complete",
        "session_error",
        "session_paused",
        "session_stopped"
    ]
    session_id: str
    iteration: int = 0
    content: str = ""
    score: Optional[float] = None
    critique: Optional[CritiqueResult] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class Session(BaseModel):
    """A complete reasoning session."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task: str
    context: Optional[str] = None
    context_files: Optional[List[ContextFile]] = None
    config: ReasoningConfig
    iterations: List[Iteration] = []
    final_output: Optional[str] = None
    final_score: Optional[float] = None
    status: Literal["running", "paused", "completed", "stopped", "error"] = "running"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    starred: bool = False
    tags: List[str] = []


class InjectFeedback(BaseModel):
    """Human feedback to inject into the reasoning loop."""
    feedback: str = Field(..., min_length=1)


class SessionSummary(BaseModel):
    """Summary of a session for listing."""
    id: str
    task: str
    status: str
    final_score: Optional[float]
    iteration_count: int
    created_at: datetime
    starred: bool
    tags: List[str]


class TaskAnalysisRequest(BaseModel):
    """Request for LLM-based task analysis."""
    task: str = Field(..., min_length=1)
    has_vision_content: bool = False


class ModelRecommendation(BaseModel):
    """A single model recommendation with reasoning."""
    model_config = {"protected_namespaces": ()}  # Allow model_id field name

    model_id: str
    reason: str


class TaskAnalysisResponse(BaseModel):
    """Response from task analysis with model recommendations."""
    task_type: str
    task_summary: str
    generator: ModelRecommendation
    critic: ModelRecommendation
    refiner: ModelRecommendation
    temperature: float
    max_iterations: int


# =============================================================================
# BYOK (Bring Your Own Key) Schemas
# =============================================================================

class APIKeyInput(BaseModel):
    """Input for setting an API key."""
    provider: Literal["anthropic", "openai", "google", "openrouter"]
    key: str = Field(..., min_length=10)


class APIKeyStatus(BaseModel):
    """Status of a configured API key (key is masked)."""
    provider: str
    configured: bool
    masked_key: Optional[str] = None  # e.g., "sk-...abc123"


class APIKeysResponse(BaseModel):
    """Response with all configured API keys."""
    keys: List[APIKeyStatus]


class ProviderUsage(BaseModel):
    """Usage statistics for a single provider."""
    provider: str
    input_tokens: int
    output_tokens: int
    cost: float
    requests: int


class ModelUsage(BaseModel):
    """Usage statistics for a single model."""
    model: str
    input_tokens: int
    output_tokens: int
    cost: float
    requests: int


class UsageResponse(BaseModel):
    """Complete usage statistics."""
    providers: List[ProviderUsage]
    models: List[ModelUsage]
    total_input_tokens: int
    total_output_tokens: int
    total_cost: float
    last_updated: Optional[str] = None
