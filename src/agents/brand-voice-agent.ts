import type { AgentResult } from './types';
import {
  buildFallbackAgentResult,
  parseJsonFromLlm,
  runAiPrompt,
  validateSignificance,
} from './types';

const AGENT_NAME = 'brand-voice-agent';

export async function runBrandVoiceAgent(
  ai: Ai,
  contentSummary: string
): Promise<AgentResult> {
  const prompt = `You are a brand strategist and communications analyst. Analyze the following company website content.

${contentSummary}

Analyze this company's brand voice and messaging. Focus on:
1. What tone do they use? (formal, casual, technical, friendly, authoritative, playful, etc.)
2. What are their key messaging themes? What words/phrases appear repeatedly?
3. How do they address their customers? (you, we, the team, etc.)
4. What emotional appeals do they use? (trust, urgency, exclusivity, community, innovation)
5. Do they use specific brand language, jargon, or coined terms?

For each finding, cite SPECIFIC phrases, headlines, or copy from the website as evidence.

Respond ONLY with valid JSON:
{
  "findings": [
    {"observation": "string - specific brand voice insight", "evidence": "string - cite actual phrases, headlines, copy from the site", "significance": "high|medium|low"}
  ],
  "confidence": 0.0-1.0,
  "summary": "string - 2-3 sentence summary of brand voice and messaging style"
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
