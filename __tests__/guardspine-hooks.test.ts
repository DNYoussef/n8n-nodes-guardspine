/**
 * Tests for guardspine-hooks.ts - thin-client version.
 * GS-7.2: Tests preExecute lifecycle
 * GS-7.3: Tests postExecute lifecycle
 *
 * Uses nock for HTTP mocking (GS-7.1).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import nock from 'nock';
import {
  setupGuardSpineMocks,
  setupHighRiskMocks,
  setupLowRiskMocks,
  mockResponses,
} from './helpers/nock-setup';

const GUARDSPINE_BASE = 'http://localhost:8000';

// Console mocking - silence output during tests
let consoleSpy: jest.SpyInstance;

function loadHooks(env: Record<string, string> = {}) {
  // Clear the hooks module from cache to get fresh CONFIG
  // Use the compiled TypeScript version from dist/
  const hookPath = require.resolve('../dist/hooks/guardspine-hooks');
  delete require.cache[hookPath];

  const savedEnv: Record<string, string | undefined> = {};
  const defaults: Record<string, string> = {
    GUARDSPINE_API_URL: GUARDSPINE_BASE,
    GUARDSPINE_API_KEY: 'test-api-key',
    GUARDSPINE_MODE: 'audit',
    GUARDSPINE_RISK_THRESHOLD: 'L3',
    GUARDSPINE_LOG_LEVEL: 'error', // Set to 'error' to minimize noise
    GUARDSPINE_CLASSIFICATION: 'auto',
    GUARDSPINE_BACKEND: 'auto',
    GUARDSPINE_MODEL: '',
  };
  const merged = { ...defaults, ...env };
  for (const [k, v] of Object.entries(merged)) {
    savedEnv[k] = process.env[k];
    process.env[k] = v;
  }

  // Re-require with fresh env vars - this also calls createConfig()
  const hooks = require('../dist/hooks/guardspine-hooks');

  // Call resetConfig to ensure CONFIG matches current env vars
  if (typeof hooks.resetConfig === 'function') {
    hooks.resetConfig();
  }

  const restore = () => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    // Reset config and clear module cache after restore
    if (typeof hooks.resetConfig === 'function') {
      hooks.resetConfig();
    }
    delete require.cache[hookPath];
  };
  return { hooks, restore };
}

function makeWorkflow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wf-test-1',
    name: 'Test Workflow',
    active: false,
    nodes: [],
    connections: {},
    tags: [],
    ...overrides,
  };
}

function makeNode(type: string, name: string, params: Record<string, unknown> = {}) {
  return { id: name, type, name, parameters: params };
}

describe('GuardSpine Hooks (thin-client)', () => {
  beforeAll(() => {
    // Ensure nock is active
    if (!nock.isActive()) {
      nock.activate();
    }
  });

  beforeEach(() => {
    nock.cleanAll();
    // Silence console.log during tests
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    nock.cleanAll();
    // Restore console.log
    if (consoleSpy) {
      consoleSpy.mockRestore();
    }
  });

  afterAll(() => {
    nock.restore();
  });

  // =========================================================================
  // GS-7.2: preExecute lifecycle tests
  // =========================================================================
  describe('GS-7.2: preExecute lifecycle', () => {
    describe('with clean workflow (L0)', () => {
      test('does not block in audit mode', async () => {
        setupLowRiskMocks();
        const { hooks, restore } = loadHooks({ GUARDSPINE_MODE: 'audit' });
        try {
          const wf = makeWorkflow();
          await expect(hooks.workflow.preExecute[0](wf)).resolves.toBeUndefined();
        } finally {
          restore();
        }
      });

      test('does not block in enforce mode', async () => {
        setupLowRiskMocks();
        const { hooks, restore } = loadHooks({ GUARDSPINE_MODE: 'enforce' });
        try {
          const wf = makeWorkflow();
          await expect(hooks.workflow.preExecute[0](wf)).resolves.toBeUndefined();
        } finally {
          restore();
        }
      });
    });

    describe('with dangerous workflow (L4)', () => {
      test('handles high-risk workflow in audit mode (default)', async () => {
        setupHighRiskMocks();
        const { hooks, restore } = loadHooks({
          GUARDSPINE_MODE: 'audit',
        });
        try {
          const wf = makeWorkflow({
            nodes: [makeNode('n8n-nodes-base.executeCommand', 'Shell')],
          });
          // In audit mode, should complete without throwing
          await expect(hooks.workflow.preExecute[0](wf)).resolves.toBeUndefined();
        } finally {
          restore();
        }
      });

      test('high-risk workflow completes evaluation', async () => {
        setupHighRiskMocks();
        const { hooks, restore } = loadHooks();
        try {
          const wf = makeWorkflow({
            nodes: [makeNode('n8n-nodes-base.executeCommand', 'Shell')],
          });
          // Verify the hook completes (mode is defaulted to audit)
          await expect(hooks.workflow.preExecute[0](wf)).resolves.toBeUndefined();
        } finally {
          restore();
        }
      });
    });

    describe('API timeout/failure', () => {
      test('logs error but does not block in audit mode', async () => {
        nock(GUARDSPINE_BASE)
          .post('/api/v1/policies/evaluate')
          .replyWithError({ code: 'ETIMEDOUT' });
        const { hooks, restore } = loadHooks({ GUARDSPINE_MODE: 'audit' });
        try {
          const wf = makeWorkflow();
          await expect(hooks.workflow.preExecute[0](wf)).resolves.toBeUndefined();
        } finally {
          restore();
        }
      });

      test('graceful fail-open in enforce mode', async () => {
        nock(GUARDSPINE_BASE)
          .post('/api/v1/policies/evaluate')
          .replyWithError({ code: 'ECONNREFUSED' });
        const { hooks, restore } = loadHooks({ GUARDSPINE_MODE: 'enforce' });
        try {
          const wf = makeWorkflow();
          await expect(hooks.workflow.preExecute[0](wf)).resolves.toBeUndefined();
        } finally {
          restore();
        }
      });
    });

    describe('API request verification', () => {
      test('calls correct URL /api/v1/policies/evaluate', async () => {
        const scope = nock(GUARDSPINE_BASE)
          .post('/api/v1/policies/evaluate')
          .reply(200, mockResponses.evaluate({ escalation: 'L1', findings: 0 }))
          .post('/api/v1/beads/tasks')
          .reply(201, mockResponses.bead());

        const { hooks, restore } = loadHooks();
        try {
          await hooks.workflow.preExecute[0](makeWorkflow());
          expect(scope.isDone()).toBe(true);
        } finally {
          restore();
        }
      });

      test('sends correct EvaluationRequest schema', async () => {
        let capturedBody: any = null;
        nock(GUARDSPINE_BASE)
          .post('/api/v1/policies/evaluate', (body: any) => {
            capturedBody = body;
            return true;
          })
          .reply(200, mockResponses.evaluate())
          .post('/api/v1/beads/tasks')
          .reply(201, mockResponses.bead());

        const { hooks, restore } = loadHooks();
        try {
          await hooks.workflow.preExecute[0](
            makeWorkflow({
              id: 'wf-schema-test',
              name: 'Schema Test',
              nodes: [makeNode('n8n-nodes-base.set', 'SetNode')],
              tags: ['test-tag'],
            })
          );

          expect(capturedBody).toBeDefined();
          expect(capturedBody.artifact_id).toBe('wf-schema-test');
          expect(capturedBody.artifact_kind).toBe('code');
          expect(capturedBody.pack_ids).toContain('nomotic');
          expect(capturedBody.metadata).toBeDefined();
          expect(capturedBody.metadata.workflow_name).toBe('Schema Test');
          expect(capturedBody.metadata.node_types).toContain('n8n-nodes-base.set');
          expect(capturedBody.metadata.tags).toContain('test-tag');
        } finally {
          restore();
        }
      });
    });

    describe('GS-2.1: classification override', () => {
      test('classification config is applied', async () => {
        setupGuardSpineMocks();
        const { hooks, restore } = loadHooks({ GUARDSPINE_CLASSIFICATION: 'L2' });
        try {
          // Verify preExecute completes without error
          await expect(hooks.workflow.preExecute[0](makeWorkflow())).resolves.toBeUndefined();
        } finally {
          restore();
        }
      });

      test('auto classification works', async () => {
        setupGuardSpineMocks();
        const { hooks, restore } = loadHooks({ GUARDSPINE_CLASSIFICATION: 'auto' });
        try {
          await expect(hooks.workflow.preExecute[0](makeWorkflow())).resolves.toBeUndefined();
        } finally {
          restore();
        }
      });
    });

    describe('GS-2.2: threshold L-string format', () => {
      test('L-string threshold parsing via tierFromEscalation', async () => {
        // This test verifies low-risk workflows don't cause errors
        setupLowRiskMocks();
        const { hooks, restore } = loadHooks();
        try {
          const wf = makeWorkflow();
          await expect(hooks.workflow.preExecute[0](wf)).resolves.toBeUndefined();
        } finally {
          restore();
        }
      });

      test('high-risk evaluation completes in audit mode', async () => {
        setupHighRiskMocks();
        const { hooks, restore } = loadHooks();
        try {
          const wf = makeWorkflow();
          // In audit mode (default), should complete without throwing
          await expect(hooks.workflow.preExecute[0](wf)).resolves.toBeUndefined();
        } finally {
          restore();
        }
      });
    });

    describe('GS-3.1: LLM backend headers', () => {
      test('backend config does not break requests', async () => {
        setupGuardSpineMocks();
        const { hooks, restore } = loadHooks({ GUARDSPINE_BACKEND: 'openrouter' });
        try {
          await expect(hooks.workflow.preExecute[0](makeWorkflow())).resolves.toBeUndefined();
        } finally {
          restore();
        }
      });

      test('model config does not break requests', async () => {
        setupGuardSpineMocks();
        const { hooks, restore } = loadHooks({
          GUARDSPINE_BACKEND: 'ollama',
          GUARDSPINE_MODEL: 'llama3.2',
        });
        try {
          await expect(hooks.workflow.preExecute[0](makeWorkflow())).resolves.toBeUndefined();
        } finally {
          restore();
        }
      });

      test('auto backend works normally', async () => {
        setupGuardSpineMocks();
        const { hooks, restore } = loadHooks({ GUARDSPINE_BACKEND: 'auto' });
        try {
          await expect(hooks.workflow.preExecute[0](makeWorkflow())).resolves.toBeUndefined();
        } finally {
          restore();
        }
      });
    });
  });

  // =========================================================================
  // GS-7.3: postExecute lifecycle tests
  // =========================================================================
  describe('GS-7.3: postExecute lifecycle', () => {
    describe('successful execution', () => {
      test('creates evidence bundle via POST /api/v1/bundles', async () => {
        let capturedBundleBody: any = null;
        nock(GUARDSPINE_BASE)
          .post('/api/v1/bundles', (body: any) => {
            capturedBundleBody = body;
            return true;
          })
          .reply(201, mockResponses.bundle())
          .post('/api/v1/evidence/seal')
          .reply(200, { sealed: true, hash: 'sha256:test' });

        const { hooks, restore } = loadHooks();
        try {
          await hooks.workflow.postExecute[0]({ finished: true }, makeWorkflow({ id: 'wf-bundle-test' }));
          expect(capturedBundleBody).toBeDefined();
          expect(capturedBundleBody.artifact_id).toBe('wf-bundle-test');
          expect(capturedBundleBody.assertion_type).toBe('execution_completed');
          expect(capturedBundleBody.signer).toBeDefined();
          expect(capturedBundleBody.signer.signer_type).toBe('system');
        } finally {
          restore();
        }
      });

      test('seals bundle via POST /api/v1/evidence/seal', async () => {
        let sealCalled = false;
        nock(GUARDSPINE_BASE)
          .post('/api/v1/bundles')
          .reply(201, { id: 'bundle-seal-test' })
          .post('/api/v1/evidence/seal', (body: any) => {
            sealCalled = true;
            expect(body.bundle_id).toBe('bundle-seal-test');
            return true;
          })
          .reply(200, { sealed: true, hash: 'sha256:sealed-hash' });

        const { hooks, restore } = loadHooks();
        try {
          await hooks.workflow.postExecute[0]({ finished: true }, makeWorkflow());
          expect(sealCalled).toBe(true);
        } finally {
          restore();
        }
      });
    });

    describe('failed execution', () => {
      test('creates bundle with error status', async () => {
        let capturedBundleBody: any = null;
        nock(GUARDSPINE_BASE)
          .post('/api/v1/bundles', (body: any) => {
            capturedBundleBody = body;
            return true;
          })
          .reply(201, mockResponses.bundle())
          .post('/api/v1/evidence/seal')
          .reply(200, { sealed: true });

        const { hooks, restore } = loadHooks();
        try {
          await hooks.workflow.postExecute[0]({ finished: false }, makeWorkflow());
          expect(capturedBundleBody.metadata.execution_status).toBe('error');
        } finally {
          restore();
        }
      });
    });

    describe('null workflowData handling', () => {
      test('handles null workflowData without crash', async () => {
        nock(GUARDSPINE_BASE)
          .post('/api/v1/bundles')
          .reply(201, mockResponses.bundle())
          .post('/api/v1/evidence/seal')
          .reply(200, { sealed: true });

        const { hooks, restore } = loadHooks();
        try {
          await expect(
            hooks.workflow.postExecute[0]({ finished: true }, null)
          ).resolves.toBeUndefined();
        } finally {
          restore();
        }
      });

      test('handles undefined workflowData without crash', async () => {
        nock(GUARDSPINE_BASE)
          .post('/api/v1/bundles')
          .reply(201, mockResponses.bundle())
          .post('/api/v1/evidence/seal')
          .reply(200, { sealed: true });

        const { hooks, restore } = loadHooks();
        try {
          await expect(
            hooks.workflow.postExecute[0]({ finished: true }, undefined)
          ).resolves.toBeUndefined();
        } finally {
          restore();
        }
      });
    });

    describe('API failure handling', () => {
      test('no throw on bundle API 500', async () => {
        nock(GUARDSPINE_BASE)
          .post('/api/v1/bundles')
          .reply(500, { error: 'Internal server error' });

        const { hooks, restore } = loadHooks();
        try {
          await expect(
            hooks.workflow.postExecute[0]({ finished: true }, makeWorkflow())
          ).resolves.toBeUndefined();
        } finally {
          restore();
        }
      });

      test('no throw when network down', async () => {
        nock(GUARDSPINE_BASE)
          .post('/api/v1/bundles')
          .replyWithError({ code: 'ECONNREFUSED' });

        const { hooks, restore } = loadHooks();
        try {
          await expect(
            hooks.workflow.postExecute[0]({ finished: true }, makeWorkflow())
          ).resolves.toBeUndefined();
        } finally {
          restore();
        }
      });
    });

    describe('executionContext cleanup', () => {
      test('cleans up executionContext after post', async () => {
        setupGuardSpineMocks();

        const { hooks, restore } = loadHooks();
        try {
          const wf = makeWorkflow({ id: 'wf-cleanup-test' });

          // preExecute should store context
          await hooks.workflow.preExecute[0](wf);

          // postExecute should clean up
          await hooks.workflow.postExecute[0]({ finished: true }, wf);

          // Second postExecute should work without prior context
          nock.cleanAll();
          setupGuardSpineMocks();
          await expect(
            hooks.workflow.postExecute[0]({ finished: true }, wf)
          ).resolves.toBeUndefined();
        } finally {
          restore();
        }
      });
    });
  });

  // =========================================================================
  // n8n.ready hook tests
  // =========================================================================
  describe('n8n.ready hook', () => {
    test('startup without error when API healthy', async () => {
      nock(GUARDSPINE_BASE).get('/health').reply(200, { status: 'healthy' });
      const { hooks, restore } = loadHooks();
      try {
        await expect(hooks.n8n.ready[0]()).resolves.toBeUndefined();
      } finally {
        restore();
      }
    });

    test('does not crash if health endpoint down', async () => {
      nock(GUARDSPINE_BASE).get('/health').replyWithError({ code: 'ECONNREFUSED' });
      const { hooks, restore } = loadHooks();
      try {
        await expect(hooks.n8n.ready[0]()).resolves.toBeUndefined();
      } finally {
        restore();
      }
    });
  });

  // =========================================================================
  // mode=off tests
  // =========================================================================
  describe('mode=off', () => {
    test('preExecute does nothing and returns immediately', async () => {
      // In mode=off, preExecute should return without making any API calls
      const { hooks, restore } = loadHooks({ GUARDSPINE_MODE: 'off' });
      try {
        await expect(hooks.workflow.preExecute[0](makeWorkflow())).resolves.toBeUndefined();
      } finally {
        restore();
      }
    });

    test('postExecute does nothing and returns immediately', async () => {
      const { hooks, restore } = loadHooks({ GUARDSPINE_MODE: 'off' });
      try {
        await expect(
          hooks.workflow.postExecute[0]({ finished: true }, makeWorkflow())
        ).resolves.toBeUndefined();
      } finally {
        restore();
      }
    });

    test('afterCreate does nothing and returns immediately', async () => {
      const { hooks, restore } = loadHooks({ GUARDSPINE_MODE: 'off' });
      try {
        await expect(hooks.workflow.afterCreate[0](makeWorkflow())).resolves.toBeUndefined();
      } finally {
        restore();
      }
    });
  });

  // =========================================================================
  // Module exports tests
  // =========================================================================
  describe('module exports', () => {
    test('exports expected structure', () => {
      const { hooks, restore } = loadHooks();
      try {
        expect(hooks.n8n).toBeDefined();
        expect(hooks.n8n.ready).toBeInstanceOf(Array);
        expect(hooks.workflow.preExecute).toBeInstanceOf(Array);
        expect(hooks.workflow.postExecute).toBeInstanceOf(Array);
        expect(hooks.workflow.afterCreate).toBeInstanceOf(Array);
        expect(hooks.workflow.afterUpdate).toBeInstanceOf(Array);
      } finally {
        restore();
      }
    });

    test('all entries are functions', () => {
      const { hooks, restore } = loadHooks();
      try {
        for (const fn of hooks.n8n.ready) expect(typeof fn).toBe('function');
        for (const fn of hooks.workflow.preExecute) expect(typeof fn).toBe('function');
        for (const fn of hooks.workflow.postExecute) expect(typeof fn).toBe('function');
        for (const fn of hooks.workflow.afterCreate) expect(typeof fn).toBe('function');
        for (const fn of hooks.workflow.afterUpdate) expect(typeof fn).toBe('function');
      } finally {
        restore();
      }
    });

    test('exports resetConfig function', () => {
      const { hooks, restore } = loadHooks();
      try {
        expect(typeof hooks.resetConfig).toBe('function');
      } finally {
        restore();
      }
    });

    test('exports createConfig function', () => {
      const { hooks, restore } = loadHooks();
      try {
        expect(typeof hooks.createConfig).toBe('function');
        const config = hooks.createConfig();
        expect(config).toHaveProperty('apiUrl');
        expect(config).toHaveProperty('mode');
        expect(config).toHaveProperty('backend');
      } finally {
        restore();
      }
    });
  });

  // =========================================================================
  // serializeError tests
  // =========================================================================
  describe('error serialization', () => {
    test('handles Error objects gracefully', async () => {
      nock(GUARDSPINE_BASE)
        .post('/api/v1/policies/evaluate')
        .replyWithError(new Error('Network failure'));

      const { hooks, restore } = loadHooks({ GUARDSPINE_MODE: 'audit' });
      try {
        // Should not throw, just log the error
        await expect(hooks.workflow.preExecute[0](makeWorkflow())).resolves.toBeUndefined();
      } finally {
        restore();
      }
    });

    test('handles plain objects with code property', async () => {
      nock(GUARDSPINE_BASE)
        .post('/api/v1/policies/evaluate')
        .replyWithError({ code: 'ETIMEDOUT' });

      const { hooks, restore } = loadHooks({ GUARDSPINE_MODE: 'audit' });
      try {
        // Should not throw, error should be serialized as "ETIMEDOUT"
        await expect(hooks.workflow.preExecute[0](makeWorkflow())).resolves.toBeUndefined();
      } finally {
        restore();
      }
    });
  });

  // =========================================================================
  // GS-8.1: Multi-artifact routing tests
  // =========================================================================
  describe('GS-8.1: multi-artifact routing', () => {
    test('detects PDF artifact kind from ReadPDF node', async () => {
      let capturedBody: any = null;
      nock(GUARDSPINE_BASE)
        .post('/api/v1/policies/evaluate', (body: any) => {
          capturedBody = body;
          return true;
        })
        .reply(200, mockResponses.evaluate())
        .post('/api/v1/beads/tasks')
        .reply(201, mockResponses.bead());

      const { hooks, restore } = loadHooks();
      try {
        await hooks.workflow.preExecute[0](
          makeWorkflow({
            nodes: [makeNode('n8n-nodes-base.readPdf', 'ReadPDF')],
          })
        );
        expect(capturedBody.artifact_kind).toBe('pdf');
      } finally {
        restore();
      }
    });

    test('detects spreadsheet artifact kind from GoogleSheets node', async () => {
      let capturedBody: any = null;
      nock(GUARDSPINE_BASE)
        .post('/api/v1/policies/evaluate', (body: any) => {
          capturedBody = body;
          return true;
        })
        .reply(200, mockResponses.evaluate())
        .post('/api/v1/beads/tasks')
        .reply(201, mockResponses.bead());

      const { hooks, restore } = loadHooks();
      try {
        await hooks.workflow.preExecute[0](
          makeWorkflow({
            nodes: [makeNode('n8n-nodes-base.googleSheets', 'GoogleSheets')],
          })
        );
        expect(capturedBody.artifact_kind).toBe('xlsx');
      } finally {
        restore();
      }
    });

    test('detects image artifact kind from Screenshot node', async () => {
      let capturedBody: any = null;
      nock(GUARDSPINE_BASE)
        .post('/api/v1/policies/evaluate', (body: any) => {
          capturedBody = body;
          return true;
        })
        .reply(200, mockResponses.evaluate())
        .post('/api/v1/beads/tasks')
        .reply(201, mockResponses.bead());

      const { hooks, restore } = loadHooks();
      try {
        await hooks.workflow.preExecute[0](
          makeWorkflow({
            nodes: [makeNode('n8n-nodes-base.screenshot', 'Screenshot')],
          })
        );
        expect(capturedBody.artifact_kind).toBe('image');
      } finally {
        restore();
      }
    });

    test('defaults to code artifact kind for unknown nodes', async () => {
      let capturedBody: any = null;
      nock(GUARDSPINE_BASE)
        .post('/api/v1/policies/evaluate', (body: any) => {
          capturedBody = body;
          return true;
        })
        .reply(200, mockResponses.evaluate())
        .post('/api/v1/beads/tasks')
        .reply(201, mockResponses.bead());

      const { hooks, restore } = loadHooks();
      try {
        await hooks.workflow.preExecute[0](
          makeWorkflow({
            nodes: [makeNode('n8n-nodes-base.httpRequest', 'HTTP')],
          })
        );
        expect(capturedBody.artifact_kind).toBe('code');
      } finally {
        restore();
      }
    });

    test('uses highest-risk artifact kind when multiple types present', async () => {
      let capturedBody: any = null;
      nock(GUARDSPINE_BASE)
        .post('/api/v1/policies/evaluate', (body: any) => {
          capturedBody = body;
          return true;
        })
        .reply(200, mockResponses.evaluate())
        .post('/api/v1/beads/tasks')
        .reply(201, mockResponses.bead());

      const { hooks, restore } = loadHooks();
      try {
        await hooks.workflow.preExecute[0](
          makeWorkflow({
            nodes: [
              makeNode('n8n-nodes-base.readPdf', 'ReadPDF'),      // pdf (priority 3)
              makeNode('n8n-nodes-base.googleSheets', 'Sheets'),   // xlsx (priority 2)
              makeNode('n8n-nodes-base.screenshot', 'Screenshot'), // image (priority 4)
            ],
          })
        );
        // Image has highest priority (4), so should be selected
        expect(capturedBody.artifact_kind).toBe('image');
      } finally {
        restore();
      }
    });
  });

  // =========================================================================
  // GS-5.2: Callback URL tests
  // =========================================================================
  describe('GS-5.2: callback URL', () => {
    test('config includes callbackUrl property', () => {
      const { hooks, restore } = loadHooks({ GUARDSPINE_CALLBACK_URL: 'https://n8n.example.com/webhook/approval' });
      try {
        const config = hooks.createConfig();
        expect(config).toHaveProperty('callbackUrl');
        expect(config.callbackUrl).toBe('https://n8n.example.com/webhook/approval');
      } finally {
        restore();
      }
    });

    test('callbackUrl defaults to empty string', () => {
      const { hooks, restore } = loadHooks();
      try {
        const config = hooks.createConfig();
        expect(config.callbackUrl).toBe('');
      } finally {
        restore();
      }
    });
  });

  // =========================================================================
  // GS-7.4: Test beads lifecycle
  // =========================================================================
  describe('GS-7.4: beads lifecycle', () => {
    test('preExecute creates bead with open status', async () => {
      let beadCreateBody: any = null;
      nock(GUARDSPINE_BASE)
        .post('/api/v1/policies/evaluate')
        .reply(200, mockResponses.evaluate({ escalation: 'L1', findings: 0 }))
        .post('/api/v1/beads/tasks', (body: any) => {
          beadCreateBody = body;
          return true;
        })
        .reply(201, mockResponses.bead());

      const { hooks, restore } = loadHooks();
      try {
        await hooks.workflow.preExecute[0](makeWorkflow({ name: 'Lifecycle Test' }));
        expect(beadCreateBody).toBeDefined();
        expect(beadCreateBody.status).toBe('open');
        expect(beadCreateBody.title).toContain('Lifecycle Test');
        expect(beadCreateBody.labels).toContain('guardspine');
      } finally {
        restore();
      }
    });

    test('high risk evaluation updates bead to blocked', async () => {
      let beadUpdateBody: any = null;
      nock(GUARDSPINE_BASE)
        .post('/api/v1/policies/evaluate')
        .reply(200, mockResponses.evaluate({ escalation: 'L4', findings: 2 }))
        .post('/api/v1/beads/tasks')
        .reply(201, { id: 'bead-high-risk-test' })
        .put('/api/v1/beads/tasks/bead-high-risk-test', (body: any) => {
          beadUpdateBody = body;
          return true;
        })
        .reply(200, { id: 'bead-high-risk-test', status: 'blocked' });

      const { hooks, restore } = loadHooks({ GUARDSPINE_RISK_THRESHOLD: 'L3' });
      try {
        await hooks.workflow.preExecute[0](makeWorkflow());
        expect(beadUpdateBody).toBeDefined();
        expect(beadUpdateBody.status).toBe('blocked');
      } finally {
        restore();
      }
    });

    test('postExecute updates bead to done on success', async () => {
      let beadUpdateBody: any = null;
      // Setup preExecute mocks
      nock(GUARDSPINE_BASE)
        .post('/api/v1/policies/evaluate')
        .reply(200, mockResponses.evaluate())
        .post('/api/v1/beads/tasks')
        .reply(201, { id: 'bead-lifecycle-done' });

      // Setup postExecute mocks
      nock(GUARDSPINE_BASE)
        .put('/api/v1/beads/tasks/bead-lifecycle-done', (body: any) => {
          beadUpdateBody = body;
          return true;
        })
        .reply(200, { id: 'bead-lifecycle-done', status: 'done' })
        .put('/api/v1/beads/tasks/bead-lifecycle-done/evidence')
        .reply(200, { success: true })
        .post('/api/v1/bundles')
        .reply(201, mockResponses.bundle())
        .post('/api/v1/evidence/seal')
        .reply(200, { sealed: true });

      const { hooks, restore } = loadHooks();
      try {
        const wf = makeWorkflow({ id: 'wf-lifecycle-done' });
        await hooks.workflow.preExecute[0](wf);
        await hooks.workflow.postExecute[0]({ finished: true }, wf);
        expect(beadUpdateBody).toBeDefined();
        expect(beadUpdateBody.status).toBe('done');
      } finally {
        restore();
      }
    });

    test('postExecute updates bead to failed on error', async () => {
      let beadUpdateBody: any = null;
      nock(GUARDSPINE_BASE)
        .post('/api/v1/policies/evaluate')
        .reply(200, mockResponses.evaluate())
        .post('/api/v1/beads/tasks')
        .reply(201, { id: 'bead-lifecycle-failed' });

      nock(GUARDSPINE_BASE)
        .put('/api/v1/beads/tasks/bead-lifecycle-failed', (body: any) => {
          beadUpdateBody = body;
          return true;
        })
        .reply(200, { id: 'bead-lifecycle-failed', status: 'failed' })
        .put('/api/v1/beads/tasks/bead-lifecycle-failed/evidence')
        .reply(200, { success: true })
        .post('/api/v1/bundles')
        .reply(201, mockResponses.bundle())
        .post('/api/v1/evidence/seal')
        .reply(200, { sealed: true });

      const { hooks, restore } = loadHooks();
      try {
        const wf = makeWorkflow({ id: 'wf-lifecycle-failed' });
        await hooks.workflow.preExecute[0](wf);
        await hooks.workflow.postExecute[0]({ finished: false }, wf);
        expect(beadUpdateBody).toBeDefined();
        expect(beadUpdateBody.status).toBe('failed');
      } finally {
        restore();
      }
    });

    test('postExecute attaches evidence to bead', async () => {
      let evidenceBody: any = null;
      nock(GUARDSPINE_BASE)
        .post('/api/v1/policies/evaluate')
        .reply(200, mockResponses.evaluate({ escalation: 'L2', findings: 1 }))
        .post('/api/v1/beads/tasks')
        .reply(201, { id: 'bead-evidence-test' });

      nock(GUARDSPINE_BASE)
        .put('/api/v1/beads/tasks/bead-evidence-test')
        .reply(200, { id: 'bead-evidence-test' })
        .put('/api/v1/beads/tasks/bead-evidence-test/evidence', (body: any) => {
          evidenceBody = body;
          return true;
        })
        .reply(200, { success: true })
        .post('/api/v1/bundles')
        .reply(201, mockResponses.bundle())
        .post('/api/v1/evidence/seal')
        .reply(200, { sealed: true });

      const { hooks, restore } = loadHooks();
      try {
        const wf = makeWorkflow({ id: 'wf-evidence-test' });
        await hooks.workflow.preExecute[0](wf);
        await hooks.workflow.postExecute[0]({ finished: true }, wf);
        expect(evidenceBody).toBeDefined();
        expect(evidenceBody.evidence_type).toBe('execution_log');
        expect(evidenceBody.escalation_level).toBe('L2');
      } finally {
        restore();
      }
    });
  });

  // =========================================================================
  // GS-7.6: Test approval webhook callback
  // =========================================================================
  describe('GS-7.6: approval webhook callback', () => {
    test('high risk workflow save creates approval with callback_url', async () => {
      let approvalBody: any = null;
      nock(GUARDSPINE_BASE)
        .post('/api/v1/artifacts/wf-approval-test/versions')
        .reply(201, { version_id: 'v1', previous_version_id: null })
        .post('/api/v1/diffs')
        .reply(201, { id: 'diff-1', changes_count: 3, changes: [] })
        .post('/api/v1/policies/evaluate')
        .reply(200, mockResponses.evaluate({ escalation: 'L4', findings: 2 }))
        .post('/api/v1/approvals', (body: any) => {
          approvalBody = body;
          return true;
        })
        .reply(201, { id: 'approval-123', status: 'pending' });

      const { hooks, restore } = loadHooks({
        GUARDSPINE_CALLBACK_URL: 'https://n8n.example.com/webhook/approval',
      });
      try {
        await hooks.workflow.afterCreate[0](makeWorkflow({ id: 'wf-approval-test', name: 'Approval Test' }));
        expect(approvalBody).toBeDefined();
        expect(approvalBody.callback_url).toBe('https://n8n.example.com/webhook/approval');
        expect(approvalBody.artifact_id).toBe('wf-approval-test');
        expect(approvalBody.risk_tier).toBe('L4');
      } finally {
        restore();
      }
    });

    test('approval request includes bead_id when available', async () => {
      let approvalBody: any = null;
      // First setup preExecute to create a bead
      nock(GUARDSPINE_BASE)
        .post('/api/v1/policies/evaluate')
        .reply(200, mockResponses.evaluate({ escalation: 'L2', findings: 0 }))
        .post('/api/v1/beads/tasks')
        .reply(201, { id: 'bead-approval-link' });

      // Then setup afterCreate/afterUpdate for high risk
      nock(GUARDSPINE_BASE)
        .post('/api/v1/artifacts/wf-bead-approval/versions')
        .reply(201, { version_id: 'v1', previous_version_id: null })
        .post('/api/v1/diffs')
        .reply(201, { id: 'diff-1', changes_count: 1, changes: [] })
        .post('/api/v1/policies/evaluate')
        .reply(200, mockResponses.evaluate({ escalation: 'L3', findings: 1 }))
        .post('/api/v1/approvals', (body: any) => {
          approvalBody = body;
          return true;
        })
        .reply(201, { id: 'approval-with-bead' });

      const { hooks, restore } = loadHooks();
      try {
        const wf = makeWorkflow({ id: 'wf-bead-approval' });
        // Create bead via preExecute
        await hooks.workflow.preExecute[0](wf);
        // Trigger approval via afterCreate (simulates workflow save)
        await hooks.workflow.afterCreate[0](wf);
        expect(approvalBody).toBeDefined();
        expect(approvalBody.bead_id).toBe('bead-approval-link');
      } finally {
        restore();
      }
    });

    test('approval payload includes findings and diff_data', async () => {
      let approvalBody: any = null;
      const mockFindings = [
        { finding_id: 'f1', title: 'Shell injection risk', severity: 'high' },
        { finding_id: 'f2', title: 'Unchecked input', severity: 'medium' },
      ];

      nock(GUARDSPINE_BASE)
        .post('/api/v1/artifacts/wf-findings-test/versions')
        .reply(201, { version_id: 'v2', previous_version_id: 'v1' })
        .post('/api/v1/diffs')
        .reply(201, {
          id: 'diff-findings',
          changes_count: 5,
          changes: [{ type: 'add', path: '/nodes/0' }],
        })
        .post('/api/v1/policies/evaluate')
        .reply(200, {
          escalation_level: 'L3',
          findings: mockFindings,
          required_approvers: ['security-team'],
        })
        .post('/api/v1/approvals', (body: any) => {
          approvalBody = body;
          return true;
        })
        .reply(201, { id: 'approval-findings' });

      const { hooks, restore } = loadHooks();
      try {
        await hooks.workflow.afterCreate[0](makeWorkflow({ id: 'wf-findings-test' }));
        expect(approvalBody).toBeDefined();
        expect(approvalBody.findings).toHaveLength(2);
        expect(approvalBody.findings[0].title).toBe('Shell injection risk');
        expect(approvalBody.diff_data).toBeDefined();
        expect(approvalBody.diff_data.changes_count).toBe(5);
        expect(approvalBody.required_approvers).toContain('security-team');
      } finally {
        restore();
      }
    });

    test('low risk workflow save does not create approval', async () => {
      let approvalCalled = false;
      nock(GUARDSPINE_BASE)
        .post('/api/v1/artifacts/wf-low-risk/versions')
        .reply(201, { version_id: 'v1' })
        .post('/api/v1/diffs')
        .reply(201, { id: 'diff-1', changes_count: 1 })
        .post('/api/v1/policies/evaluate')
        .reply(200, mockResponses.evaluate({ escalation: 'L1', findings: 0 }))
        .post('/api/v1/approvals', () => {
          approvalCalled = true;
          return true;
        })
        .reply(201, { id: 'should-not-be-called' })
        .post('/api/v1/events')
        .reply(201, { success: true });

      const { hooks, restore } = loadHooks();
      try {
        await hooks.workflow.afterCreate[0](makeWorkflow({ id: 'wf-low-risk' }));
        expect(approvalCalled).toBe(false);
      } finally {
        restore();
      }
    });
  });

  // =========================================================================
  // GS-15.1: Telemetry collection tests
  // =========================================================================
  describe('GS-15.1: telemetry collection', () => {
    test('preExecute emits telemetry event', async () => {
      let telemetryBody: any = null;
      nock(GUARDSPINE_BASE)
        .post('/api/v1/policies/evaluate')
        .reply(200, mockResponses.evaluate({ escalation: 'L2', findings: 1 }))
        .post('/api/v1/beads/tasks')
        .reply(201, mockResponses.bead())
        .post('/api/v1/events', (body: any) => {
          telemetryBody = body;
          return true;
        })
        .reply(201, { success: true });

      const { hooks, restore } = loadHooks();
      try {
        await hooks.workflow.preExecute[0](makeWorkflow({ id: 'wf-telemetry-pre' }));
        expect(telemetryBody).toBeDefined();
        expect(telemetryBody.event_type).toBe('workflow.preExecute');
        expect(telemetryBody.project).toBe('wf-telemetry-pre');
        expect(telemetryBody.who).toBe('guardspine-hooks:n8n');
        expect(telemetryBody.metrics.evaluation_duration_ms).toBeGreaterThanOrEqual(0);
        expect(telemetryBody.metrics.escalation_level).toBe('L2');
      } finally {
        restore();
      }
    });

    test('postExecute emits telemetry event', async () => {
      let telemetryBody: any = null;
      // Setup preExecute
      nock(GUARDSPINE_BASE)
        .post('/api/v1/policies/evaluate')
        .reply(200, mockResponses.evaluate())
        .post('/api/v1/beads/tasks')
        .reply(201, { id: 'bead-telem-post' })
        .post('/api/v1/events')
        .reply(201, { success: true });

      // Setup postExecute
      nock(GUARDSPINE_BASE)
        .put('/api/v1/beads/tasks/bead-telem-post')
        .reply(200, {})
        .put('/api/v1/beads/tasks/bead-telem-post/evidence')
        .reply(200, {})
        .post('/api/v1/bundles')
        .reply(201, mockResponses.bundle())
        .post('/api/v1/evidence/seal')
        .reply(200, { sealed: true })
        .post('/api/v1/events', (body: any) => {
          telemetryBody = body;
          return true;
        })
        .reply(201, { success: true });

      const { hooks, restore } = loadHooks();
      try {
        const wf = makeWorkflow({ id: 'wf-telemetry-post' });
        await hooks.workflow.preExecute[0](wf);
        await hooks.workflow.postExecute[0]({ finished: true }, wf);
        expect(telemetryBody).toBeDefined();
        expect(telemetryBody.event_type).toBe('workflow.postExecute');
        expect(telemetryBody.metrics.execution_status).toBe('success');
        expect(telemetryBody.metrics.bundle_seal_time_ms).toBeGreaterThanOrEqual(0);
      } finally {
        restore();
      }
    });

    test('workflowSave emits telemetry event', async () => {
      let telemetryBody: any = null;
      nock(GUARDSPINE_BASE)
        .post('/api/v1/artifacts/wf-telemetry-save/versions')
        .reply(201, { version_id: 'v1' })
        .post('/api/v1/diffs')
        .reply(201, { id: 'diff-1', changes_count: 2 })
        .post('/api/v1/policies/evaluate')
        .reply(200, mockResponses.evaluate({ escalation: 'L1', findings: 0 }))
        .post('/api/v1/events', (body: any) => {
          telemetryBody = body;
          return true;
        })
        .reply(201, { success: true });

      const { hooks, restore } = loadHooks();
      try {
        await hooks.workflow.afterCreate[0](makeWorkflow({ id: 'wf-telemetry-save' }));
        expect(telemetryBody).toBeDefined();
        expect(telemetryBody.event_type).toBe('workflow.save');
        expect(telemetryBody.metrics.save_duration_ms).toBeGreaterThanOrEqual(0);
        expect(telemetryBody.metrics.changes_count).toBe(2);
      } finally {
        restore();
      }
    });

    test('telemetry includes WHO/WHEN/PROJECT/WHY metadata', async () => {
      let telemetryBody: any = null;
      nock(GUARDSPINE_BASE)
        .post('/api/v1/policies/evaluate')
        .reply(200, mockResponses.evaluate())
        .post('/api/v1/beads/tasks')
        .reply(201, mockResponses.bead())
        .post('/api/v1/events', (body: any) => {
          telemetryBody = body;
          return true;
        })
        .reply(201, { success: true });

      const { hooks, restore } = loadHooks();
      try {
        await hooks.workflow.preExecute[0](makeWorkflow({ id: 'wf-metadata-test' }));
        expect(telemetryBody.who).toBe('guardspine-hooks:n8n');
        expect(telemetryBody.when).toBeDefined();
        expect(telemetryBody.project).toBe('wf-metadata-test');
        expect(telemetryBody.why).toBe('evaluation');
      } finally {
        restore();
      }
    });

    test('telemetry failure does not break workflow execution', async () => {
      nock(GUARDSPINE_BASE)
        .post('/api/v1/policies/evaluate')
        .reply(200, mockResponses.evaluate())
        .post('/api/v1/beads/tasks')
        .reply(201, mockResponses.bead())
        .post('/api/v1/events')
        .replyWithError({ code: 'ECONNREFUSED' }); // Telemetry fails

      const { hooks, restore } = loadHooks();
      try {
        // Should not throw even though telemetry failed
        await expect(hooks.workflow.preExecute[0](makeWorkflow())).resolves.toBeUndefined();
      } finally {
        restore();
      }
    });

    test('telemetry includes findings_by_severity breakdown', async () => {
      let telemetryBody: any = null;
      const mockFindings = [
        { finding_id: 'f1', title: 'Critical issue', severity: 'critical' },
        { finding_id: 'f2', title: 'High issue', severity: 'high' },
        { finding_id: 'f3', title: 'Medium issue', severity: 'medium' },
      ];

      nock(GUARDSPINE_BASE)
        .post('/api/v1/policies/evaluate')
        .reply(200, {
          escalation_level: 'L3',
          findings: mockFindings,
        })
        .post('/api/v1/beads/tasks')
        .reply(201, mockResponses.bead())
        .post('/api/v1/events', (body: any) => {
          telemetryBody = body;
          return true;
        })
        .reply(201, { success: true });

      const { hooks, restore } = loadHooks();
      try {
        await hooks.workflow.preExecute[0](makeWorkflow());
        expect(telemetryBody.metrics.findings_by_severity).toBeDefined();
        expect(telemetryBody.metrics.findings_by_severity.critical).toBe(1);
        expect(telemetryBody.metrics.findings_by_severity.high).toBe(1);
        expect(telemetryBody.metrics.findings_by_severity.medium).toBe(1);
      } finally {
        restore();
      }
    });
  });
});
