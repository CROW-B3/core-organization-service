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
  const workersai = createWorkersAI({ binding: ai });

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
  const workersai = createWorkersAI({ binding: ai });

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

export const generateOrganizationContext = async (
  ai: Ai,
  crawlData: CrawlResponse
): Promise<{ summary: string; metadata: Record<string, unknown> }> => {
  let accumulatedContext = '';

  // Process chunks in batches of 5 for manageable context
  const chunkBatchSize = 5;
  const totalChunks = crawlData.chunks.length;

  for (let i = 0; i < totalChunks; i += chunkBatchSize) {
    const batch = crawlData.chunks.slice(i, i + chunkBatchSize);

    for (const chunk of batch) {
      const chunkContext = await processChunkWithContext(
        ai,
        {
          url: chunk.url,
          title: chunk.title,
          text: chunk.text,
        },
        accumulatedContext
      );

      accumulatedContext += `\n${chunkContext}`;
    }

    // Brief pause between batches to avoid rate limits
    if (i + chunkBatchSize < totalChunks) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Generate final summary from accumulated context
  const finalSummary = await generateFinalSummary(
    ai,
    accumulatedContext,
    crawlData.metadata
  );

  // Extract structured metadata
  const uniqueUrls = new Set(crawlData.chunks.map(c => c.url));
  const totalWords = crawlData.chunks.reduce(
    (sum, chunk) => sum + chunk.word_count,
    0
  );
  const topics = [
    ...new Set(crawlData.chunks.map(c => c.title).filter(t => t)),
  ].slice(0, 10);

  return {
    summary: finalSummary,
    metadata: {
      totalPages: crawlData.metadata.total_pages,
      totalChunks: crawlData.metadata.total_chunks,
      totalWords,
      uniquePages: uniqueUrls.size,
      contentTopics: topics,
      crawlDuration: crawlData.metadata.crawl_duration_seconds,
      crawledAt: new Date().toISOString(),
    },
  };
};
