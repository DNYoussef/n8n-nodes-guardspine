/**
 * Tests for GuardSpineTrigger node.
 *
 * Covers: webhook event reception, event type filtering, payload parsing.
 * Uses the same mock pattern as ApprovalWait.test.ts.
 */

import { GuardSpineTrigger } from '../nodes/GuardSpineTrigger/GuardSpineTrigger.node';
import { createHmac } from 'crypto';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function canonicalJson(value: unknown): string {
  if (value === undefined) {
    return 'null';
  }
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(obj[key])}`
  )).join(',')}}`;
}

function signBody(body: Record<string, any>, secret = 'test-secret'): string {
  return createHmac('sha256', secret).update(canonicalJson(body)).digest('hex');
}

function makeWebhookContext(
  body: Record<string, any>,
  eventTypeParam: string = 'all',
  overrides: { secret?: string; signature?: string | null } = {},
) {
  const secret = overrides.secret ?? 'test-secret';
  const signature = overrides.signature === undefined ? signBody(body, secret) : overrides.signature;
  return {
    getCredentials: jest.fn().mockResolvedValue({ webhookSecret: secret }),
    getBodyData: jest.fn(() => body),
    getNodeParameter: jest.fn((name: string) => {
      if (name === 'eventType') return eventTypeParam;
      return '';
    }),
    getRequestObject: jest.fn(() => ({
      headers: signature ? { 'x-guardspine-signature': signature } : {},
    })),
  };
}

/* ------------------------------------------------------------------ */
/*  Description                                                       */
/* ------------------------------------------------------------------ */

describe('GuardSpineTrigger description', () => {
  const node = new GuardSpineTrigger();

  test('has required description fields', () => {
    const d = node.description;
    expect(d.displayName).toBe('GuardSpine Trigger');
    expect(d.name).toBe('guardSpineTrigger');
    expect(d.version).toBe(1);
    expect(d.group).toEqual(['trigger']);
    expect(d.inputs).toEqual([]);
    expect(d.outputs).toEqual(['main']);
  });

  test('has webhook configuration', () => {
    expect(node.description.webhooks).toBeDefined();
    expect(node.description.webhooks!.length).toBe(1);
    expect(node.description.webhooks![0].path).toBe('guardspine-event');
    expect(node.description.webhooks![0].httpMethod).toBe('POST');
  });

  test('has eventType property with all options', () => {
    const prop = node.description.properties.find((p) => p.name === 'eventType');
    expect(prop).toBeDefined();
    expect(prop!.type).toBe('options');
    const values = (prop as any).options.map((o: any) => o.value);
    expect(values).toContain('all');
    expect(values).toContain('risk_alert');
    expect(values).toContain('approval_request');
    expect(values).toContain('bundle_created');
    expect(values).toContain('scan_completed');
  });
});

/* ------------------------------------------------------------------ */
/*  webhook() - event reception                                       */
/* ------------------------------------------------------------------ */

describe('GuardSpineTrigger webhook', () => {
  test('accepts any event when filter is "all"', async () => {
    const ctx = makeWebhookContext({
      event_type: 'risk_alert',
      timestamp: '2026-02-15T12:00:00Z',
      payload: { risk_tier: 3, bundle_id: 'b-1' },
    }, 'all');

    const node = new GuardSpineTrigger();
    const result = await node.webhook.call(ctx as any);

    expect(result.webhookResponse).toBe('OK');
    expect(result.workflowData![0].length).toBe(1);
    const item = result.workflowData![0][0].json as any;
    expect(item.event_type).toBe('risk_alert');
    expect(item.payload.risk_tier).toBe(3);
    expect(item.received_at).toBeTruthy();
    expect(item.signature_verified).toBe(true);
  });

  test('accepts matching event type', async () => {
    const ctx = makeWebhookContext({
      event_type: 'scan_completed',
      timestamp: '2026-02-15T12:00:00Z',
      payload: { scan_id: 's-1' },
    }, 'scan_completed');

    const node = new GuardSpineTrigger();
    const result = await node.webhook.call(ctx as any);

    expect(result.workflowData![0].length).toBe(1);
    expect((result.workflowData![0][0].json as any).event_type).toBe('scan_completed');
  });

  test('filters out non-matching event type', async () => {
    const ctx = makeWebhookContext({
      event_type: 'risk_alert',
      timestamp: '2026-02-15T12:00:00Z',
      payload: {},
    }, 'bundle_created');

    const node = new GuardSpineTrigger();
    const result = await node.webhook.call(ctx as any);

    expect(result.workflowData![0].length).toBe(0);
  });

  test('defaults event_type to "unknown" when missing', async () => {
    const ctx = makeWebhookContext({ payload: { data: 'test' } }, 'all');

    const node = new GuardSpineTrigger();
    const result = await node.webhook.call(ctx as any);

    expect(result.workflowData![0].length).toBe(1);
    expect((result.workflowData![0][0].json as any).event_type).toBe('unknown');
  });

  test('uses body as payload when payload field missing', async () => {
    const body = { event_type: 'risk_alert', custom_field: 'value' };
    const ctx = makeWebhookContext(body, 'all');

    const node = new GuardSpineTrigger();
    const result = await node.webhook.call(ctx as any);

    const item = result.workflowData![0][0].json as any;
    expect(item.payload.event_type).toBe('risk_alert');
    expect(item.payload.custom_field).toBe('value');
  });

  test('generates timestamp when missing from body', async () => {
    const ctx = makeWebhookContext({ event_type: 'approval_request' }, 'all');

    const node = new GuardSpineTrigger();
    const result = await node.webhook.call(ctx as any);

    const item = result.workflowData![0][0].json as any;
    expect(item.timestamp).toBeTruthy();
    expect(() => new Date(item.timestamp)).not.toThrow();
  });

  test('accepts sha256-prefixed signatures', async () => {
    const body = { event_type: 'risk_alert', payload: { risk_tier: 3 } };
    const ctx = makeWebhookContext(body, 'all', {
      signature: `sha256=${signBody(body)}`,
    });

    const node = new GuardSpineTrigger();
    const result = await node.webhook.call(ctx as any);

    expect(result.webhookResponse).toBe('OK');
    expect(result.workflowData![0].length).toBe(1);
  });

  test('rejects missing webhook secret', async () => {
    const body = { event_type: 'risk_alert', payload: {} };
    const ctx = makeWebhookContext(body, 'all', { secret: '' });

    const node = new GuardSpineTrigger();
    const result = await node.webhook.call(ctx as any);

    expect(result.webhookResponse).toContain('Webhook Secret is required');
    expect(result.workflowData![0].length).toBe(0);
  });

  test('rejects missing signature', async () => {
    const body = { event_type: 'risk_alert', payload: {} };
    const ctx = makeWebhookContext(body, 'all', { signature: null });

    const node = new GuardSpineTrigger();
    const result = await node.webhook.call(ctx as any);

    expect(result.webhookResponse).toContain('Missing X-GuardSpine-Signature');
    expect(result.workflowData![0].length).toBe(0);
  });

  test('rejects invalid signature', async () => {
    const body = { event_type: 'risk_alert', payload: {} };
    const ctx = makeWebhookContext(body, 'all', { signature: '00' });

    const node = new GuardSpineTrigger();
    const result = await node.webhook.call(ctx as any);

    expect(result.webhookResponse).toContain('Invalid signature');
    expect(result.workflowData![0].length).toBe(0);
  });
});
