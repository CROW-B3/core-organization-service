import type { AgentResult, CrawlChunk, ProductRecord } from './types';
import { runBrandVoiceAgent } from './brand-voice-agent';
import { runBusinessModelAgent } from './business-model-agent';
import { runMarketPositionAgent } from './market-position-agent';
import { runProductOfferingAgent } from './product-offering-agent';
import { runSynthesisAgent } from './synthesis-agent';
import { buildFallbackAgentResult, prepareContentSummary } from './types';

export async function generateContextWithAgents(
  ai: Ai,
  gatewayId: string,
  crawlChunks: CrawlChunk[],
  products: ProductRecord[]
): Promise<{ context: string; agentResults: AgentResult[] }> {
  const startTime = Date.now();

  // Prepare a condensed content summary to pass to each agent
  const contentSummary = prepareContentSummary(crawlChunks, products);

  if (!contentSummary.trim()) {
    console.log(`[org-agents] No content to analyze for gateway ${gatewayId}`);
    return { context: '', agentResults: [] };
  }

  console.log(
    `[org-agents] Starting multi-agent analysis for gateway ${gatewayId} ` +
      `(${crawlChunks.length} chunks, ${products.length} products, ` +
      `${contentSummary.length} chars summary)`
  );

  // Run all 4 specialist agents in parallel
  const parallelResults = await Promise.allSettled([
    runBusinessModelAgent(ai, contentSummary),
    runProductOfferingAgent(ai, contentSummary),
    runMarketPositionAgent(ai, contentSummary),
    runBrandVoiceAgent(ai, contentSummary),
  ]);

  const agentNames = [
    'business-model-agent',
    'product-offering-agent',
    'market-position-agent',
    'brand-voice-agent',
  ];

  const agentResults = parallelResults.map((r, i) => {
    if (r.status === 'fulfilled') {
      console.log(
        `[org-agents] ${agentNames[i]} completed (confidence: ${r.value.confidence})`
      );
      return r.value;
    }
    console.error(`[org-agents] ${agentNames[i]} failed:`, r.reason);
    return buildFallbackAgentResult(agentNames[i]);
  });

  // Run synthesis sequentially after all specialists complete
  const context = await runSynthesisAgent(ai, agentResults);

  const elapsed = Date.now() - startTime;
  console.log(
    `[org-agents] Multi-agent analysis complete for gateway ${gatewayId} in ${elapsed}ms`
  );

  return { context, agentResults };
}
