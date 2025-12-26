"""Prompt templates for the reasoning engine."""

GENERATOR_INITIAL_PROMPT = """You are solving a complex task. Think carefully and provide your best response.

TASK: {task}

{context_section}

Provide a thorough but focused response. Be comprehensive without being unnecessarily verbose - aim for quality over quantity. Structure your response clearly."""


GENERATOR_REFINEMENT_PROMPT = """You are refining a response based on critique. Your job is to produce a SIGNIFICANTLY IMPROVED version.

ORIGINAL TASK: {task}

{context_section}

PREVIOUS RESPONSE:
{previous_response}

CRITIQUE OF THE ABOVE:
{critique}

CRITICAL INSTRUCTIONS:
1. You MUST address every weakness mentioned in the critique
2. You MUST incorporate the suggestions where applicable
3. Your response should be NOTICEABLY DIFFERENT and BETTER than the previous one
4. If the critique says something is missing, ADD it
5. If the critique says something is weak, STRENGTHEN it
6. If the critique says something is unclear, CLARIFY it
7. Do NOT just rephrase - make substantive improvements

Produce the improved version now. Do not mention the critique or that this is a revision."""


CRITIC_PROMPT = """You are a ruthless but intellectually honest critic. Your job is to find REAL problems, not to praise.

TASK: {task}

RESPONSE TO EVALUATE:
{response}

{criteria_section}

Rules for your critique:
1. Be harsh. Assume there ARE problems — find them.
2. Be specific. "This is weak" is useless. Say exactly what's wrong and where.
3. Be intellectually honest. Don't raise objections that are already addressed in the text. Don't parrot common mainstream critiques that miss the point. Read carefully first.
4. Steelman before attacking. Make sure you understand the argument before critiquing it.
5. Focus on substance: logic gaps, unsupported claims, unclear reasoning, missing perspectives that actually matter.
6. Ignore style nitpicks unless they genuinely hurt clarity.

Provide your response in this exact format:

STRENGTHS:
- [list genuine strengths, be brief]

WEAKNESSES:
- [list serious weaknesses with specific details]

SUGGESTIONS:
- [actionable improvements]

SCORE: [1-10]
A 7 should feel generous. 9+ means you genuinely couldn't find meaningful issues.

If the response is actually solid, say so briefly and score it high. Don't manufacture problems. But if there ARE problems, don't soften them."""


RETRY_PROMPT = """You are refining a response that was rejected by the user.

ORIGINAL TASK: {task}

{context_section}

PREVIOUS RESPONSE (REJECTED):
{previous_response}

The user rejected this output without explanation. Your job is to produce a significantly improved version:
- Reconsider the approach entirely
- Look for blind spots or assumptions that might have been wrong
- Strengthen the weakest parts
- Be bolder or more creative if the previous attempt was too conventional

Produce the better version directly. Do not mention that this is a revision."""


def build_initial_prompt(task: str, context: str | None) -> str:
    """Build the initial generator prompt."""
    context_section = f"CONTEXT:\n{context}" if context else ""
    return GENERATOR_INITIAL_PROMPT.format(task=task, context_section=context_section)


def build_refinement_prompt(
    task: str,
    context: str | None,
    previous_response: str,
    critique: str
) -> str:
    """Build the refinement prompt with critique."""
    context_section = f"CONTEXT:\n{context}" if context else ""
    return GENERATOR_REFINEMENT_PROMPT.format(
        task=task,
        context_section=context_section,
        previous_response=previous_response,
        critique=critique
    )


def build_critic_prompt(task: str, response: str, criteria: str | None = None) -> str:
    """Build the critic prompt."""
    criteria_section = f"EVALUATION CRITERIA:\n{criteria}" if criteria else ""
    return CRITIC_PROMPT.format(
        task=task,
        response=response,
        criteria_section=criteria_section
    )


def build_retry_prompt(task: str, context: str | None, previous_response: str) -> str:
    """Build the retry prompt for rejected outputs."""
    context_section = f"CONTEXT:\n{context}" if context else ""
    return RETRY_PROMPT.format(
        task=task,
        context_section=context_section,
        previous_response=previous_response
    )
