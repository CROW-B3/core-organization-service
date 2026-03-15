import type { ContextGenerationMessage, Environment } from './types';
import { drizzle } from 'drizzle-orm/d1';
import { sign } from 'hono/jwt';
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

interface ProductRecord {
  id: string;
  title: string;
  description: string;
  price: number | null;
  category: string | null;
}

const buildSystemToken = async (secret: string): Promise<string> =>
  sign(
    {
      sub: 'system',
      type: 'system',
      service: 'organization-service',
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    secret,
    'HS256'
  );

const fetchOrganizationProducts = async (
  env: Environment,
  organizationId: string
): Promise<ProductRecord[]> => {
  try {
    const token = await buildSystemToken(env.BETTER_AUTH_SECRET);
    const response = await fetch(
      `${env.PRODUCT_SERVICE_URL}/api/v1/products/organization/${organizationId}?page=1&pageSize=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) return [];
    const data = (await response.json()) as { products?: ProductRecord[] };
    return data.products ?? [];
  } catch {
    return [];
  }
};

export const handleContextGenerationMessage = async (
  message: ContextGenerationMessage,
  env: Environment
): Promise<void> => {
  const database = drizzle(env.DB, { schema });

  if (message.crawlId) {
    const existing = await fetchContextByCrawlId(database, message.crawlId);
    if (existing) return;
  }

  const products = await fetchOrganizationProducts(env, message.organizationId);

  const crawlServiceUrl = getCrawlServiceUrl(env.ENVIRONMENT);
  const crawlData = message.crawlId
    ? await fetchCrawlData(crawlServiceUrl, message.crawlId)
    : null;

  const { summary, metadata } = await generateOrganizationContext(
    env.AI,
    crawlData,
    products
  );

  const structuredData = {
    summary,
    ...metadata,
  };

  await createOrganizationContext(
    database,
    message.organizationId,
    message.crawlId ?? 'manual',
    structuredData,
    new Date(message.timestamp)
  );
};
