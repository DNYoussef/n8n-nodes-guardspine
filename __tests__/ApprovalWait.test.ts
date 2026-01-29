/**
 * Tests for ApprovalWait node.
 *
 * Covers execute() (approval request creation, wait, webhook URL),
 * webhook() (approval/rejection routing), and error handling.
 * Uses the same mock pattern as nodes.test.ts.
 */

import { ApprovalWait } from '../nodes/ApprovalWait/ApprovalWait.node';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makeExecuteContext(overrides: {
	params?: Record<string, any>;
	credentials?: Record<string, any>;
	httpResponse?: any;
	webhookUrl?: string;
}) {
	const params = overrides.params || {};
	const creds = overrides.credentials || {
		baseUrl: 'http://localhost:8000',
		apiKey: 'test-key',
	};
	const httpResponse = overrides.httpResponse || {};

	return {
		getCredentials: jest.fn().mockResolvedValue(creds),
		getNodeParameter: jest.fn((name: string, _idx: number) => {
			if (name in params) return params[name];
			return '';
		}),
		getInputData: jest.fn(() => [{ json: {} }]),
		getNode: jest.fn(() => ({ id: 'node-abc', name: 'Approval Gate' })),
		getExecutionId: jest.fn(() => 'exec-456'),
		helpers: {
			httpRequest: jest.fn().mockResolvedValue(httpResponse),
		},
		putExecutionToWait: jest.fn(),
		getNodeWebhookUrl: jest.fn(() => overrides.webhookUrl || 'http://n8n:1234/webhook-waiting/approval-callback/exec-456'),
	};
}

function makeWebhookContext(body: Record<string, any>) {
	return {
		getBodyData: jest.fn(() => body),
	};
}

/* ------------------------------------------------------------------ */
/*  execute()                                                         */
/* ------------------------------------------------------------------ */

describe('ApprovalWait execute', () => {
	const defaultParams = {
		diffData: '{"before":"a","after":"b"}',
		riskTier: 2,
		guardType: 'code',
		timeoutMinutes: 30,
		evidenceHash: 'abc123',
		beadId: 'bead-1',
	};

	test('sends approval request to correct endpoint', async () => {
		const ctx = makeExecuteContext({ params: defaultParams });
		const node = new ApprovalWait();
		await node.execute.call(ctx as any);
		expect(ctx.helpers.httpRequest).toHaveBeenCalledTimes(1);
		const call = ctx.helpers.httpRequest.mock.calls[0][0];
		expect(call.method).toBe('POST');
		expect(call.url).toBe('http://localhost:8000/api/v1/guard/approval/request');
	});

	test('sends correct body fields', async () => {
		const ctx = makeExecuteContext({ params: defaultParams });
		const node = new ApprovalWait();
		await node.execute.call(ctx as any);
		const body = ctx.helpers.httpRequest.mock.calls[0][0].body;
		expect(body.risk_tier).toBe(2);
		expect(body.guard_type).toBe('code');
		expect(body.timeout_minutes).toBe(30);
		expect(body.evidence_hash).toBe('abc123');
		expect(body.bead_id).toBe('bead-1');
		expect(body.diff_data).toEqual({ before: 'a', after: 'b' });
		expect(body.workflow_execution_id).toBe('exec-456');
		expect(body.idempotency_key).toBe('exec-456-node-abc');
	});

	test('includes webhook URL in request body', async () => {
		const webhookUrl = 'http://n8n:1234/webhook-waiting/approval-callback/exec-456';
		const ctx = makeExecuteContext({ params: defaultParams, webhookUrl });
		const node = new ApprovalWait();
		await node.execute.call(ctx as any);
		const body = ctx.helpers.httpRequest.mock.calls[0][0].body;
		expect(body.resume_webhook_url).toBe(webhookUrl);
	});

	test('puts execution to wait with correct timeout', async () => {
		const now = Date.now();
		jest.spyOn(Date, 'now').mockReturnValue(now);
		const ctx = makeExecuteContext({ params: { ...defaultParams, timeoutMinutes: 45 } });
		const node = new ApprovalWait();
		await node.execute.call(ctx as any);
		expect(ctx.putExecutionToWait).toHaveBeenCalledTimes(1);
		const waitDate = ctx.putExecutionToWait.mock.calls[0][0] as Date;
		expect(waitDate.getTime()).toBe(now + 45 * 60_000);
		(Date.now as jest.Mock).mockRestore();
	});

	test('returns empty arrays (workflow paused)', async () => {
		const ctx = makeExecuteContext({ params: defaultParams });
		const node = new ApprovalWait();
		const result = await node.execute.call(ctx as any);
		expect(result).toEqual([[]]);
	});

	test('uses default evidence hash when empty', async () => {
		const ctx = makeExecuteContext({
			params: { ...defaultParams, evidenceHash: '', beadId: '' },
		});
		const node = new ApprovalWait();
		await node.execute.call(ctx as any);
		const body = ctx.helpers.httpRequest.mock.calls[0][0].body;
		expect(body.evidence_hash).toBe('0'.repeat(64));
		expect(body.bead_id).toBeNull();
	});

	test('handles non-string diffData (object passthrough)', async () => {
		const ctx = makeExecuteContext({
			params: { ...defaultParams, diffData: { raw: true } },
		});
		const node = new ApprovalWait();
		await node.execute.call(ctx as any);
		const body = ctx.helpers.httpRequest.mock.calls[0][0].body;
		expect(body.diff_data).toEqual({ raw: true });
	});

	test('handles empty diffData', async () => {
		const ctx = makeExecuteContext({
			params: { ...defaultParams, diffData: '' },
		});
		const node = new ApprovalWait();
		await node.execute.call(ctx as any);
		const body = ctx.helpers.httpRequest.mock.calls[0][0].body;
		expect(body.diff_data).toBeNull();
	});

	test('includes Authorization header', async () => {
		const ctx = makeExecuteContext({ params: defaultParams });
		const node = new ApprovalWait();
		await node.execute.call(ctx as any);
		const headers = ctx.helpers.httpRequest.mock.calls[0][0].headers;
		expect(headers.Authorization).toBe('Bearer test-key');
	});

	test('falls back to credentials baseUrl when getNodeWebhookUrl unavailable', async () => {
		const ctx = makeExecuteContext({ params: defaultParams });
		ctx.getNodeWebhookUrl = undefined as any;
		const node = new ApprovalWait();
		await node.execute.call(ctx as any);
		const body = ctx.helpers.httpRequest.mock.calls[0][0].body;
		expect(body.resume_webhook_url).toBe('http://localhost:8000/webhook-waiting/approval-callback');
	});
});

/* ------------------------------------------------------------------ */
/*  execute() error handling                                          */
/* ------------------------------------------------------------------ */

describe('ApprovalWait execute errors', () => {
	const defaultParams = {
		diffData: '{}',
		riskTier: 1,
		guardType: 'generic',
		timeoutMinutes: 60,
		evidenceHash: '',
		beadId: '',
	};

	test('throws NodeOperationError on API failure', async () => {
		const ctx = makeExecuteContext({ params: defaultParams });
		ctx.helpers.httpRequest.mockRejectedValue(new Error('Connection refused'));
		const node = new ApprovalWait();
		await expect(node.execute.call(ctx as any)).rejects.toThrow(
			'Failed to create approval request: Connection refused',
		);
	});

	test('throws NodeOperationError on HTTP 500', async () => {
		const ctx = makeExecuteContext({ params: defaultParams });
		ctx.helpers.httpRequest.mockRejectedValue(new Error('500 Internal Server Error'));
		const node = new ApprovalWait();
		await expect(node.execute.call(ctx as any)).rejects.toThrow(
			'Failed to create approval request',
		);
	});

	test('throws on missing credentials', async () => {
		const ctx = makeExecuteContext({ params: defaultParams });
		ctx.getCredentials.mockRejectedValue(new Error('No credentials found'));
		const node = new ApprovalWait();
		await expect(node.execute.call(ctx as any)).rejects.toThrow('No credentials found');
	});
});

/* ------------------------------------------------------------------ */
/*  webhook()                                                         */
/* ------------------------------------------------------------------ */

describe('ApprovalWait webhook', () => {
	test('routes approved decision to first output', async () => {
		const ctx = makeWebhookContext({
			decision: 'approved',
			decided_by: 'user-1',
			reason: 'Looks good',
		});
		const node = new ApprovalWait();
		const result = await node.webhook.call(ctx as any);
		expect(result.webhookResponse).toBe('OK');
		expect(result.workflowData![0].length).toBe(1);
		expect(result.workflowData![1].length).toBe(0);
		const item = result.workflowData![0][0].json as any;
		expect(item.decision).toBe('approved');
		expect(item.decided_by).toBe('user-1');
		expect(item.reason).toBe('Looks good');
		expect(item.decided_at).toBeTruthy();
	});

	test('routes rejected decision to second output', async () => {
		const ctx = makeWebhookContext({
			decision: 'rejected',
			decided_by: 'user-2',
			reason: 'Too risky',
		});
		const node = new ApprovalWait();
		const result = await node.webhook.call(ctx as any);
		expect(result.workflowData![0].length).toBe(0);
		expect(result.workflowData![1].length).toBe(1);
		const item = result.workflowData![1][0].json as any;
		expect(item.decision).toBe('rejected');
		expect(item.decided_by).toBe('user-2');
		expect(item.reason).toBe('Too risky');
	});

	test('defaults reason to empty string when not provided', async () => {
		const ctx = makeWebhookContext({
			decision: 'approved',
			decided_by: 'user-3',
		});
		const node = new ApprovalWait();
		const result = await node.webhook.call(ctx as any);
		const item = result.workflowData![0][0].json as any;
		expect(item.reason).toBe('');
	});

	test('treats unknown decision as rejection', async () => {
		const ctx = makeWebhookContext({
			decision: 'timeout',
			decided_by: 'system',
			reason: 'Timed out after 60 minutes',
		});
		const node = new ApprovalWait();
		const result = await node.webhook.call(ctx as any);
		expect(result.workflowData![0].length).toBe(0);
		expect(result.workflowData![1].length).toBe(1);
	});

	test('includes decided_at timestamp', async () => {
		const ctx = makeWebhookContext({
			decision: 'approved',
			decided_by: 'user-1',
		});
		const node = new ApprovalWait();
		const result = await node.webhook.call(ctx as any);
		const item = result.workflowData![0][0].json as any;
		expect(() => new Date(item.decided_at)).not.toThrow();
		expect(new Date(item.decided_at).getFullYear()).toBeGreaterThanOrEqual(2025);
	});
});
