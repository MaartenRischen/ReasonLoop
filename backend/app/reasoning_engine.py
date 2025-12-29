"""Core reasoning engine implementing the Generate → Critique → Refine loop."""

import re
import logging
from typing import AsyncGenerator, Optional, Callable, Awaitable
from datetime import datetime

from .schemas import (
    ReasoningConfig,
    ReasoningEvent,
    CritiqueResult,
    Iteration,
    Session,
    OUTPUT_LENGTH_TOKENS
)
from .prompts import (
    build_initial_prompt,
    build_refinement_prompt,
    build_critic_prompt,
    build_retry_prompt,
    build_critique_only_initial,
    build_critique_only_followup
)
from .openrouter import get_client
from .council import run_council

logger = logging.getLogger(__name__)


def parse_critique(critique_text: str) -> CritiqueResult:
    """Parse the structured critique response from the critic model."""
    result = CritiqueResult(raw_critique=critique_text)

    def extract_section(text: str, section_name: str) -> str:
        """Extract content between a section header and the next section or end."""
        # Match section header and capture everything until next section or end
        pattern = rf'{section_name}S?:\s*\n(.*?)(?=\n(?:STRENGTHS?|WEAKNESSES?|SUGGESTIONS?|SCORE):|$)'
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        return match.group(1).strip() if match else ""

    def parse_bullet_points(section_text: str) -> list[str]:
        """Parse bullet points from section text, handling multi-line items."""
        if not section_text:
            return []

        items = []
        current_item = []

        for line in section_text.split('\n'):
            stripped = line.strip()
            if not stripped:
                continue

            # Check if this line starts a new bullet point
            # Only treat single - or • at start as bullet, not ** (markdown bold)
            is_new_bullet = (
                (stripped.startswith('- ') or stripped.startswith('• ')) or
                (stripped.startswith('* ') and not stripped.startswith('**'))
            )

            if is_new_bullet:
                # Save previous item if exists
                if current_item:
                    items.append(' '.join(current_item))
                # Start new item, removing the bullet marker
                current_item = [stripped.lstrip('-•* ').strip()]
            elif current_item:
                # Continuation of previous bullet point
                current_item.append(stripped)
            else:
                # Line without bullet at start - treat as standalone item
                items.append(stripped)

        # Don't forget the last item
        if current_item:
            items.append(' '.join(current_item))

        return items

    # Extract each section
    strengths_text = extract_section(critique_text, "STRENGTH")
    weaknesses_text = extract_section(critique_text, "WEAKNESS")
    suggestions_text = extract_section(critique_text, "SUGGESTION")

    result.strengths = parse_bullet_points(strengths_text)
    result.weaknesses = parse_bullet_points(weaknesses_text)
    result.suggestions = parse_bullet_points(suggestions_text)

    # Extract score - try multiple patterns
    score = None

    # Pattern 1: SCORE: 7 or SCORE: 7.5
    score_match = re.search(r'SCORE:\s*(\d+(?:\.\d+)?)', critique_text, re.IGNORECASE)
    if score_match:
        score = float(score_match.group(1))

    # Pattern 2: 7/10 or 7.5/10
    if score is None:
        score_match = re.search(r'(\d+(?:\.\d+)?)\s*/\s*10', critique_text)
        if score_match:
            score = float(score_match.group(1))

    # Pattern 3: Score of 7 or score is 7
    if score is None:
        score_match = re.search(r'score\s+(?:of|is|:)?\s*(\d+(?:\.\d+)?)', critique_text, re.IGNORECASE)
        if score_match:
            score = float(score_match.group(1))

    # Pattern 4: Rating: 7 or rated 7
    if score is None:
        score_match = re.search(r'rat(?:ing|ed)\s*:?\s*(\d+(?:\.\d+)?)', critique_text, re.IGNORECASE)
        if score_match:
            score = float(score_match.group(1))

    # Ensure score is within bounds
    if score is not None:
        result.score = max(1.0, min(10.0, score))
    else:
        result.score = 5.0  # Default score if not found
        logger.warning("Could not parse score from critique, using default 5.0")

    return result


def get_rotated_models(config: ReasoningConfig, iteration: int) -> tuple[str, str]:
    """
    Rotate models across iterations so each model plays different roles.

    The three models (generator, critic, refiner) rotate positions:
    - Iteration 0: generator_model generates, critic_model critiques
    - Iteration 1: critic_model generates, refiner_model critiques
    - Iteration 2: refiner_model generates, generator_model critiques
    - Iteration 3+: cycles back

    This ensures each model plays every role at least once over 3 iterations.
    """
    models = [config.generator_model, config.critic_model, config.refiner_model]
    # Rotate: generator shifts forward, critic is always the next one
    gen_idx = iteration % 3
    critic_idx = (iteration + 1) % 3
    return models[gen_idx], models[critic_idx]


def should_terminate(
    score: float,
    history: list[dict],
    config: ReasoningConfig
) -> tuple[bool, str]:
    """
    Determine if the reasoning loop should terminate.
    Returns (should_stop, reason).

    IMPORTANT: We ONLY stop when the score threshold is reached.
    The loop should keep iterating until it hits the threshold or max_iterations.
    """
    # Check score threshold - this is the ONLY success condition
    if score >= config.score_threshold:
        return True, f"Score threshold reached ({score:.1f} >= {config.score_threshold})"

    # Never stop early - keep iterating until threshold or max_iterations
    return False, ""


async def reasoning_loop(
    session: Session,
    on_event: Optional[Callable[[ReasoningEvent], Awaitable[None]]] = None,
    should_stop: Optional[Callable[[], bool]] = None,
    injected_feedback: Optional[Callable[[], Optional[str]]] = None
) -> AsyncGenerator[ReasoningEvent, None]:
    """
    Main reasoning loop that generates, critiques, and refines.

    Args:
        session: The reasoning session
        on_event: Optional callback for each event
        should_stop: Optional callback to check if we should stop
        injected_feedback: Optional callback to get injected human feedback

    Yields:
        ReasoningEvent objects for each step
    """
    client = get_client()
    config = session.config
    iteration = 0
    current_output = ""
    history = []

    async def emit(event: ReasoningEvent):
        """Emit an event and call the callback if provided."""
        if on_event:
            await on_event(event)
        return event

    # Emit session started
    yield await emit(ReasoningEvent(
        type="session_started",
        session_id=session.id,
        iteration=0
    ))

    # === ULTRATHINK MODE: Run council phase first ===
    council_data = None
    if config.mode == "ultrathink":
        logger.info("UltraThink mode: Running council phase")
        models = [config.generator_model, config.critic_model, config.refiner_model]

        try:
            # Run the council (parallel queries + peer review + synthesis)
            synthesized_response, council_data = await run_council(
                task=session.task,
                models=models,
                config=config,
                session_id=session.id,
                on_event=on_event
            )

            # Emit council complete event
            yield await emit(ReasoningEvent(
                type="iteration_complete",
                session_id=session.id,
                iteration=-1,  # Council phase
                content=synthesized_response,
                score=None
            ))

            # Use synthesized response as starting point for refinement
            current_output = synthesized_response

            # Create a council iteration record
            council_iteration = Iteration(
                number=-1,  # Indicates council phase
                generation=synthesized_response,
                generation_model="council",
                critique=None,
                critique_model=""
            )
            session.iterations.append(council_iteration)

            logger.info("Council phase complete, starting refinement loop")

        except Exception as e:
            logger.error(f"Council phase failed: {e}")
            yield await emit(ReasoningEvent(
                type="session_error",
                session_id=session.id,
                iteration=-1,
                content=f"Council phase failed: {str(e)}"
            ))
            # Fall back to regular generate mode
            logger.info("Falling back to regular generate mode")
            config.mode = "generate"

    while iteration < config.max_iterations:
        # Check if we should stop
        if should_stop and should_stop():
            yield await emit(ReasoningEvent(
                type="session_stopped",
                session_id=session.id,
                iteration=iteration,
                content=current_output
            ))
            return

        # Check for injected feedback
        feedback = None
        if injected_feedback:
            feedback = injected_feedback()

        # Get rotated models for this iteration
        current_generator, current_critic = get_rotated_models(config, iteration)
        logger.info(f"Iteration {iteration}: Generator={current_generator}, Critic={current_critic}, Mode={config.mode}")

        # Use output_length setting to determine max tokens
        gen_max_tokens = OUTPUT_LENGTH_TOKENS.get(config.output_length, config.max_tokens)

        if config.mode == "critique":
            # CRITIQUE-ONLY MODE: Analyze the provided content without rewriting
            # The "generation" step is actually analysis/critique
            yield await emit(ReasoningEvent(
                type="generation_start",
                session_id=session.id,
                iteration=iteration
            ))

            # Content to analyze is in the context field
            content_to_analyze = session.context or ""

            if iteration == 0:
                prompt = build_critique_only_initial(session.task, None, content_to_analyze, config.output_length)
            else:
                # Use previous critique to get different angle
                previous_critique = history[-1]["generation"] if history else ""
                prompt = build_critique_only_followup(
                    session.task,
                    None,
                    content_to_analyze,
                    previous_critique,
                    config.output_length
                )

            generation = ""
            files_for_prompt = session.context_files if iteration == 0 else None
            async for chunk in client.stream_completion(
                prompt=prompt,
                model=current_generator,
                temperature=config.temperature,
                max_tokens=gen_max_tokens,
                context_files=files_for_prompt
            ):
                generation += chunk
                yield await emit(ReasoningEvent(
                    type="generation_chunk",
                    session_id=session.id,
                    iteration=iteration,
                    content=chunk
                ))

            yield await emit(ReasoningEvent(
                type="generation_complete",
                session_id=session.id,
                iteration=iteration,
                content=generation
            ))

            # In critique mode, the generation IS the analysis - no separate critique step
            # Score gradually increases so we run all iterations (score only hits threshold on final iteration)
            final_iteration = config.max_iterations - 1
            if iteration >= final_iteration:
                critique_score = config.score_threshold  # Allow completion on final iteration
            else:
                critique_score = 7.0  # Below threshold to continue iterating

            critique = CritiqueResult(
                score=critique_score,
                strengths=[],
                weaknesses=[],
                suggestions=[],
                raw_critique=""  # Empty - the generation itself is the critique
            )
            # Don't emit critique_complete in critique mode - the generation IS the critique

        else:
            # GENERATE MODE (also handles UltraThink refinement)
            # In UltraThink mode, iteration 0 uses the council's synthesized output
            # and skips directly to critique
            if config.mode == "ultrathink" and iteration == 0 and current_output:
                # Skip generation - use council's synthesis
                generation = current_output
                logger.info("UltraThink: Using council synthesis, skipping to critique")
                yield await emit(ReasoningEvent(
                    type="generation_complete",
                    session_id=session.id,
                    iteration=iteration,
                    content=generation
                ))
            else:
                # Normal generate-critique-refine loop
                yield await emit(ReasoningEvent(
                    type="generation_start",
                    session_id=session.id,
                    iteration=iteration
                ))

                if iteration == 0:
                    prompt = build_initial_prompt(session.task, session.context, config.output_length)
                else:
                    # Use feedback if injected, otherwise use critique
                    if feedback:
                        critique_text = f"Human feedback: {feedback}"
                    else:
                        critique_text = history[-1]["critique"].raw_critique
                    prompt = build_refinement_prompt(
                        session.task,
                        session.context,
                        current_output,
                        critique_text,
                        config.output_length
                    )

                generation = ""
                # Only include files in the first iteration (they provide initial context)
                files_for_prompt = session.context_files if iteration == 0 else None
                async for chunk in client.stream_completion(
                    prompt=prompt,
                    model=current_generator,  # Use rotated generator
                    temperature=config.temperature,
                    max_tokens=gen_max_tokens,
                    context_files=files_for_prompt
                ):
                    generation += chunk
                    yield await emit(ReasoningEvent(
                        type="generation_chunk",
                        session_id=session.id,
                        iteration=iteration,
                        content=chunk
                    ))

                yield await emit(ReasoningEvent(
                    type="generation_complete",
                    session_id=session.id,
                    iteration=iteration,
                    content=generation
                ))

            # CRITIQUE
            yield await emit(ReasoningEvent(
                type="critique_start",
                session_id=session.id,
                iteration=iteration
            ))

            critique_prompt = build_critic_prompt(
                session.task,
                generation,
                config.criteria
            )

            critique_text = ""
            async for chunk in client.stream_completion(
                prompt=critique_prompt,
                model=current_critic,  # Use rotated critic
                temperature=0.3,  # Lower temperature for more consistent critique
                max_tokens=2000
            ):
                critique_text += chunk
                yield await emit(ReasoningEvent(
                    type="critique_chunk",
                    session_id=session.id,
                    iteration=iteration,
                    content=chunk
                ))

            # Parse critique for generate mode (critique mode already set it above)
            critique = parse_critique(critique_text)

            yield await emit(ReasoningEvent(
                type="critique_complete",
                session_id=session.id,
                iteration=iteration,
                score=critique.score,
                critique=critique
            ))

        # Create iteration record with the actual rotated models used
        iter_record = Iteration(
            number=iteration,
            generation=generation,
            generation_model=current_generator,  # Actual model used
            critique=critique,
            critique_model=current_critic  # Actual model used
        )
        session.iterations.append(iter_record)

        # Update history
        history.append({
            "generation": generation,
            "critique": critique,
            "score": critique.score
        })

        yield await emit(ReasoningEvent(
            type="iteration_complete",
            session_id=session.id,
            iteration=iteration,
            content=generation,
            score=critique.score,
            critique=critique
        ))

        # CHECK TERMINATION
        should_stop_flag, reason = should_terminate(critique.score, history, config)
        if should_stop_flag:
            session.final_output = generation
            session.final_score = critique.score
            session.status = "completed"
            yield await emit(ReasoningEvent(
                type="session_complete",
                session_id=session.id,
                iteration=iteration,
                content=generation,
                score=critique.score
            ))
            return

        current_output = generation
        iteration += 1

    # Max iterations reached
    session.final_output = current_output
    session.final_score = history[-1]["score"] if history else None
    session.status = "completed"
    yield await emit(ReasoningEvent(
        type="session_complete",
        session_id=session.id,
        iteration=iteration - 1,
        content=current_output,
        score=session.final_score
    ))


async def retry_reasoning(
    session: Session,
    on_event: Optional[Callable[[ReasoningEvent], Awaitable[None]]] = None
) -> AsyncGenerator[ReasoningEvent, None]:
    """
    Retry reasoning with a previously rejected output.
    This runs another full loop, using the rejected output as a starting point.
    """
    client = get_client()
    config = session.config

    # Build retry prompt
    prompt = build_retry_prompt(
        session.task,
        session.context,
        session.final_output or session.iterations[-1].generation
    )

    # Reset session for retry
    session.status = "running"
    session.final_output = None
    session.final_score = None

    async def emit(event: ReasoningEvent):
        if on_event:
            await on_event(event)
        return event

    yield await emit(ReasoningEvent(
        type="session_started",
        session_id=session.id,
        iteration=len(session.iterations)
    ))

    # Generate new response with retry prompt
    iteration = len(session.iterations)

    yield await emit(ReasoningEvent(
        type="generation_start",
        session_id=session.id,
        iteration=iteration
    ))

    generation = ""
    async for chunk in client.stream_completion(
        prompt=prompt,
        model=config.generator_model,
        temperature=config.temperature,
        max_tokens=config.max_tokens
    ):
        generation += chunk
        yield await emit(ReasoningEvent(
            type="generation_chunk",
            session_id=session.id,
            iteration=iteration,
            content=chunk
        ))

    yield await emit(ReasoningEvent(
        type="generation_complete",
        session_id=session.id,
        iteration=iteration,
        content=generation
    ))

    # Continue with the regular loop for this new generation
    temp_session = Session(
        id=session.id,
        task=session.task,
        context=session.context,
        config=config,
        iterations=[]
    )

    # Add the retry generation as iteration 0 of temp session
    # Then continue with critique and potential refinements
    history = [{"generation": generation, "critique": None, "score": 0}]

    # Now do the critique
    yield await emit(ReasoningEvent(
        type="critique_start",
        session_id=session.id,
        iteration=iteration
    ))

    critique_prompt = build_critic_prompt(
        session.task,
        generation,
        config.criteria
    )

    critique_text = ""
    async for chunk in client.stream_completion(
        prompt=critique_prompt,
        model=config.critic_model,
        temperature=0.3,
        max_tokens=2000
    ):
        critique_text += chunk
        yield await emit(ReasoningEvent(
            type="critique_chunk",
            session_id=session.id,
            iteration=iteration,
            content=chunk
        ))

    critique = parse_critique(critique_text)

    yield await emit(ReasoningEvent(
        type="critique_complete",
        session_id=session.id,
        iteration=iteration,
        score=critique.score,
        critique=critique
    ))

    # Add to session iterations
    iter_record = Iteration(
        number=iteration,
        generation=generation,
        generation_model=config.generator_model,
        critique=critique,
        critique_model=config.critic_model
    )
    session.iterations.append(iter_record)

    yield await emit(ReasoningEvent(
        type="iteration_complete",
        session_id=session.id,
        iteration=iteration,
        content=generation,
        score=critique.score,
        critique=critique
    ))

    # Check if this is good enough
    should_stop_flag, reason = should_terminate(critique.score, history, config)
    if should_stop_flag or critique.score >= config.score_threshold:
        session.final_output = generation
        session.final_score = critique.score
        session.status = "completed"
        yield await emit(ReasoningEvent(
            type="session_complete",
            session_id=session.id,
            iteration=iteration,
            content=generation,
            score=critique.score
        ))
        return

    # Otherwise continue with more iterations via the main loop
    # Create a new session starting from current state
    async for event in reasoning_loop(session, on_event):
        if event.type != "session_started":  # Skip duplicate start event
            yield event
