import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock D1 ────────────────────────────────────────────────────────────
const createMockD1 = () => ({
  prepare: vi.fn(() => ({
    bind: vi.fn(() => ({
      all: vi.fn(() => ({ results: [] })),
      first: vi.fn(() => null),
      run: vi.fn(() => ({ success: true })),
    })),
    all: vi.fn(() => ({ results: [] })),
    first: vi.fn(() => null),
    run: vi.fn(() => ({ success: true })),
  })),
  batch: vi.fn(() => []),
  exec: vi.fn(),
  dump: vi.fn(),
});

const createMockR2 = () => ({
  put: vi.fn(),
  get: vi.fn(() => null),
  delete: vi.fn(),
  list: vi.fn(() => ({ objects: [] })),
  head: vi.fn(() => null),
});

const createMockQueue = () => ({
  send: vi.fn(),
  sendBatch: vi.fn(),
});

const mockEnv = {
  DB: createMockD1(),
  R2_BUCKET: createMockR2(),
  AI: { run: vi.fn() },
  BETTER_AUTH_SECRET: 'test-secret',
  AUTH_SERVICE_URL: 'http://localhost:3001',
  USER_SERVICE_URL: 'http://localhost:8002',
  PRODUCT_SERVICE_URL: 'http://localhost:8003',
  ENVIRONMENT: 'local' as const,
  INTERNAL_GATEWAY_KEY: 'test-key',
  SERVICE_API_KEY_AUTH: 'svc-auth-key',
  SERVICE_API_KEY_ORGANIZATION: 'svc-org-key',
  SERVICE_API_KEY_BILLING: 'svc-billing-key',
  SERVICE_API_KEY_NOTIFICATION: 'svc-notif-key',
  SERVICE_API_KEY_GATEWAY: 'svc-gw-key',
  ORGANIZATION_CONTEXT_QUEUE: createMockQueue(),
};

// Organization service exports { fetch, queue }
import orgService from '../index';

const request = async (
  path: string,
  init?: RequestInit
): Promise<Response> => {
  const url = `http://localhost${path}`;
  const req = new Request(url, init);
  return orgService.fetch(req, mockEnv, {} as ExecutionContext);
};

describe('core-organization-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.DB = createMockD1();
    mockEnv.R2_BUCKET = createMockR2();
  });

  // ── Root / Hello World ────────────────────────────────────────────
  describe('GET /', () => {
    it('returns 200 with hello message', async () => {
      const res = await request('/');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('text', 'Hello Hono!');
    });
  });

  // ── Health Check ──────────────────────────────────────────────────
  describe('GET /health', () => {
    it('returns 200 with healthy status', async () => {
      const res = await request('/health');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('status', 'healthy');
      expect(body).toHaveProperty('service', 'core-organization-service');
    });
  });

  // ── Internal Key Auth ─────────────────────────────────────────────
  describe('X-Internal-Key middleware', () => {
    it('returns 401 when X-Internal-Key is missing on /api/v1 routes', async () => {
      const res = await request('/api/v1/organizations', {
        method: 'GET',
      });
      expect(res.status).toBe(401);
    });

    it('returns 401 when X-Internal-Key is wrong', async () => {
      const res = await request('/api/v1/organizations', {
        method: 'GET',
        headers: { 'X-Internal-Key': 'wrong-key' },
      });
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/v1/organizations (list) ──────────────────────────────
  describe('GET /api/v1/organizations', () => {
    it('returns list of organizations', async () => {
      const res = await request('/api/v1/organizations', {
        headers: {
          'X-Internal-Key': 'test-key',
          'X-Service-API-Key': 'svc-org-key',
        },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('organizations');
    });
  });

  // ── POST /api/v1/organizations (create) ───────────────────────────
  describe('POST /api/v1/organizations', () => {
    it('returns 401 without service API key', async () => {
      const res = await request('/api/v1/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Key': 'test-key',
        },
        body: JSON.stringify({
          betterAuthOrgId: 'ba-org-1',
          name: 'Test Org',
        }),
      });
      expect(res.status).toBe(401);
    });

    it('returns 400 when missing required fields', async () => {
      const res = await request('/api/v1/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Key': 'test-key',
          'X-Service-API-Key': 'svc-org-key',
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });
  });

  // ── GET /api/v1/organizations/:id (JWT-protected) ─────────────────
  describe('GET /api/v1/organizations/:id', () => {
    it('returns 401 without JWT token', async () => {
      // TODO: add JWT mock
      const res = await request('/api/v1/organizations/org-123', {
        headers: {
          'X-Internal-Key': 'test-key',
        },
      });
      // JWT middleware rejects requests without Authorization header
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/v1/organizations/:id/members (JWT-protected) ────────
  describe('GET /api/v1/organizations/:id/members', () => {
    it('returns 401 without JWT token', async () => {
      // TODO: add JWT mock
      const res = await request('/api/v1/organizations/org-123/members', {
        headers: {
          'X-Internal-Key': 'test-key',
        },
      });
      expect(res.status).toBe(401);
    });
  });

  // ── Not Found ─────────────────────────────────────────────────────
  describe('Not found handler', () => {
    it('returns 404 for unknown routes', async () => {
      const res = await request('/does-not-exist');
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toHaveProperty('error', 'Not Found');
    });
  });
});
