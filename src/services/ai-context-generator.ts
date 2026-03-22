import type { CrawlResponse } from './crawl-service-client';
import { streamText } from 'ai';
import { createWorkersAI } from 'workers-ai-provider';

interface ChunkContext {
  url: string;
  title: string;
  text: string;
}

const processChunkWithContext = async (
  ai: Ai,
  chunk: ChunkContext,
  accumulatedContext: string
): Promise<string> => {
  const workersai = createWorkersAI({
    binding: ai,
    gateway: { id: 'crow-ai-gateway', skipCache: false },
  });

  const prompt = `You are analyzing website content to build a company context.

Previous context:
${accumulatedContext}

New content from ${chunk.url} (${chunk.title}):
${chunk.text.substring(0, 2000)}

Task: Extract key information about this company. Focus on:
- Business model and offerings
- Target audience
- Key features or products mentioned
- Company values or mission

Provide a concise 2-3 sentence addition to the context.`;

  const result = await streamText({
    model: workersai(
      '@cf/meta/llama-3.1-8b-instruct' as Parameters<typeof workersai>[0]
    ),
    prompt,
    maxOutputTokens: 200,
  });

  let chunkResponse = '';
  for await (const textPart of result.textStream) {
    chunkResponse += textPart;
  }

  return chunkResponse.trim();
};

const generateFinalSummary = async (
  ai: Ai,
  accumulatedContext: string,
  metadata: CrawlResponse['metadata']
): Promise<string> => {
  const workersai = createWorkersAI({
    binding: ai,
    gateway: { id: 'crow-ai-gateway', skipCache: false },
  });

  const prompt = `Based on analyzing ${metadata.total_pages} pages of a company website, here's the accumulated context:

${accumulatedContext}

Task: Create a comprehensive company context summary (4-6 paragraphs) that includes:
1. Company overview and primary business
2. Products/services offered
3. Target market and audience
4. Key differentiators or unique value propositions
5. Overall business positioning

Write in a professional, analytical tone.`;

  const result = await streamText({
    model: workersai(
      '@cf/meta/llama-3.1-8b-instruct' as Parameters<typeof workersai>[0]
    ),
    prompt,
    maxOutputTokens: 1000,
  });

  let summary = '';
  for await (const textPart of result.textStream) {
    summary += textPart;
  }

  return summary.trim();
};

interface ProductRecord {
  id: string;
  title: string;
  description: string;
  price: number | null;
  category: string | null;
}

const buildProductCatalogContext = (products: ProductRecord[]): string => {
  if (products.length === 0) return '';
  const lines = products.slice(0, 30).map(p => {
    const price = p.price ? ` — $${(p.price / 100).toFixed(2)}` : '';
    const cat = p.category ? ` [${p.category}]` : '';
    return `• ${p.title}${price}${cat}: ${p.description?.slice(0, 120) ?? ''}`;
  });
  return `\n\nProduct Catalog (${products.length} products):\n${lines.join('\n')}`;
};

export const generateOrganizationContext = async (
  ai: Ai,
  crawlData: CrawlResponse | null,
  products: ProductRecord[] = []
): Promise<{ summary: string; metadata: Record<string, unknown> }> => {
  let accumulatedContext = buildProductCatalogContext(products);

  if (crawlData) {
    const chunkBatchSize = 5;
    const totalChunks = crawlData.chunks.length;

    for (let i = 0; i < totalChunks; i += chunkBatchSize) {
      const batch = crawlData.chunks.slice(i, i + chunkBatchSize);

      for (const chunk of batch) {
        const chunkContext = await processChunkWithContext(
          ai,
          { url: chunk.url, title: chunk.title, text: chunk.text },
          accumulatedContext
        );
        accumulatedContext += `\n${chunkContext}`;
      }

      if (i + chunkBatchSize < totalChunks) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  if (!accumulatedContext.trim() && products.length === 0) {
    return {
      summary: '',
      metadata: {
        totalPages: 0,
        totalChunks: 0,
        totalWords: 0,
        uniquePages: 0,
        contentTopics: [],
        crawlDuration: 0,
        productsIndexed: 0,
        crawledAt: new Date().toISOString(),
      },
    };
  }

  const fallbackMetadata = {
    total_pages: 0,
    total_chunks: 0,
    crawl_duration_seconds: 0,
    start_url: '',
    timestamp: new Date().toISOString(),
  };
  const finalSummary = await generateFinalSummary(
    ai,
    accumulatedContext,
    crawlData?.metadata ?? fallbackMetadata
  );

  const uniqueUrls = crawlData
    ? new Set(crawlData.chunks.map(c => c.url))
    : new Set<string>();
  const totalWords = crawlData
    ? crawlData.chunks.reduce((sum, chunk) => sum + chunk.word_count, 0)
    : 0;
  const topics = crawlData
    ? [...new Set(crawlData.chunks.map(c => c.title).filter(t => t))].slice(
        0,
        10
      )
    : [];

  return {
    summary: finalSummary,
    metadata: {
      totalPages: crawlData?.metadata.total_pages ?? 0,
      totalChunks: crawlData?.metadata.total_chunks ?? 0,
      totalWords,
      uniquePages: uniqueUrls.size,
      contentTopics: topics,
      crawlDuration: crawlData?.metadata.crawl_duration_seconds ?? 0,
      productsIndexed: products.length,
      crawledAt: new Date().toISOString(),
    },
  };
};
