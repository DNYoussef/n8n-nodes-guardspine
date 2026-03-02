/**
 * Tests for BeadsList node.
 *
 * Covers: query parameter construction, pagination, filtering, error handling.
 * Uses the same mock pattern as nodes.test.ts.
 */

import { BeadsList } from '../nodes/BeadsList/BeadsList.node';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makeFakeContext(overrides: {
  params?: Record<string, any>;
  credentials?: Record<string, any>;
  httpResponse?: any;
}) {
  const params = overrides.params || {};
  const creds = overrides.credentials || {
    baseUrl: 'http://localhost:8000',
    apiKey: 'test-key',
  };
  const httpResponse = overrides.httpResponse || { items: [], total: 0, limit: 50, offset: 0 };

  return {
    getCredentials: jest.fn().mockResolvedValue(creds),
    getNodeParameter: jest.fn((name: string, _idx: number) => {
      if (name in params) return params[name];
      if (name === 'status') return 'all';
      if (name === 'limit') return 50;
      if (name === 'offset') return 0;
      return '';
    }),
    getInputData: jest.fn(() => [{ json: {} }]),
    getNode: jest.fn(() => ({ id: 'test-node', name: 'BeadsList' })),
    helpers: {
      httpRequest: jest.fn().mockResolvedValue(httpResponse),
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Description                                                       */
/* ------------------------------------------------------------------ */

describe('BeadsList description', () => {
  const node = new BeadsList();

  test('has required description fields', () => {
    const d = node.description;
    expect(d.displayName).toBe('Beads List');
    expect(d.name).toBe('beadsList');
    expect(d.version).toBe(1);
    expect(d.inputs).toEqual(['main']);
    expect(d.outputs).toEqual(['main']);
  });

  test('requires guardSpineApi credentials', () => {
    expect(node.description.credentials).toBeDefined();
    expect(node.description.credentials!.some((c: any) => c.name === 'guardSpineApi')).toBe(true);
  });

  test('has status, owner, tags, limit, offset properties', () => {
    const names = node.description.properties.map((p) => p.name);
    expect(names).toContain('status');
    expect(names).toContain('owner');
    expect(names).toContain('tags');
    expect(names).toContain('limit');
    expect(names).toContain('offset');
  });
});

/* ------------------------------------------------------------------ */
/*  execute()                                                         */
/* ------------------------------------------------------------------ */

describe('BeadsList execute', () => {
  test('calls GET /api/v1/beads/tasks with default params', async () => {
    const ctx = makeFakeContext({});
    const node = new BeadsList();
    await node.execute.call(ctx as any);

    const call = ctx.helpers.httpRequest.mock.calls[0][0];
    expect(call.method).toBe('GET');
    expect(call.url).toContain('/api/v1/beads/tasks?');
    expect(call.url).toContain('limit=50');
    expect(call.url).toContain('offset=0');
    // "all" status should NOT add status param
    expect(call.url).not.toContain('status=');
  });

  test('adds status param when not "all"', async () => {
    const ctx = makeFakeContext({ params: { status: 'ready', limit: 50, offset: 0 } });
    const node = new BeadsList();
    await node.execute.call(ctx as any);

    const url = ctx.helpers.httpRequest.mock.calls[0][0].url;
    expect(url).toContain('status=ready');
  });

  test('adds owner param when provided', async () => {
    const ctx = makeFakeContext({ params: { status: 'all', owner: 'alice', limit: 50, offset: 0 } });
    const node = new BeadsList();
    await node.execute.call(ctx as any);

    const url = ctx.helpers.httpRequest.mock.calls[0][0].url;
    expect(url).toContain('owner=alice');
  });

  test('adds tags param with trimming', async () => {
    const ctx = makeFakeContext({
      params: { status: 'all', tags: ' bug , auth , mobile ', limit: 50, offset: 0 },
    });
    const node = new BeadsList();
    await node.execute.call(ctx as any);

    const url = ctx.helpers.httpRequest.mock.calls[0][0].url;
    expect(url).toContain('tags=bug%2Cauth%2Cmobile');
  });

  test('returns items from response', async () => {
    const items = [
      { id: 'b-1', title: 'Task 1', status: 'ready', priority: '2', owner: null, tags: [], created_at: '2026-01-01' },
      { id: 'b-2', title: 'Task 2', status: 'done', priority: '1', owner: 'bob', tags: ['fix'], created_at: '2026-01-02' },
    ];
    const ctx = makeFakeContext({
      httpResponse: { items, total: 2, limit: 50, offset: 0 },
    });
    const node = new BeadsList();
    const result = await node.execute.call(ctx as any);

    expect(result[0].length).toBe(2);
    expect((result[0][0].json as any).id).toBe('b-1');
    expect((result[0][1].json as any).id).toBe('b-2');
  });

  test('returns empty array for no results', async () => {
    const ctx = makeFakeContext({
      httpResponse: { items: [], total: 0, limit: 50, offset: 0 },
    });
    const node = new BeadsList();
    const result = await node.execute.call(ctx as any);

    expect(result[0].length).toBe(0);
  });

  test('throws NodeOperationError on API failure', async () => {
    const ctx = makeFakeContext({});
    ctx.helpers.httpRequest.mockRejectedValue(new Error('Connection refused'));
    const node = new BeadsList();
    await expect(node.execute.call(ctx as any)).rejects.toThrow('Beads API error');
  });

  test('includes Authorization header', async () => {
    const ctx = makeFakeContext({});
    const node = new BeadsList();
    await node.execute.call(ctx as any);

    const headers = ctx.helpers.httpRequest.mock.calls[0][0].headers;
    expect(headers.Authorization).toBe('Bearer test-key');
  });

  test('respects custom limit and offset', async () => {
    const ctx = makeFakeContext({ params: { status: 'all', limit: 10, offset: 20 } });
    const node = new BeadsList();
    await node.execute.call(ctx as any);

    const url = ctx.helpers.httpRequest.mock.calls[0][0].url;
    expect(url).toContain('limit=10');
    expect(url).toContain('offset=20');
  });
});
