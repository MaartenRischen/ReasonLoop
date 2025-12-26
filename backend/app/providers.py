"""Multi-provider API client supporting Anthropic, OpenAI, Google, and OpenRouter."""

import httpx
import json
import os
from typing import AsyncGenerator, Optional, Dict, Any, List
from datetime import datetime
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

# Data directory for storing keys and usage
DATA_DIR = Path(__file__).parent.parent.parent / "data"
KEYS_FILE = DATA_DIR / "api_keys.json"
USAGE_FILE = DATA_DIR / "usage.json"

# Ensure data directory exists
DATA_DIR.mkdir(exist_ok=True)


def load_api_keys() -> Dict[str, str]:
    """Load API keys from file, with environment variables as fallback."""
    keys = {}

    # First, load from file if exists
    if KEYS_FILE.exists():
        try:
            with open(KEYS_FILE, "r") as f:
                keys = json.load(f)
        except Exception as e:
            logger.error(f"Failed to load API keys: {e}")

    # Then, check environment variables for any missing keys
    env_mappings = {
        "anthropic": "ANTHROPIC_API_KEY",
        "openai": "OPENAI_API_KEY",
        "google": "GOOGLE_API_KEY",
        "openrouter": "OPENROUTER_API_KEY"
    }

    for provider, env_var in env_mappings.items():
        if not keys.get(provider):
            env_key = os.environ.get(env_var)
            if env_key:
                keys[provider] = env_key
                logger.info(f"Loaded {provider} API key from environment variable")

    return keys


def save_api_keys(keys: Dict[str, str]):
    """Save API keys to file."""
    try:
        with open(KEYS_FILE, "w") as f:
            json.dump(keys, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save API keys: {e}")


def load_usage() -> Dict[str, Any]:
    """Load usage statistics from file."""
    if USAGE_FILE.exists():
        try:
            with open(USAGE_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load usage: {e}")
    return {"providers": {}, "models": {}, "total": {"input_tokens": 0, "output_tokens": 0, "cost": 0.0}}


def save_usage(usage: Dict[str, Any]):
    """Save usage statistics to file."""
    try:
        with open(USAGE_FILE, "w") as f:
            json.dump(usage, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save usage: {e}")


def track_usage(provider: str, model: str, input_tokens: int, output_tokens: int, cost: float):
    """Track API usage for a request."""
    usage = load_usage()

    # Initialize provider stats if needed
    if provider not in usage["providers"]:
        usage["providers"][provider] = {"input_tokens": 0, "output_tokens": 0, "cost": 0.0, "requests": 0}

    # Initialize model stats if needed
    if model not in usage["models"]:
        usage["models"][model] = {"input_tokens": 0, "output_tokens": 0, "cost": 0.0, "requests": 0}

    # Update provider stats
    usage["providers"][provider]["input_tokens"] += input_tokens
    usage["providers"][provider]["output_tokens"] += output_tokens
    usage["providers"][provider]["cost"] += cost
    usage["providers"][provider]["requests"] += 1

    # Update model stats
    usage["models"][model]["input_tokens"] += input_tokens
    usage["models"][model]["output_tokens"] += output_tokens
    usage["models"][model]["cost"] += cost
    usage["models"][model]["requests"] += 1

    # Update totals
    usage["total"]["input_tokens"] += input_tokens
    usage["total"]["output_tokens"] += output_tokens
    usage["total"]["cost"] += cost

    usage["last_updated"] = datetime.utcnow().isoformat()

    save_usage(usage)


# Pricing per 1M tokens (approximate, update as needed)
PRICING = {
    # Anthropic
    "claude-opus-4": {"input": 15.0, "output": 75.0},
    "claude-opus-4.5": {"input": 15.0, "output": 75.0},
    "claude-sonnet-4": {"input": 3.0, "output": 15.0},
    "claude-3.5-sonnet": {"input": 3.0, "output": 15.0},
    "claude-3-opus": {"input": 15.0, "output": 75.0},
    # OpenAI
    "gpt-4o": {"input": 2.5, "output": 10.0},
    "gpt-4-turbo": {"input": 10.0, "output": 30.0},
    "gpt-5": {"input": 5.0, "output": 15.0},
    "o1": {"input": 15.0, "output": 60.0},
    "o3": {"input": 15.0, "output": 60.0},
    "o3-pro": {"input": 20.0, "output": 80.0},
    # Google
    "gemini-2.5-flash": {"input": 0.075, "output": 0.30},
    "gemini-2.5-pro": {"input": 1.25, "output": 5.0},
    "gemini-1.5-pro": {"input": 1.25, "output": 5.0},
}


def estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Estimate cost for a request."""
    # Find matching pricing
    for key, price in PRICING.items():
        if key in model.lower():
            return (input_tokens * price["input"] / 1_000_000) + (output_tokens * price["output"] / 1_000_000)
    # Default pricing if not found
    return (input_tokens * 1.0 / 1_000_000) + (output_tokens * 3.0 / 1_000_000)


def get_provider_for_model(model: str) -> str:
    """Determine which provider a model belongs to."""
    model_lower = model.lower()
    if "anthropic/" in model_lower or "claude" in model_lower:
        return "anthropic"
    elif "openai/" in model_lower or "gpt" in model_lower or model_lower.startswith("o1") or model_lower.startswith("o3"):
        return "openai"
    elif "google/" in model_lower or "gemini" in model_lower:
        return "google"
    return "openrouter"


def get_native_model_id(model: str) -> str:
    """Convert OpenRouter model ID to native provider model ID."""
    # Remove provider prefix if present
    if "/" in model:
        model = model.split("/", 1)[1]

    # Map to native IDs
    model_mappings = {
        # Anthropic
        "claude-opus-4.5": "claude-sonnet-4-20250514",  # Use latest available
        "claude-opus-4": "claude-sonnet-4-20250514",
        "claude-sonnet-4": "claude-sonnet-4-20250514",
        "claude-3.5-sonnet": "claude-3-5-sonnet-20241022",
        "claude-3-opus": "claude-3-opus-20240229",
        # OpenAI
        "gpt-5": "gpt-4o",  # Fallback to available model
        "gpt-4o": "gpt-4o",
        "o1": "o1",
        "o3": "o3-mini",  # Fallback
        "o3-pro": "o3-mini",
        # Google
        "gemini-2.5-flash": "gemini-2.0-flash",
        "gemini-2.5-pro": "gemini-1.5-pro",
        "gemini-1.5-pro": "gemini-1.5-pro",
    }

    for key, native_id in model_mappings.items():
        if key in model.lower():
            return native_id

    return model


class MultiProviderClient:
    """Client that routes requests to the appropriate provider based on model and available keys."""

    def __init__(self, openrouter_key: str = None):
        self.openrouter_key = openrouter_key
        self.keys = load_api_keys()

    def reload_keys(self):
        """Reload API keys from file."""
        self.keys = load_api_keys()

    def get_available_provider(self, model: str) -> tuple[str, str]:
        """
        Get the best available provider for a model.
        Returns (provider, api_key) tuple.
        """
        preferred_provider = get_provider_for_model(model)

        # Check if we have a key for the preferred provider
        if preferred_provider == "anthropic" and self.keys.get("anthropic"):
            return "anthropic", self.keys["anthropic"]
        elif preferred_provider == "openai" and self.keys.get("openai"):
            return "openai", self.keys["openai"]
        elif preferred_provider == "google" and self.keys.get("google"):
            return "google", self.keys["google"]

        # Fallback to OpenRouter
        openrouter_key = self.keys.get("openrouter") or self.openrouter_key
        if openrouter_key:
            return "openrouter", openrouter_key

        raise ValueError(f"No API key available for model {model}")

    async def stream_completion(
        self,
        prompt: str,
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        system_prompt: Optional[str] = None,
        context_files: Optional[List[Any]] = None
    ) -> AsyncGenerator[str, None]:
        """Stream a completion from the best available provider."""

        provider, api_key = self.get_available_provider(model)

        input_tokens = len(prompt) // 4  # Rough estimate
        output_tokens = 0

        try:
            if provider == "anthropic":
                async for chunk in self._stream_anthropic(prompt, model, temperature, max_tokens, system_prompt, api_key):
                    output_tokens += len(chunk) // 4
                    yield chunk
            elif provider == "openai":
                async for chunk in self._stream_openai(prompt, model, temperature, max_tokens, system_prompt, api_key):
                    output_tokens += len(chunk) // 4
                    yield chunk
            elif provider == "google":
                async for chunk in self._stream_google(prompt, model, temperature, max_tokens, system_prompt, api_key):
                    output_tokens += len(chunk) // 4
                    yield chunk
            else:
                async for chunk in self._stream_openrouter(prompt, model, temperature, max_tokens, system_prompt, api_key, context_files):
                    output_tokens += len(chunk) // 4
                    yield chunk

            # Track usage after completion
            cost = estimate_cost(model, input_tokens, output_tokens)
            track_usage(provider, model, input_tokens, output_tokens, cost)

        except Exception as e:
            logger.error(f"Error streaming from {provider}: {e}")
            raise

    async def _stream_anthropic(
        self,
        prompt: str,
        model: str,
        temperature: float,
        max_tokens: int,
        system_prompt: Optional[str],
        api_key: str
    ) -> AsyncGenerator[str, None]:
        """Stream from Anthropic API."""
        native_model = get_native_model_id(model)

        messages = [{"role": "user", "content": prompt}]

        payload = {
            "model": native_model,
            "messages": messages,
            "max_tokens": max_tokens,
            "stream": True
        }

        if temperature > 0:
            payload["temperature"] = temperature
        if system_prompt:
            payload["system"] = system_prompt

        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=payload
            ) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    logger.error(f"Anthropic API error: {response.status_code} - {error_text}")
                    raise Exception(f"Anthropic API error: {response.status_code}")

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                            if chunk.get("type") == "content_block_delta":
                                text = chunk.get("delta", {}).get("text", "")
                                if text:
                                    yield text
                        except json.JSONDecodeError:
                            continue

    async def _stream_openai(
        self,
        prompt: str,
        model: str,
        temperature: float,
        max_tokens: int,
        system_prompt: Optional[str],
        api_key: str
    ) -> AsyncGenerator[str, None]:
        """Stream from OpenAI API."""
        native_model = get_native_model_id(model)

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": native_model,
            "messages": messages,
            "max_tokens": max_tokens,
            "stream": True,
            "temperature": temperature
        }

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload
            ) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    logger.error(f"OpenAI API error: {response.status_code} - {error_text}")
                    raise Exception(f"OpenAI API error: {response.status_code}")

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                            content = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            continue

    async def _stream_google(
        self,
        prompt: str,
        model: str,
        temperature: float,
        max_tokens: int,
        system_prompt: Optional[str],
        api_key: str
    ) -> AsyncGenerator[str, None]:
        """Stream from Google AI API."""
        native_model = get_native_model_id(model)

        contents = []
        if system_prompt:
            contents.append({"role": "user", "parts": [{"text": f"System: {system_prompt}"}]})
            contents.append({"role": "model", "parts": [{"text": "Understood."}]})
        contents.append({"role": "user", "parts": [{"text": prompt}]})

        payload = {
            "contents": contents,
            "generationConfig": {
                "maxOutputTokens": max_tokens,
                "temperature": temperature
            }
        }

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{native_model}:streamGenerateContent?key={api_key}"

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                url,
                json=payload
            ) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    logger.error(f"Google AI API error: {response.status_code} - {error_text}")
                    raise Exception(f"Google AI API error: {response.status_code}")

                buffer = ""
                async for chunk in response.aiter_text():
                    buffer += chunk
                    # Try to parse JSON objects from the stream
                    while True:
                        try:
                            # Google returns JSON array elements
                            if buffer.startswith("["):
                                buffer = buffer[1:]
                            if buffer.startswith(","):
                                buffer = buffer[1:]
                            if buffer.startswith("]"):
                                break

                            # Find complete JSON object
                            depth = 0
                            end_idx = -1
                            for i, c in enumerate(buffer):
                                if c == "{":
                                    depth += 1
                                elif c == "}":
                                    depth -= 1
                                    if depth == 0:
                                        end_idx = i + 1
                                        break

                            if end_idx == -1:
                                break

                            obj_str = buffer[:end_idx]
                            buffer = buffer[end_idx:]

                            obj = json.loads(obj_str)
                            candidates = obj.get("candidates", [])
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                for part in parts:
                                    text = part.get("text", "")
                                    if text:
                                        yield text
                        except json.JSONDecodeError:
                            break

    async def _stream_openrouter(
        self,
        prompt: str,
        model: str,
        temperature: float,
        max_tokens: int,
        system_prompt: Optional[str],
        api_key: str,
        context_files: Optional[List[Any]] = None
    ) -> AsyncGenerator[str, None]:
        """Stream from OpenRouter API (fallback)."""
        from .openrouter import build_multimodal_content

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        content = build_multimodal_content(prompt, context_files)
        messages.append({"role": "user", "content": content})

        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True
        }

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:5173",
            "X-Title": "ReasonLoop"
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
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
                            break
                        try:
                            chunk = json.loads(data)
                            if "choices" in chunk and len(chunk["choices"]) > 0:
                                content = chunk["choices"][0].get("delta", {}).get("content", "")
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            continue

    async def complete(
        self,
        prompt: str,
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        system_prompt: Optional[str] = None
    ) -> str:
        """Get a non-streaming completion."""
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


# Singleton client instance
_multi_client: Optional[MultiProviderClient] = None


def get_multi_client() -> MultiProviderClient:
    """Get or create the multi-provider client."""
    global _multi_client
    if _multi_client is None:
        from .openrouter import OPENROUTER_API_KEY
        _multi_client = MultiProviderClient(openrouter_key=OPENROUTER_API_KEY)
    return _multi_client


def reload_client():
    """Reload the client with fresh keys."""
    global _multi_client
    if _multi_client:
        _multi_client.reload_keys()
