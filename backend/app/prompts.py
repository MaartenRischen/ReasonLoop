"""Prompt templates for the reasoning engine."""

# Length instructions based on output_length setting
# These guide the model to produce complete responses of the target length
LENGTH_INSTRUCTIONS = {
    "short": "LENGTH REQUIREMENT: Keep your response BRIEF and CONCISE (~500 words max). Be direct, skip preamble, focus only on the most essential points. Provide a COMPLETE response within this limit - do not leave thoughts unfinished.",
    "medium": "LENGTH REQUIREMENT: Keep your response focused and well-structured (~1500-2000 words). Cover key points thoroughly but avoid unnecessary elaboration. Ensure your response is COMPLETE and reaches a proper conclusion.",
    "long": "Provide a comprehensive, detailed response. Be thorough and explore the topic fully."
}

GENERATOR_INITIAL_PROMPT = """You are solving a complex task. Think carefully and provide your best response.

TASK: {task}

{context_section}

{length_instruction}

Provide a focused response. Structure your response clearly."""


GENERATOR_REFINEMENT_PROMPT = """You are refining a response based on critique. Your job is to produce a SIGNIFICANTLY IMPROVED version.

ORIGINAL TASK: {task}

{context_section}

PREVIOUS RESPONSE:
{previous_response}

CRITIQUE OF THE ABOVE:
{critique}

{length_instruction}

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


CRITIQUE_ONLY_INITIAL_PROMPT = """You are a thorough analyst providing detailed critique and feedback. Your job is to ANALYZE the provided content, NOT to rewrite it.

TASK: {task}

{context_section}

CONTENT TO ANALYZE:
{content}

{length_instruction}

Provide analysis and critique. Focus on:
- Strengths and what works well
- Weaknesses and areas for improvement
- Specific, actionable suggestions
- Logical gaps or inconsistencies
- Missing perspectives or considerations

Be intellectually honest. Do NOT rewrite or recreate the content - only analyze it."""


CRITIQUE_ONLY_FOLLOWUP_PROMPT = """You are providing additional analysis from a different angle. Previous critiques have already covered some ground.

ORIGINAL TASK: {task}

{context_section}

CONTENT BEING ANALYZED:
{content}

PREVIOUS CRITIQUE:
{previous_critique}

{length_instruction}

Provide ADDITIONAL analysis not yet covered. Look for:
- Deeper implications or consequences
- Alternative perspectives not yet considered
- Subtle issues that might have been missed
- Second-order effects or considerations

Do NOT repeat points already made. Do NOT rewrite the content. Provide fresh analytical insights."""


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


def build_initial_prompt(task: str, context: str | None, output_length: str = "long") -> str:
    """Build the initial generator prompt."""
    context_section = f"CONTEXT:\n{context}" if context else ""
    length_instruction = LENGTH_INSTRUCTIONS.get(output_length, LENGTH_INSTRUCTIONS["long"])
    return GENERATOR_INITIAL_PROMPT.format(
        task=task,
        context_section=context_section,
        length_instruction=length_instruction
    )


def build_refinement_prompt(
    task: str,
    context: str | None,
    previous_response: str,
    critique: str,
    output_length: str = "long"
) -> str:
    """Build the refinement prompt with critique."""
    context_section = f"CONTEXT:\n{context}" if context else ""
    length_instruction = LENGTH_INSTRUCTIONS.get(output_length, LENGTH_INSTRUCTIONS["long"])
    return GENERATOR_REFINEMENT_PROMPT.format(
        task=task,
        context_section=context_section,
        previous_response=previous_response,
        critique=critique,
        length_instruction=length_instruction
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


def build_critique_only_initial(task: str, context: str | None, content: str, output_length: str = "long") -> str:
    """Build the initial critique-only prompt."""
    context_section = f"CONTEXT:\n{context}" if context else ""
    length_instruction = LENGTH_INSTRUCTIONS.get(output_length, LENGTH_INSTRUCTIONS["long"])
    return CRITIQUE_ONLY_INITIAL_PROMPT.format(
        task=task,
        context_section=context_section,
        content=content,
        length_instruction=length_instruction
    )


def build_critique_only_followup(task: str, context: str | None, content: str, previous_critique: str, output_length: str = "long") -> str:
    """Build a follow-up critique prompt for additional analysis."""
    context_section = f"CONTEXT:\n{context}" if context else ""
    length_instruction = LENGTH_INSTRUCTIONS.get(output_length, LENGTH_INSTRUCTIONS["long"])
    return CRITIQUE_ONLY_FOLLOWUP_PROMPT.format(
        task=task,
        context_section=context_section,
        content=content,
        previous_critique=previous_critique,
        length_instruction=length_instruction
    )
