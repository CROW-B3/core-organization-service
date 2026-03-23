import type { AgentResult } from './types';
import {
  buildFallbackAgentResult,
  parseJsonFromLlm,
  runAiPrompt,
  validateSignificance,
} from './types';

const AGENT_NAME = 'business-model-agent';

export async function runBusinessModelAgent(
  ai: Ai,
  contentSummary: string
): Promise<AgentResult> {
  const prompt = `You are a business analyst specializing in company analysis. Analyze the following company website content and product data.

${contentSummary}

Analyze this company's business model. Focus on:
1. What does this company do? What is their core mission?
2. How do they make money? What is their revenue model? (SaaS subscriptions, one-time purchases, marketplace fees, advertising, etc.)
3. What is their value proposition? Why would a customer choose them?
4. What industry/vertical do they operate in?

For each finding, cite SPECIFIC content from the website or product catalog as evidence (actual product names, prices, page content).

Respond ONLY with valid JSON:
{
  "findings": [
    {"observation": "string - specific business model insight", "evidence": "string - cite actual content from the pages/products", "significance": "high|medium|low"}
  ],
  "confidence": 0.0-1.0,
  "summary": "string - 2-3 sentence summary of the business model"
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
