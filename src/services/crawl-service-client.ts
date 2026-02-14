export interface CrawlResponse {
  metadata: {
    total_pages: number;
    total_chunks: number;
    crawl_duration_seconds: number;
    start_url: string;
    timestamp: string;
  };
  chunks: Array<{
    url: string;
    title: string;
    text: string;
    word_count: number;
    token_count: number;
    chunk_index: number;
  }>;
}

export const getCrawlServiceUrl = (environment: string): string => {
  switch (environment) {
    case 'prod':
      return 'https://infra-crawl-service.bitbybit-b3.workers.dev';
    case 'dev':
      return 'https://infra-crawl-service-dev.bitbybit-b3.workers.dev';
    default:
      return 'http://localhost:8787';
  }
};

export const fetchCrawlData = async (
  crawlServiceUrl: string,
  crawlId: string,
  systemToken?: string
): Promise<CrawlResponse | null> => {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (systemToken) {
      headers['X-System-Token'] = 'true';
      headers.Authorization = `Bearer ${systemToken}`;
    }

    const response = await fetch(`${crawlServiceUrl}/crawls/${crawlId}`, {
      headers,
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch crawl data: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching crawl data:', error);
    throw error;
  }
};
