import type { ContextGenerationMessage, Environment } from './types';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './db/schema';
import { generateOrganizationContext } from './services/ai-context-generator';
import {
  fetchCrawlData,
  getCrawlServiceUrl,
} from './services/crawl-service-client';
import {
  createOrganizationContext,
  fetchContextByCrawlId,
} from './services/organization-context-service';

export const handleContextGenerationMessage = async (
  message: ContextGenerationMessage,
  env: Environment
): Promise<void> => {
  const database = drizzle(env.DB, { schema });

  const existing = await fetchContextByCrawlId(database, message.crawlId);
  if (existing) return;

  const crawlServiceUrl = getCrawlServiceUrl(env.ENVIRONMENT);
  const crawlData = await fetchCrawlData(crawlServiceUrl, message.crawlId);

  if (!crawlData) {
    throw new Error(`Crawl ${message.crawlId} not found`);
  }

  const { summary, metadata } = await generateOrganizationContext(
    env.AI,
    crawlData
  );

  const structuredData = {
    summary,
    ...metadata,
  };

  await createOrganizationContext(
    database,
    message.organizationId,
    message.crawlId,
    structuredData,
    new Date(message.timestamp)
  );
};
