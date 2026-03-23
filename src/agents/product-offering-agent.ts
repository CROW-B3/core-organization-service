import type { AgentResult } from './types';
import {
  buildFallbackAgentResult,
  parseJsonFromLlm,
  runAiPrompt,
  validateSignificance,
} from './types';

const AGENT_NAME = 'product-offering-agent';

export async function runProductOfferingAgent(
  ai: Ai,
  contentSummary: string
): Promise<AgentResult> {
  const prompt = `You are a product analyst. Analyze the following company website content and product data.

${contentSummary}

Analyze this company's product and service offerings. Focus on:
1. What products or services do they sell? List specific items with names and descriptions.
2. What are the key features of each product/service?
3. What pricing tiers or models do they offer? Cite specific prices if available.
4. Are there bundles, add-ons, or upsells?
5. What categories or product lines exist?

For each finding, cite SPECIFIC products, prices, features, or page content as evidence.

Respond ONLY with valid JSON:
{
  "findings": [
    {"observation": "string - specific product/service insight", "evidence": "string - cite actual product names, prices, features", "significance": "high|medium|low"}
  ],
  "confidence": 0.0-1.0,
  "summary": "string - 2-3 sentence summary of the product offerings"
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
