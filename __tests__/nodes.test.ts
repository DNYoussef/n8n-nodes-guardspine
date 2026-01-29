/**
 * Tests for all 7 GuardSpine n8n nodes.
 *
 * These are structural tests -- they verify node descriptions are valid,
 * parameters are correctly defined, and execute() calls the right endpoints.
 * They mock this.helpers.httpRequest so no real API is needed.
 */

import { GuardGate } from '../nodes/GuardGate/GuardGate.node';
import { CodeGuard } from '../nodes/CodeGuard/CodeGuard.node';
import { BeadsCreate } from '../nodes/BeadsCreate/BeadsCreate.node';
import { BeadsUpdate } from '../nodes/BeadsUpdate/BeadsUpdate.node';
import { ApprovalWait } from '../nodes/ApprovalWait/ApprovalWait.node';
import { EvidenceSeal } from '../nodes/EvidenceSeal/EvidenceSeal.node';
import { CouncilVote } from '../nodes/CouncilVote/CouncilVote.node';
import { GuardSpineApi } from '../credentials/GuardSpineApi.credentials';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makeFakeContext(overrides: {
	params?: Record<string, any>;
	credentials?: Record<string, any>;
	httpResponse?: any;
	inputData?: any[];
}) {
	const params = overrides.params || {};
	const creds = overrides.credentials || {
		baseUrl: 'http://localhost:8000',
		apiKey: 'test-key',
	};
	const httpResponse = overrides.httpResponse || {};
	const inputData = overrides.inputData || [{ json: {} }];

	let lastHttpRequest: any = null;

	return {
		getCredentials: jest.fn().mockResolvedValue(creds),
		getNodeParameter: jest.fn((name: string, _idx: number) => {
			if (name in params) return params[name];
			return '';
		}),
		getInputData: jest.fn(() => inputData),
		getNode: jest.fn(() => ({ id: 'test-node', name: 'Test' })),
		getExecutionId: jest.fn(() => 'exec-123'),
		helpers: {
			httpRequest: jest.fn().mockResolvedValue(httpResponse),
		},
		putExecutionToWait: jest.fn(),
		getNodeWebhookUrl: undefined as any,
		getLastHttpRequest: () => lastHttpRequest,
	};
}

/* ------------------------------------------------------------------ */
/*  Description validation (applies to all nodes)                     */
/* ------------------------------------------------------------------ */

const ALL_NODES = [
	{ cls: GuardGate, name: 'guardGate', outputs: 2 },
	{ cls: CodeGuard, name: 'codeGuard', outputs: 2 },
	{ cls: BeadsCreate, name: 'beadsCreate', outputs: 1 },
	{ cls: BeadsUpdate, name: 'beadsUpdate', outputs: 1 },
	{ cls: ApprovalWait, name: 'approvalWait', outputs: 2 },
	{ cls: EvidenceSeal, name: 'evidenceSeal', outputs: 1 },
	{ cls: CouncilVote, name: 'councilVote', outputs: 2 },
];

describe('Node descriptions', () => {
	for (const { cls, name, outputs } of ALL_NODES) {
		describe(name, () => {
			const node = new cls();

			test('has required description fields', () => {
				const d = node.description;
				expect(d.displayName).toBeTruthy();
				expect(d.name).toBe(name);
				expect(d.version).toBe(1);
				expect(d.inputs).toEqual(['main']);
				expect(d.outputs.length).toBe(outputs);
			});

			test('requires guardSpineApi credentials', () => {
				const creds = node.description.credentials;
				expect(creds).toBeDefined();
				expect(creds!.some((c: any) => c.name === 'guardSpineApi')).toBe(true);
			});

			test('has at least one property', () => {
				expect(node.description.properties.length).toBeGreaterThan(0);
			});
		});
	}
});

/* ------------------------------------------------------------------ */
/*  Credential shape                                                  */
/* ------------------------------------------------------------------ */

describe('GuardSpineApi credential', () => {
	const cred = new GuardSpineApi();

	test('has baseUrl and apiKey fields', () => {
		const names = cred.properties.map((p: any) => p.name);
		expect(names).toContain('baseUrl');
		expect(names).toContain('apiKey');
	});

	test('apiKey is password type', () => {
		const apiKey = cred.properties.find((p: any) => p.name === 'apiKey');
		expect(apiKey?.typeOptions?.password).toBe(true);
	});

	test('has Bearer auth header', () => {
		expect(cred.authenticate.type).toBe('generic');
		expect((cred.authenticate as any).properties.headers.Authorization).toContain('Bearer');
	});
});

/* ------------------------------------------------------------------ */
/*  GuardGate execute                                                 */
/* ------------------------------------------------------------------ */

describe('GuardGate execute', () => {
	test('routes to Pass output when risk_tier < blockTier', async () => {
		const ctx = makeFakeContext({
			params: {
				artifactData: '{"code": "console.log()"}',
				artifactType: 'code',
				rubricPack: 'software',
				blockTier: 3,
				createBead: true,
			},
			httpResponse: {
				risk_tier: 1,
				score: 0.92,
				violations: [],
				bead_id: 'bead-1',
				evidence_hash: 'abc123',
				evaluated_at: '2026-01-27T00:00:00Z',
			},
		});

		const node = new GuardGate();
		const result = await node.execute.call(ctx as any);

		expect(result[0].length).toBe(1); // Pass output
		expect(result[1].length).toBe(0); // Block output
		expect((result[0][0].json as any)._guard.risk_tier).toBe(1);
	});

	test('routes to Block output when risk_tier >= blockTier', async () => {
		const ctx = makeFakeContext({
			params: {
				artifactData: '{"code": "eval(input)"}',
				artifactType: 'code',
				rubricPack: 'software',
				blockTier: 2,
				createBead: true,
			},
			httpResponse: {
				risk_tier: 3,
				score: 0.2,
				violations: [{ rule: 'no-eval', severity: 'critical' }],
				bead_id: 'bead-2',
				evidence_hash: 'def456',
				evaluated_at: '2026-01-27T00:00:00Z',
			},
		});

		const node = new GuardGate();
		const result = await node.execute.call(ctx as any);

		expect(result[0].length).toBe(0);
		expect(result[1].length).toBe(1);
		expect((result[1][0].json as any)._guard.risk_tier).toBe(3);
	});

	test('throws NodeOperationError on API failure', async () => {
		const ctx = makeFakeContext({
			params: {
				artifactData: '{}',
				artifactType: 'generic',
				rubricPack: 'nomotic-core',
				blockTier: 2,
				createBead: false,
			},
		});
		ctx.helpers.httpRequest.mockRejectedValue(new Error('Connection refused'));

		const node = new GuardGate();
		await expect(node.execute.call(ctx as any)).rejects.toThrow('GuardSpine API error');
	});

	test('calls correct API endpoint', async () => {
		const ctx = makeFakeContext({
			params: {
				artifactData: '{}',
				artifactType: 'document',
				rubricPack: 'legal',
				blockTier: 2,
				createBead: true,
			},
			httpResponse: { risk_tier: 0, score: 1.0, violations: [], bead_id: null, evidence_hash: 'x', evaluated_at: '' },
		});

		const node = new GuardGate();
		await node.execute.call(ctx as any);

		expect(ctx.helpers.httpRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				method: 'POST',
				url: 'http://localhost:8000/api/v1/guard/evaluate',
			}),
		);
	});
});

/* ------------------------------------------------------------------ */
/*  CouncilVote execute                                               */
/* ------------------------------------------------------------------ */

describe('CouncilVote execute', () => {
	test('routes to Pass when decision is pass', async () => {
		const ctx = makeFakeContext({
			params: {
				question: 'Should we deploy?',
				context: '{}',
				votingMode: 'supermajority',
				personaIds: '',
			},
			httpResponse: {
				consensus_pct: 85,
				decision: 'pass',
				votes: [{ persona_id: 'a', vote: 'approve' }],
				evidence_hash: 'hash1',
			},
		});

		const node = new CouncilVote();
		const result = await node.execute.call(ctx as any);

		expect(result[0].length).toBe(1);
		expect(result[1].length).toBe(0);
		expect((result[0][0].json as any)._council.consensus_pct).toBe(85);
	});

	test('routes to Block when decision is not pass', async () => {
		const ctx = makeFakeContext({
			params: {
				question: 'Risky deploy?',
				context: '{}',
				votingMode: 'unanimous',
				personaIds: 'a,b,c',
			},
			httpResponse: {
				consensus_pct: 40,
				decision: 'fail',
				votes: [],
				evidence_hash: 'hash2',
			},
		});

		const node = new CouncilVote();
		const result = await node.execute.call(ctx as any);

		expect(result[0].length).toBe(0);
		expect(result[1].length).toBe(1);
	});

	test('parses comma-separated persona IDs', async () => {
		const ctx = makeFakeContext({
			params: {
				question: 'test',
				context: '{}',
				votingMode: 'majority',
				personaIds: ' alpha , beta , gamma ',
			},
			httpResponse: { consensus_pct: 100, decision: 'pass', votes: [], evidence_hash: 'h' },
		});

		const node = new CouncilVote();
		await node.execute.call(ctx as any);

		const body = ctx.helpers.httpRequest.mock.calls[0][0].body;
		expect(body.persona_ids).toEqual(['alpha', 'beta', 'gamma']);
	});
});

/* ------------------------------------------------------------------ */
/*  BeadsCreate execute                                               */
/* ------------------------------------------------------------------ */

describe('BeadsCreate execute', () => {
	test('creates bead and returns id', async () => {
		const ctx = makeFakeContext({
			params: {
				title: 'Fix login bug',
				description: 'Auth fails on mobile',
				priority: 3,
				labels: 'bug,auth,mobile',
			},
			httpResponse: { id: 'bead-99', title: 'Fix login bug', status: 'open', priority: 3 },
		});

		const node = new BeadsCreate();
		const result = await node.execute.call(ctx as any);

		expect(result[0].length).toBe(1);
		expect((result[0][0].json as any)._bead.id).toBe('bead-99');

		const body = ctx.helpers.httpRequest.mock.calls[0][0].body;
		expect(body.labels).toEqual(['bug', 'auth', 'mobile']);
	});
});

/* ------------------------------------------------------------------ */
/*  BeadsUpdate execute                                               */
/* ------------------------------------------------------------------ */

describe('BeadsUpdate execute', () => {
	test('updateTask calls PUT with correct body', async () => {
		const ctx = makeFakeContext({
			params: {
				operation: 'updateTask',
				taskId: 'bead-99',
				status: 'done',
				priority: 1,
				labels: '',
				description: '',
			},
			httpResponse: { id: 'bead-99', status: 'done' },
		});

		const node = new BeadsUpdate();
		await node.execute.call(ctx as any);

		const call = ctx.helpers.httpRequest.mock.calls[0][0];
		expect(call.method).toBe('PUT');
		expect(call.url).toContain('/bead-99');
		expect(call.body.status).toBe('done');
	});

	test('addEvidence calls evidence endpoint', async () => {
		const ctx = makeFakeContext({
			params: {
				operation: 'addEvidence',
				taskId: 'bead-99',
				evidenceHash: 'sha256abc',
				evidenceType: 'guard_result',
				evidenceData: '{"score": 0.95}',
			},
			httpResponse: { id: 'bead-99', status: 'open', evidence_hash: 'sha256abc' },
		});

		const node = new BeadsUpdate();
		await node.execute.call(ctx as any);

		const call = ctx.helpers.httpRequest.mock.calls[0][0];
		expect(call.url).toContain('/evidence');
		expect(call.body.evidence_hash).toBe('sha256abc');
	});
});

/* ------------------------------------------------------------------ */
/*  EvidenceSeal execute                                              */
/* ------------------------------------------------------------------ */

describe('EvidenceSeal execute', () => {
	test('seals evidence and returns chain hash', async () => {
		const ctx = makeFakeContext({
			params: {
				diffHash: 'diff-sha256',
				approverId: 'user-1',
				policyRef: 'content-pipeline-v1',
				previousChainHash: '',
				metadata: '',
			},
			httpResponse: {
				bundle_hash: 'bh-1',
				chain_hash: 'ch-1',
				sealed_at: '2026-01-27T00:00:00Z',
				offline_verify_cmd: 'gs verify ch-1',
			},
		});

		const node = new EvidenceSeal();
		const result = await node.execute.call(ctx as any);

		expect((result[0][0].json as any)._evidence_seal.chain_hash).toBe('ch-1');
	});

	test('includes previous_chain_hash when provided', async () => {
		const ctx = makeFakeContext({
			params: {
				diffHash: 'd',
				approverId: 'a',
				policyRef: 'p',
				previousChainHash: 'prev-hash',
				metadata: '{"key":"val"}',
			},
			httpResponse: { bundle_hash: 'b', chain_hash: 'c', sealed_at: 't', offline_verify_cmd: 'v' },
		});

		const node = new EvidenceSeal();
		await node.execute.call(ctx as any);

		const body = ctx.helpers.httpRequest.mock.calls[0][0].body;
		expect(body.previous_chain_hash).toBe('prev-hash');
		expect(body.metadata).toEqual({ key: 'val' });
	});
});

/* ------------------------------------------------------------------ */
/*  CodeGuard execute                                                 */
/* ------------------------------------------------------------------ */

describe('CodeGuard execute', () => {
	test('routes pass/block by risk tier', async () => {
		const ctx = makeFakeContext({
			params: { diffText: 'const x = 1;', gateType: 'standard', blockTier: 2 },
			httpResponse: { risk_tier: 0, passed: true, findings: [], sigma_level: 6.0, dpmo: 0, evidence_hash: 'e' },
		});

		const node = new CodeGuard();
		const result = await node.execute.call(ctx as any);

		expect(result[0].length).toBe(1);
		expect(result[1].length).toBe(0);
	});
});

/* ------------------------------------------------------------------ */
/*  ApprovalWait description                                          */
/* ------------------------------------------------------------------ */

describe('ApprovalWait', () => {
	test('has webhook configuration', () => {
		const node = new ApprovalWait();
		expect(node.description.webhooks).toBeDefined();
		expect(node.description.webhooks!.length).toBe(1);
		expect(node.description.webhooks![0].path).toBe('approval-callback');
	});

	test('has dual outputs (Approved/Rejected)', () => {
		const node = new ApprovalWait();
		expect(node.description.outputNames).toEqual(['Approved', 'Rejected']);
	});
});
