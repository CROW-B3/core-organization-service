export const LLAMA_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

export interface CrawlChunk {
  url: string;
  title: string;
  text: string;
  word_count: number;
  token_count: number;
  chunk_index: number;
}

export interface ProductRecord {
  id: string;
  title: string;
  description: string;
  price: number | null;
  category: string | null;
}

export interface AgentFinding {
  observation: string;
  evidence: string;
  significance: 'high' | 'medium' | 'low';
}

export interface AgentResult {
  agentName: string;
  findings: AgentFinding[];
  confidence: number;
  summary: string;
}

export function parseJsonFromLlm<T>(responseText: string): T | null {
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as T;
  } catch {
    return null;
  }
}

export async function runAiPrompt(
  ai: Ai,
  prompt: string,
  maxTokens: number = 512
): Promise<string> {
  try {
    const result = await ai.run(LLAMA_MODEL as any, {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
    });
    const output = result as { response?: string } | string;
    return typeof output === 'string' ? output : (output?.response ?? '');
  } catch (err) {
    console.error('[org-agent] AI prompt failed:', err);
    return '';
  }
}

export function buildFallbackAgentResult(agentName: string): AgentResult {
  return {
    agentName,
    findings: [],
    confidence: 0.1,
    summary: 'Agent failed to produce results.',
  };
}

export function validateSignificance(s: string): 'high' | 'medium' | 'low' {
  if (s === 'high' || s === 'medium' || s === 'low') return s;
  return 'medium';
}

/**
 * Prepares a condensed text summary from crawl chunks and products,
 * capped at maxChars to avoid blowing context limits on each agent.
 */
export function prepareContentSummary(
  crawlChunks: CrawlChunk[],
  products: ProductRecord[],
  maxChars: number = 8000
): string {
  const parts: string[] = [];
  let charCount = 0;

  // Add product catalog first (high-value structured data)
  if (products.length > 0) {
    const productLines = products.slice(0, 30).map(p => {
      const price = p.price ? ` — $${(p.price / 100).toFixed(2)}` : '';
      const cat = p.category ? ` [${p.category}]` : '';
      return `- ${p.title}${price}${cat}: ${p.description?.slice(0, 100) ?? ''}`;
    });
    const productSection = `Product Catalog (${products.length} total):\n${productLines.join('\n')}`;
    parts.push(productSection);
    charCount += productSection.length;
  }

  // Add crawl chunks, distributing space across pages
  if (crawlChunks.length > 0) {
    const remainingChars = maxChars - charCount;
    const charsPerChunk = Math.max(
      200,
      Math.floor(remainingChars / Math.min(crawlChunks.length, 20))
    );

    for (const chunk of crawlChunks.slice(0, 20)) {
      if (charCount >= maxChars) break;
      const textSlice = chunk.text.slice(0, charsPerChunk);
      const entry = `\n--- Page: ${chunk.url} (${chunk.title}) ---\n${textSlice}`;
      parts.push(entry);
      charCount += entry.length;
    }
  }

  return parts.join('\n');
}
