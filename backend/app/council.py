"""Council phase implementation for UltraThink mode.

Implements Karpathy's LLM Council approach:
1. Query multiple models in parallel
2. Peer review (each model rates others anonymously)
3. Synthesis by best-ranked model
"""

import asyncio
import re
import logging
from typing import Optional, Callable, Awaitable

from .openrouter import get_client
from .schemas import ReasoningEvent, ReasoningConfig

logger = logging.getLogger(__name__)


# Prompts for council phases
PEER_REVIEW_PROMPT = """You are evaluating responses from multiple AI models to this question:

QUESTION: {question}

Here are the responses (model identities hidden):

{responses_text}

Your task:
1. Evaluate each response individually. For each response, explain what it does well and what it does poorly.
2. Consider: accuracy, completeness, clarity, insight, and practical usefulness.
3. Provide your final ranking from best to worst.

Format your response as:

EVALUATION:
[Your detailed evaluation of each response]

FINAL RANKING:
1. [Letter of best response] - [brief reason]
2. [Letter of second best] - [brief reason]
3. [Letter of third best] - [brief reason]
(etc.)
"""


SYNTHESIS_PROMPT = """You are synthesizing multiple AI responses into one comprehensive answer.

ORIGINAL QUESTION: {question}

INDIVIDUAL RESPONSES:
{responses_text}

PEER RANKINGS (how each model ranked the others):
{rankings_text}

Your task:
1. Consider what each response does well
2. Note the peer rankings and what they reveal about response quality
3. Synthesize the best elements into a comprehensive, accurate answer
4. Where responses disagree, use your judgment to determine the most accurate view
5. The final answer should be better than any individual response

Provide your synthesized answer:
"""


async def query_models_parallel(
    prompt: str,
    models: list[str],
    temperature: float = 0.7,
    max_tokens: int = 4000,
    on_response: Optional[Callable[[str, str], Awaitable[None]]] = None,
    timeout: float = 120.0  # 2 minute timeout per model
) -> dict[str, str]:
    """Query multiple models in parallel and return their responses."""
    client = get_client()

    async def query_single(model: str) -> tuple[str, str]:
        try:
            response = ""
            async for chunk in client.stream_completion(
                prompt=prompt,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens
            ):
                response += chunk

            if on_response:
                await on_response(model, response)

            return model, response
        except Exception as e:
            logger.error(f"Error querying {model}: {e}")
            return model, f"[Error: {str(e)}]"

    async def query_with_timeout(model: str) -> tuple[str, str]:
        try:
            return await asyncio.wait_for(query_single(model), timeout=timeout)
        except asyncio.TimeoutError:
            logger.error(f"Timeout querying {model} after {timeout}s")
            return model, f"[Timeout after {timeout}s]"

    # Query all models in parallel with timeout
    tasks = [query_with_timeout(model) for model in models]
    results = await asyncio.gather(*tasks)

    return {model: response for model, response in results}


def format_responses_anonymous(responses: dict[str, str]) -> tuple[str, dict[str, str]]:
    """Format responses with anonymous labels (A, B, C, etc.)."""
    labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    model_to_label = {}
    text_parts = []

    for i, (model, response) in enumerate(responses.items()):
        if i >= len(labels):
            break
        label = labels[i]
        model_to_label[model] = label
        text_parts.append(f"=== RESPONSE {label} ===\n{response}\n")

    return "\n".join(text_parts), model_to_label


def parse_rankings(ranking_text: str, model_to_label: dict[str, str]) -> dict[str, list[str]]:
    """Parse ranking from peer review response."""
    # Look for FINAL RANKING section
    ranking_section = re.search(
        r'FINAL RANKING:?\s*\n(.*?)(?=\n\n|\Z)',
        ranking_text,
        re.IGNORECASE | re.DOTALL
    )

    if not ranking_section:
        return {}

    ranking_text = ranking_section.group(1)

    # Extract ordered labels
    rankings = []
    for line in ranking_text.split('\n'):
        line = line.strip()
        if not line:
            continue
        # Match patterns like "1. A" or "1. Response A" or "1. [A]"
        match = re.search(r'^\d+\.?\s*\[?(?:Response\s*)?([A-H])\]?', line, re.IGNORECASE)
        if match:
            rankings.append(match.group(1).upper())

    return rankings


def calculate_aggregate_rankings(
    all_rankings: dict[str, list[str]],
    model_to_label: dict[str, str]
) -> list[tuple[str, float]]:
    """Calculate aggregate rankings from all peer reviews."""
    label_to_model = {v: k for k, v in model_to_label.items()}
    scores = {model: [] for model in model_to_label.keys()}

    for reviewer, rankings in all_rankings.items():
        for position, label in enumerate(rankings):
            if label in label_to_model:
                model = label_to_model[label]
                # Lower position = better (1st place = 1 point, 2nd = 2, etc.)
                scores[model].append(position + 1)

    # Calculate average rank for each model (lower is better)
    avg_scores = []
    for model, positions in scores.items():
        if positions:
            avg = sum(positions) / len(positions)
            avg_scores.append((model, avg))
        else:
            avg_scores.append((model, 999))  # No rankings = worst

    # Sort by average rank (lower is better)
    avg_scores.sort(key=lambda x: x[1])

    return avg_scores


async def run_council(
    task: str,
    models: list[str],
    config: ReasoningConfig,
    session_id: str,
    on_event: Optional[Callable[[ReasoningEvent], Awaitable[None]]] = None
) -> tuple[str, dict]:
    """
    Run the full council process:
    1. Query all models in parallel
    2. Peer review (each model evaluates others)
    3. Synthesis by top-ranked model

    If any stage fails, returns a fallback response with error info.

    Returns: (synthesized_response, council_data)
    """
    client = get_client()
    council_data = {
        "initial_responses": {},
        "peer_reviews": {},
        "rankings": {},
        "aggregate_rankings": [],
        "synthesis_model": None,
        "synthesized_response": ""
    }

    async def emit(event: ReasoningEvent):
        if on_event:
            await on_event(event)
        return event

    # === STAGE 1: Collect initial responses ===
    await emit(ReasoningEvent(
        type="generation_start",
        session_id=session_id,
        iteration=-1,  # -1 indicates council phase
        content="Council Phase: Querying all models..."
    ))

    initial_responses = await query_models_parallel(
        prompt=task,
        models=models,
        temperature=config.temperature,
        max_tokens=4000
    )
    council_data["initial_responses"] = initial_responses

    # Format responses anonymously for peer review
    responses_text, model_to_label = format_responses_anonymous(initial_responses)

    await emit(ReasoningEvent(
        type="generation_complete",
        session_id=session_id,
        iteration=-1,
        content=f"Received {len(initial_responses)} initial responses"
    ))

    # === STAGE 2: Peer Review ===
    await emit(ReasoningEvent(
        type="critique_start",
        session_id=session_id,
        iteration=-1,
        content="Council Phase: Peer review in progress..."
    ))

    peer_review_prompt = PEER_REVIEW_PROMPT.format(
        question=task,
        responses_text=responses_text
    )

    # Each model reviews the others
    peer_reviews = await query_models_parallel(
        prompt=peer_review_prompt,
        models=models,
        temperature=0.3,  # Lower temp for more consistent evaluation
        max_tokens=3000
    )
    council_data["peer_reviews"] = peer_reviews

    # Parse rankings from each review
    all_rankings = {}
    for model, review in peer_reviews.items():
        rankings = parse_rankings(review, model_to_label)
        if rankings:
            all_rankings[model] = rankings
            council_data["rankings"][model] = rankings

    # Calculate aggregate rankings
    aggregate_rankings = calculate_aggregate_rankings(all_rankings, model_to_label)
    council_data["aggregate_rankings"] = aggregate_rankings

    await emit(ReasoningEvent(
        type="critique_complete",
        session_id=session_id,
        iteration=-1,
        content=f"Peer review complete. Rankings: {aggregate_rankings}"
    ))

    # === STAGE 3: Synthesis ===
    # Use the top-ranked model as the synthesizer (or first model if rankings failed)
    synthesis_model = aggregate_rankings[0][0] if aggregate_rankings else models[0]
    council_data["synthesis_model"] = synthesis_model

    await emit(ReasoningEvent(
        type="generation_start",
        session_id=session_id,
        iteration=-2,  # -2 indicates synthesis phase
        content=f"Council Phase: {synthesis_model} synthesizing final answer..."
    ))

    # Format rankings for synthesis prompt
    rankings_text = "\n".join([
        f"{model_to_label.get(model, '?')}: Average rank {rank:.1f}"
        for model, rank in aggregate_rankings
    ])

    synthesis_prompt = SYNTHESIS_PROMPT.format(
        question=task,
        responses_text=responses_text,
        rankings_text=rankings_text
    )

    # Stream synthesis response
    synthesized = ""
    async for chunk in client.stream_completion(
        prompt=synthesis_prompt,
        model=synthesis_model,
        temperature=config.temperature,
        max_tokens=config.max_tokens
    ):
        synthesized += chunk
        await emit(ReasoningEvent(
            type="generation_chunk",
            session_id=session_id,
            iteration=-2,
            content=chunk
        ))

    council_data["synthesized_response"] = synthesized

    await emit(ReasoningEvent(
        type="generation_complete",
        session_id=session_id,
        iteration=-2,
        content=synthesized
    ))

    return synthesized, council_data
