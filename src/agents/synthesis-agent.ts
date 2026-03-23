import type { AgentResult } from './types';
import { parseJsonFromLlm, runAiPrompt } from './types';

const AGENT_NAME = 'org-synthesis-agent';

export async function runSynthesisAgent(
  ai: Ai,
  agentResults: AgentResult[]
): Promise<string> {
  const agentFindings = agentResults
    .map(r => {
      const findings = r.findings
        .map(
          f =>
            `  - [${f.significance}] ${f.observation} (Evidence: ${f.evidence})`
        )
        .join('\n');
      return `${r.agentName} (confidence: ${r.confidence}):\nSummary: ${r.summary}\nFindings:\n${findings || '  No findings'}`;
    })
    .join('\n\n');

  const prompt = `You are a synthesis analyst creating a comprehensive company context profile. Multiple specialist agents have analyzed a company's website and product data. Merge their analyses into a single, cohesive company context.

Agent Analysis Results:
${agentFindings}

CRITICAL INSTRUCTIONS:
- Synthesize these analyses into a comprehensive company context of 4-6 paragraphs.
- Be SPECIFIC — cite actual products, prices, features, and pages discovered by the agents.
- Do NOT use generic language like "they offer various products." Instead say exactly what products they offer.
- The context should be useful for someone who needs to understand this company quickly — a customer support agent, a sales rep, or an analyst.
- Cover: company overview, products/services, target market, competitive positioning, and brand identity.
- Write in a professional, analytical tone.
- Do NOT include any JSON formatting or metadata — output only the context paragraphs as plain text.

Respond ONLY with valid JSON:
{
  "context": "string - the full 4-6 paragraph company context"
}`;

  const response = await runAiPrompt(ai, prompt, 4000);
  if (!response) {
    // Fallback: concatenate agent summaries
    return agentResults
      .filter(r => r.summary && r.confidence > 0.1)
      .map(r => r.summary)
      .join('\n\n');
  }

  const parsed = parseJsonFromLlm<{ context?: string }>(response);
  if (!parsed?.context) {
    // Try to extract plain text if JSON parsing fails
    // The model might have returned the context directly without JSON
    const trimmed = response.trim();
    if (trimmed.length > 100) return trimmed;

    // Final fallback: concatenate agent summaries
    return agentResults
      .filter(r => r.summary && r.confidence > 0.1)
      .map(r => r.summary)
      .join('\n\n');
  }

  return parsed.context;
}
