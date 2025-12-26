"""OpenRouter API client with streaming support."""

import httpx
import json
from typing import AsyncGenerator, Optional, List, Any
import logging

logger = logging.getLogger(__name__)


def build_multimodal_content(text: str, context_files: Optional[List[Any]] = None) -> Any:
    """
    Build multimodal content for the OpenAI-compatible API.
    Returns either a string or an array of content parts.
    """
    if not context_files:
        return text

    content_parts = []

    # Add files first (images and PDFs)
    for file in context_files:
        if file.isBase64:
            mime_type = file.mimeType or "application/octet-stream"

            if mime_type.startswith("image/"):
                # Image content
                content_parts.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{mime_type};base64,{file.content}"
                    }
                })
            elif mime_type == "application/pdf":
                # PDF as file (supported by Claude and some other models)
                content_parts.append({
                    "type": "file",
                    "file": {
                        "filename": file.name,
                        "file_data": f"data:{mime_type};base64,{file.content}"
                    }
                })
        else:
            # Text file - include content in the text prompt
            text = f"--- FILE: {file.name} ---\n{file.content}\n--- END FILE ---\n\n" + text

    # Add the main text prompt
    content_parts.append({
        "type": "text",
        "text": text
    })

    return content_parts

import os

# OpenRouter API endpoints
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"

# Load API key from environment variable first, fallback to hardcoded
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "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")

# Cache for models
_models_cache: Optional[list[dict]] = None


class OpenRouterClient:
    """Async client for OpenRouter API with streaming."""

    def __init__(self, api_key: str = OPENROUTER_API_KEY):
        self.api_key = api_key
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:5173",  # Required by OpenRouter
            "X-Title": "ReasonLoop"  # App name for OpenRouter dashboard
        }

    async def stream_completion(
        self,
        prompt: str,
        model: str = "anthropic/claude-3.5-sonnet",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        system_prompt: Optional[str] = None,
        context_files: Optional[List[Any]] = None
    ) -> AsyncGenerator[str, None]:
        """
        Stream a completion from OpenRouter.
        Yields text chunks as they arrive.
        Supports multimodal content (images, PDFs) via context_files.
        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        # Build content (multimodal if files are present)
        content = build_multimodal_content(prompt, context_files)
        messages.append({"role": "user", "content": content})

        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True
        }

        logger.info(f"Starting stream for model {model} with max_tokens={max_tokens}")
        token_count = 0

        async with httpx.AsyncClient(timeout=600.0) as client:  # 10 min timeout for long generations
            async with client.stream(
                "POST",
                OPENROUTER_API_URL,
                headers=self.headers,
                json=payload
            ) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    logger.error(f"OpenRouter API error: {response.status_code} - {error_text}")
                    raise Exception(f"OpenRouter API error: {response.status_code}")

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            logger.info(f"Stream completed for model {model}, ~{token_count} tokens generated")
                            break
                        try:
                            chunk = json.loads(data)
                            if "choices" in chunk and len(chunk["choices"]) > 0:
                                choice = chunk["choices"][0]
                                delta = choice.get("delta", {})
                                content = delta.get("content", "")

                                # Log finish reason if present
                                finish_reason = choice.get("finish_reason")
                                if finish_reason:
                                    logger.warning(f"Stream finish_reason: {finish_reason} for model {model} after ~{token_count} tokens")
                                    if finish_reason == "length":
                                        logger.error(f"MODEL {model} HIT MAX_TOKENS LIMIT after ~{token_count} tokens!")

                                if content:
                                    token_count += len(content.split())  # Rough token estimate
                                    yield content
                        except json.JSONDecodeError as e:
                            logger.warning(f"JSON decode error: {e} for data: {data[:100]}")
                            continue
                        except Exception as e:
                            logger.error(f"Error processing chunk: {e}")
                            continue

    async def complete(
        self,
        prompt: str,
        model: str = "anthropic/claude-3.5-sonnet",
        temperature: float = 0.7,
        max_tokens: int = 4096,
        system_prompt: Optional[str] = None
    ) -> str:
        """
        Get a non-streaming completion from OpenRouter.
        Returns the full response text.
        """
        full_response = ""
        async for chunk in self.stream_completion(
            prompt=prompt,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            system_prompt=system_prompt
        ):
            full_response += chunk
        return full_response

    async def test_connection(self) -> bool:
        """Test the API connection."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    "https://openrouter.ai/api/v1/models",
                    headers={"Authorization": f"Bearer {self.api_key}"}
                )
                return response.status_code == 200
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return False


async def fetch_models_from_api() -> list[dict]:
    """Fetch models directly from OpenRouter API."""
    global _models_cache

    if _models_cache is not None:
        return _models_cache

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                OPENROUTER_MODELS_URL,
                headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}"}
            )
            if response.status_code == 200:
                data = response.json()
                models = []
                for model in data.get("data", []):
                    model_id = model.get("id", "")
                    # Extract provider from model ID (e.g., "anthropic/claude-3" -> "Anthropic")
                    provider = model_id.split("/")[0].title() if "/" in model_id else "Unknown"

                    # Get pricing info
                    pricing = model.get("pricing", {})
                    prompt_price = float(pricing.get("prompt", 0)) * 1000000  # Price per 1M tokens
                    completion_price = float(pricing.get("completion", 0)) * 1000000

                    models.append({
                        "id": model_id,
                        "name": model.get("name", model_id),
                        "provider": provider,
                        "context_length": model.get("context_length", 0),
                        "pricing": {
                            "prompt": prompt_price,
                            "completion": completion_price
                        },
                        "description": model.get("description", "")
                    })

                # Sort by provider, then by name
                models.sort(key=lambda x: (x["provider"], x["name"]))
                _models_cache = models
                logger.info(f"Fetched {len(models)} models from OpenRouter")
                return models
            else:
                logger.error(f"Failed to fetch models: {response.status_code}")
                return []
    except Exception as e:
        logger.error(f"Error fetching models: {e}")
        return []


def get_available_models() -> list[dict]:
    """Return cached models or empty list (use fetch_models_from_api for async)."""
    return _models_cache or []


def clear_models_cache():
    """Clear the models cache to force a refresh."""
    global _models_cache
    _models_cache = None


# Singleton client instance
_client: Optional[OpenRouterClient] = None


def get_client() -> OpenRouterClient:
    """Get or create the OpenRouter client."""
    global _client
    if _client is None:
        _client = OpenRouterClient()
    return _client
