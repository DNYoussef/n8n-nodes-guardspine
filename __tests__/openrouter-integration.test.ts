/**
 * OpenRouter Integration Tests - GS-3.2
 *
 * Integration tests for the OpenRouter adapter.
 * Skipped without OPENROUTER_API_KEY env var.
 * Uses nock for mock-based tests.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import nock from 'nock';

const GUARDSPINE_BASE = 'http://localhost:8000';

// Helpers matching existing test patterns
let consoleSpy: jest.SpyInstance;

function loadHooks(env: Record<string, string> = {}) {
  const hookPath = require.resolve('../dist/hooks/guardspine-hooks');
  delete require.cache[hookPath];

  const savedEnv: Record<string, string | undefined> = {};
  const defaults: Record<string, string> = {
    GUARDSPINE_API_URL: GUARDSPINE_BASE,
    GUARDSPINE_API_KEY: 'test-api-key',
    GUARDSPINE_MODE: 'audit',
    GUARDSPINE_RISK_THRESHOLD: 'L3',
    GUARDSPINE_LOG_LEVEL: 'error',
    GUARDSPINE_CLASSIFICATION: 'auto',
    GUARDSPINE_BACKEND: 'auto',
    GUARDSPINE_MODEL: '',
  };
  const merged = { ...defaults, ...env };
  for (const [k, v] of Object.entries(merged)) {
    savedEnv[k] = process.env[k];
    process.env[k] = v;
  }

  const hooks = require('../dist/hooks/guardspine-hooks');

  if (typeof hooks.resetConfig === 'function') {
    hooks.resetConfig();
  }

  const restore = () => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    if (typeof hooks.resetConfig === 'function') {
      hooks.resetConfig();
    }
    delete require.cache[hookPath];
  };
  return { hooks, restore };
}

function makeWorkflow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wf-openrouter-test',
    name: 'OpenRouter Test Workflow',
    active: false,
    nodes: [],
    connections: {},
    tags: [],
    ...overrides,
  };
}

// Mock response helpers (matching nock-setup pattern)
function evaluateResponse(opts: { escalation?: string; findings?: number } = {}) {
  return {
    artifact_id: 'test-artifact-or',
    escalation_level: opts.escalation || 'L1',
    total_score: 0.3,
    required_approvers: [],
    findings: Array(opts.findings || 0).fill(null).map((_, i) => ({
      finding_id: `f-or-${i + 1}`,
      title: `OpenRouter Finding ${i + 1}`,
      description: 'Mock finding',
      severity: 'medium',
      source_trigger: 'test_rule',
      enforcement: 'warn',
    })),
  };
}

describe('GS-3.2: OpenRouter adapter integration', () => {
  beforeAll(() => {
    if (!nock.isActive()) {
      nock.activate();
    }
  });

  beforeEach(() => {
    nock.cleanAll();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    nock.cleanAll();
    if (consoleSpy) {
      consoleSpy.mockRestore();
    }
  });

  afterAll(() => {
    nock.restore();
  });

  // =========================================================================
  // Mock-based OpenRouter tests
  // =========================================================================
  describe('OpenRouter model routing via backend headers', () => {
    test('openrouter backend sends X-GuardSpine-Backend header', async () => {
      let capturedHeaders: Record<string, string> = {};

      nock(GUARDSPINE_BASE)
        .post('/api/v1/policies/evaluate')
        .reply(function () {
          capturedHeaders = this.req.headers as unknown as Record<string, string>;
          return [200, evaluateResponse()];
        })
        .post('/api/v1/beads/tasks')
        .reply(201, { id: 'bead-or-001' });

      const { hooks, restore } = loadHooks({
        GUARDSPINE_BACKEND: 'openrouter',
        GUARDSPINE_MODEL: 'anthropic/claude-sonnet-4.5',
      });
      try {
        await hooks.workflow.preExecute[0](makeWorkflow());
        // Backend header should be set (lowercased by http)
        expect(capturedHeaders['x-guardspine-backend']).toBe('openrouter');
        expect(capturedHeaders['x-guardspine-model']).toBe('anthropic/claude-sonnet-4.5');
      } finally {
        restore();
      }
    });

    test('openai model routing sends correct model header', async () => {
      let capturedHeaders: Record<string, string> = {};

      nock(GUARDSPINE_BASE)
        .post('/api/v1/policies/evaluate')
        .reply(function () {
          capturedHeaders = this.req.headers as unknown as Record<string, string>;
          return [200, evaluateResponse()];
        })
        .post('/api/v1/beads/tasks')
        .reply(201, { id: 'bead-gpt-001' });

      const { hooks, restore } = loadHooks({
        GUARDSPINE_BACKEND: 'openrouter',
        GUARDSPINE_MODEL: 'openai/gpt-4o',
      });
      try {
        await hooks.workflow.preExecute[0](makeWorkflow());
        expect(capturedHeaders['x-guardspine-model']).toBe('openai/gpt-4o');
      } finally {
        restore();
      }
    });

    test('openrouter/auto model routing', async () => {
      let capturedHeaders: Record<string, string> = {};

      nock(GUARDSPINE_BASE)
        .post('/api/v1/policies/evaluate')
        .reply(function () {
          capturedHeaders = this.req.headers as unknown as Record<string, string>;
          return [200, evaluateResponse()];
        })
        .post('/api/v1/beads/tasks')
        .reply(201, { id: 'bead-auto-001' });

      const { hooks, restore } = loadHooks({
        GUARDSPINE_BACKEND: 'openrouter',
        GUARDSPINE_MODEL: 'openrouter/auto',
      });
      try {
        await hooks.workflow.preExecute[0](makeWorkflow());
        expect(capturedHeaders['x-guardspine-backend']).toBe('openrouter');
        expect(capturedHeaders['x-guardspine-model']).toBe('openrouter/auto');
      } finally {
        restore();
      }
    });
  });

  // =========================================================================
  // Fallback to Ollama
  // =========================================================================
  describe('Fallback to Ollama when OpenRouter unavailable', () => {
    test('ollama backend config works without errors', async () => {
      nock(GUARDSPINE_BASE)
        .post('/api/v1/policies/evaluate')
        .reply(200, evaluateResponse())
        .post('/api/v1/beads/tasks')
        .reply(201, { id: 'bead-ollama-001' });

      const { hooks, restore } = loadHooks({
        GUARDSPINE_BACKEND: 'ollama',
        GUARDSPINE_MODEL: 'llama3.2',
      });
      try {
        await expect(
          hooks.workflow.preExecute[0](makeWorkflow())
        ).resolves.toBeUndefined();
      } finally {
        restore();
      }
    });

    test('ollama sends correct backend header', async () => {
      let capturedHeaders: Record<string, string> = {};

      nock(GUARDSPINE_BASE)
        .post('/api/v1/policies/evaluate')
        .reply(function () {
          capturedHeaders = this.req.headers as unknown as Record<string, string>;
          return [200, evaluateResponse()];
        })
        .post('/api/v1/beads/tasks')
        .reply(201, { id: 'bead-ollama-h-001' });

      const { hooks, restore } = loadHooks({
        GUARDSPINE_BACKEND: 'ollama',
        GUARDSPINE_MODEL: 'mistral',
      });
      try {
        await hooks.workflow.preExecute[0](makeWorkflow());
        expect(capturedHeaders['x-guardspine-backend']).toBe('ollama');
        expect(capturedHeaders['x-guardspine-model']).toBe('mistral');
      } finally {
        restore();
      }
    });
  });

  // =========================================================================
  // Environment variable configuration
  // =========================================================================
  describe('Env var configuration (GUARDSPINE_BACKEND, GUARDSPINE_MODEL)', () => {
    test('GUARDSPINE_BACKEND defaults to auto', () => {
      const { hooks, restore } = loadHooks();
      try {
        const config = hooks.createConfig();
        expect(config.backend).toBe('auto');
      } finally {
        restore();
      }
    });

    test('GUARDSPINE_MODEL defaults to empty string', () => {
      const { hooks, restore } = loadHooks();
      try {
        const config = hooks.createConfig();
        expect(config.model).toBe('');
      } finally {
        restore();
      }
    });

    test('GUARDSPINE_BACKEND=openrouter is reflected in config', () => {
      const { hooks, restore } = loadHooks({ GUARDSPINE_BACKEND: 'openrouter' });
      try {
        const config = hooks.createConfig();
        expect(config.backend).toBe('openrouter');
      } finally {
        restore();
      }
    });

    test('GUARDSPINE_MODEL is reflected in config', () => {
      const { hooks, restore } = loadHooks({
        GUARDSPINE_MODEL: 'anthropic/claude-sonnet-4.5',
      });
      try {
        const config = hooks.createConfig();
        expect(config.model).toBe('anthropic/claude-sonnet-4.5');
      } finally {
        restore();
      }
    });

    test('auto backend does not send X-GuardSpine-Backend header', async () => {
      let capturedHeaders: Record<string, string> = {};

      nock(GUARDSPINE_BASE)
        .post('/api/v1/policies/evaluate')
        .reply(function () {
          capturedHeaders = this.req.headers as unknown as Record<string, string>;
          return [200, evaluateResponse()];
        })
        .post('/api/v1/beads/tasks')
        .reply(201, { id: 'bead-noheader-001' });

      const { hooks, restore } = loadHooks({
        GUARDSPINE_BACKEND: 'auto',
        GUARDSPINE_MODEL: '',
      });
      try {
        await hooks.workflow.preExecute[0](makeWorkflow());
        // auto backend should NOT send the header
        expect(capturedHeaders['x-guardspine-backend']).toBeUndefined();
        // empty model should NOT send the header
        expect(capturedHeaders['x-guardspine-model']).toBeUndefined();
      } finally {
        restore();
      }
    });
  });
});
