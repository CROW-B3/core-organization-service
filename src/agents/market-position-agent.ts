import type { AgentResult } from './types';
import {
  buildFallbackAgentResult,
  parseJsonFromLlm,
  runAiPrompt,
  validateSignificance,
} from './types';

const AGENT_NAME = 'market-position-agent';

export async function runMarketPositionAgent(
  ai: Ai,
  contentSummary: string
): Promise<AgentResult> {
  const prompt = `You are a market positioning analyst. Analyze the following company website content and product data.

${contentSummary}

Analyze this company's market position. Focus on:
1. Who is their target audience? (demographics, business size, industry, role)
2. How do they differentiate from competitors? What makes them unique?
3. What competitive advantages do they claim?
4. Do they mention competitors or position against alternatives?
5. What market segment are they targeting? (enterprise, SMB, consumer, niche)

For each finding, cite SPECIFIC content from the website (messaging, taglines, testimonials, case studies) as evidence.

Respond ONLY with valid JSON:
{
  "findings": [
    {"observation": "string - specific market position insight", "evidence": "string - cite actual website content, messaging, testimonials", "significance": "high|medium|low"}
  ],
  "confidence": 0.0-1.0,
  "summary": "string - 2-3 sentence summary of market positioning"
}`;

  const response = await runAiPrompt(ai, prompt, 3000);
  if (!response) return buildFallbackAgentResult(AGENT_NAME);

  const parsed = parseJsonFromLlm<{
    findings?: {
      observation: string;
      evidence: string;
      significance: string;
    }[];
    confidence?: number;
    summary?: string;
  }>(response);

  if (!parsed) return buildFallbackAgentResult(AGENT_NAME);

  return {
    agentName: AGENT_NAME,
    findings: (parsed.findings ?? []).map(f => ({
      observation: f.observation,
      evidence: f.evidence,
      significance: validateSignificance(f.significance),
    })),
    confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
    summary: parsed.summary ?? '',
  };
}
