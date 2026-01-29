/**
 * Nock HTTP Mocking Setup - GS-7.1
 *
 * Provides mock interceptors for all GuardSpine API endpoints.
 * Tests can import and use these helpers to avoid needing a running server.
 *
 * Usage:
 *   import { setupGuardSpineMocks, cleanupMocks } from './helpers/nock-setup';
 *
 *   beforeAll(() => setupGuardSpineMocks());
 *   afterAll(() => cleanupMocks());
 */

import nock from 'nock';

const GUARDSPINE_BASE = process.env.GUARDSPINE_API_URL || 'http://localhost:8000';

/**
 * Default mock responses for GuardSpine endpoints
 */
export const mockResponses = {
  health: { status: 'healthy', version: '2.0.0' },

  evaluate: (opts: { escalation?: string; findings?: number } = {}) => ({
    artifact_id: 'test-artifact-123',
    escalation_level: opts.escalation || 'L1',
    total_score: 0.3,
    required_approvers: opts.escalation === 'L4' ? ['ciso'] : [],
    findings: Array(opts.findings || 0).fill(null).map((_, i) => ({
      finding_id: `f-${i + 1}`,
      title: `Test Finding ${i + 1}`,
      description: 'Mock finding for testing',
      severity: i === 0 ? 'high' : 'medium',
      source_trigger: 'test_rule',
      enforcement: 'warn',
    })),
  }),

  createApproval: (opts: { artifact_id?: string } = {}) => ({
    id: 'appr-test-001',
    approval_id: 'appr-test-001',
    artifact_id: opts.artifact_id || 'test-artifact',
    status: 'pending',
    created_at: new Date().toISOString(),
  }),

  bundle: () => ({
    id: 'bundle-test-001',
    bundle_id: 'bundle-test-001',
    status: 'created',
  }),

  version: (opts: { artifact_id?: string } = {}) => ({
    id: 'ver-test-001',
    version_id: 'ver-test-001',
    artifact_id: opts.artifact_id || 'test-artifact',
    previous_version_id: 'ver-prev-001',
    created_at: new Date().toISOString(),
  }),

  diff: () => ({
    id: 'diff-test-001',
    changes_count: 2,
    changes: [
      { type: 'modified', path: 'test.js', old_value: 'old', new_value: 'new' },
      { type: 'added', path: 'new.js', new_value: 'content' },
    ],
  }),

  bead: () => ({
    id: 'bead-test-001',
    bead_id: 'bead-test-001',
    status: 'open',
    created_at: new Date().toISOString(),
  }),

  aiAnalysis: () => ({
    summary: 'Test analysis summary',
    key_factors: ['Test factor 1'],
    implications: { security: 'Test implication' },
    recommendation: 'review_carefully',
    analyzed_at: new Date().toISOString(),
  }),
};

/**
 * Set up all GuardSpine API mocks
 * Call this in beforeAll() or beforeEach()
 */
export function setupGuardSpineMocks(opts: {
  escalation?: string;
  findingsCount?: number;
} = {}): void {
  nock.cleanAll();

  const scope = nock(GUARDSPINE_BASE)
    .persist()
    // Health check
    .get('/health')
    .reply(200, mockResponses.health)

    // Policy evaluation
    .post('/api/v1/policies/evaluate')
    .reply(200, mockResponses.evaluate({
      escalation: opts.escalation,
      findings: opts.findingsCount,
    }))

    // Approvals
    .post('/api/v1/approvals')
    .reply(201, (uri, body: Record<string, unknown>) =>
      mockResponses.createApproval({ artifact_id: body.artifact_id as string })
    )
    .get(/\/api\/v1\/approvals.*/)
    .reply(200, { items: [], total: 0 })
    .get(/\/api\/v1\/approvals\/[^/]+$/)
    .reply(200, mockResponses.createApproval())
    .post(/\/api\/v1\/approvals\/[^/]+\/approve/)
    .reply(200, { id: 'test', status: 'approved' })
    .post(/\/api\/v1\/approvals\/[^/]+\/reject/)
    .reply(200, { id: 'test', status: 'rejected' })

    // Bundles
    .post('/api/v1/bundles')
    .reply(201, mockResponses.bundle())

    // Evidence seal
    .post('/api/v1/evidence/seal')
    .reply(200, { sealed: true, hash: 'sha256:test' })

    // Artifact versions
    .post(/\/api\/v1\/artifacts\/[^/]+\/versions/)
    .reply(201, (uri) => {
      const match = uri.match(/\/artifacts\/([^/]+)\/versions/);
      return mockResponses.version({ artifact_id: match?.[1] });
    })

    // Diffs
    .post('/api/v1/diffs')
    .reply(200, mockResponses.diff())

    // Beads
    .post('/api/v1/beads/tasks')
    .reply(201, mockResponses.bead())
    .put(/\/api\/v1\/beads\/tasks\/[^/]+$/)
    .reply(200, { status: 'updated' })
    .put(/\/api\/v1\/beads\/tasks\/[^/]+\/evidence/)
    .reply(200, { attached: true })

    // AI Analysis
    .post('/api/v1/ai/analyze-approval')
    .reply(200, mockResponses.aiAnalysis());

  // Log when mocks are set up in debug mode
  if (process.env.DEBUG_NOCK) {
    console.log('[nock] GuardSpine mocks configured for', GUARDSPINE_BASE);
  }
}

/**
 * Set up mocks for a high-risk scenario (L4 escalation)
 */
export function setupHighRiskMocks(): void {
  setupGuardSpineMocks({ escalation: 'L4', findingsCount: 3 });
}

/**
 * Set up mocks for a low-risk scenario (L1 escalation)
 */
export function setupLowRiskMocks(): void {
  setupGuardSpineMocks({ escalation: 'L1', findingsCount: 0 });
}

/**
 * Clean up all nock mocks
 * Call this in afterAll() or afterEach()
 */
export function cleanupMocks(): void {
  nock.cleanAll();
  // Don't call nock.restore() here as it disables nock entirely
  // Only call restore() at the very end of all tests if needed
}

/**
 * Assert that all expected mocks were called
 */
export function assertMocksCalled(): void {
  if (!nock.isDone()) {
    const pending = nock.pendingMocks();
    throw new Error(`Pending mocks not called: ${pending.join(', ')}`);
  }
}

/**
 * Get count of pending mocks
 */
export function pendingMocksCount(): number {
  return nock.pendingMocks().length;
}

export default {
  setupGuardSpineMocks,
  setupHighRiskMocks,
  setupLowRiskMocks,
  cleanupMocks,
  assertMocksCalled,
  mockResponses,
};
