/**
 * Tests for GuardSpineTrigger node.
 *
 * Covers: webhook event reception, event type filtering, payload parsing.
 * Uses the same mock pattern as ApprovalWait.test.ts.
 */

import { GuardSpineTrigger } from '../nodes/GuardSpineTrigger/GuardSpineTrigger.node';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makeWebhookContext(body: Record<string, any>, eventTypeParam: string = 'all') {
  return {
    getBodyData: jest.fn(() => body),
    getNodeParameter: jest.fn((name: string) => {
      if (name === 'eventType') return eventTypeParam;
      return '';
    }),
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
});
