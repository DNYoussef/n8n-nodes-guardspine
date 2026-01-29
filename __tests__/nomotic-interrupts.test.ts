/**
 * Tests for Nomotic Interrupts - GS-7.5
 *
 * Tests the nomotic interrupt handler (GS-6.2) and
 * bead-interrupt wiring (GS-4.4).
 *
 * Uses Jest with nock for HTTP mocking (matching existing test patterns).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import nock from 'nock';

import { handleNomoticInterrupts } from '../hooks/nomotic-interrupt-handler';
import type { NomoticInterrupt } from '../hooks/nomotic-interrupt-handler';
import { wireInterruptToBeads } from '../hooks/bead-interrupt-wiring';

const GUARDSPINE_BASE = 'http://localhost:8000';
const CALLBACK_URL = 'http://localhost:9999/webhook/escalation';

// Console mocking - silence output during tests
let consoleSpy: jest.SpyInstance;

function makeInterrupt(
  overrides: Partial<NomoticInterrupt> = {}
): NomoticInterrupt {
  return {
    interrupt_id: 'ni-test-001',
    interrupt_type: 'mandatory_review',
    trigger_condition: 'external_link_added',
    severity: 'high',
    timeout_hours: 72,
    metadata: {
      artifact_id: 'art-123',
      escalation_level: 'L3',
    },
    ...overrides,
  };
}

describe('GS-7.5: Nomotic Interrupts', () => {
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
  // GS-6.2: handleNomoticInterrupts tests
  // =========================================================================
  describe('GS-6.2: handleNomoticInterrupts', () => {
    test('block interrupt throws in enforce mode', () => {
      const interrupt = makeInterrupt({
        interrupt_type: 'block',
        trigger_condition: 'signature_changed',
        severity: 'critical',
        timeout_hours: 0,
      });

      expect(() => {
        handleNomoticInterrupts([interrupt], 'enforce', GUARDSPINE_BASE);
      }).toThrow(/GuardSpine BLOCKED/);
    });

    test('block interrupt does NOT throw in audit mode', () => {
      const interrupt = makeInterrupt({
        interrupt_type: 'block',
        trigger_condition: 'signature_changed',
        severity: 'critical',
        timeout_hours: 0,
      });

      expect(() => {
        handleNomoticInterrupts([interrupt], 'audit', GUARDSPINE_BASE);
      }).not.toThrow();
    });

    test('mandatory_review creates approval request', (done) => {
      const interrupt = makeInterrupt({
        interrupt_type: 'mandatory_review',
        timeout_hours: 72,
      });

      nock(GUARDSPINE_BASE)
        .post('/api/v1/approvals', (body: any) => {
          expect(body.interrupt_id).toBe('ni-test-001');
          expect(body.timeout_hours).toBe(72);
          expect(body.interrupt_type).toBe('mandatory_review');
          return true;
        })
        .reply(201, { id: 'appr-from-interrupt', status: 'pending' });

      handleNomoticInterrupts([interrupt], 'enforce', GUARDSPINE_BASE);

      // Allow async approval creation to complete
      setTimeout(() => {
        expect(nock.isDone()).toBe(true);
        done();
      }, 200);
    });

    test('escalation fires notification webhook', (done) => {
      const interrupt = makeInterrupt({
        interrupt_type: 'escalation',
        trigger_condition: 'auth_modified',
        severity: 'critical',
        timeout_hours: 24,
      });

      nock(CALLBACK_URL.replace(/\/webhook\/escalation$/, ''))
        .post('/webhook/escalation', (body: any) => {
          expect(body.event_type).toBe('nomotic_interrupt.escalation');
          expect(body.interrupt_id).toBe('ni-test-001');
          expect(body.trigger_condition).toBe('auth_modified');
          expect(body.timeout_hours).toBe(24);
          return true;
        })
        .reply(200, { ok: true });

      handleNomoticInterrupts([interrupt], 'enforce', GUARDSPINE_BASE, CALLBACK_URL);

      setTimeout(() => {
        expect(nock.isDone()).toBe(true);
        done();
      }, 200);
    });

    test('no interrupts does nothing', () => {
      expect(() => {
        handleNomoticInterrupts([], 'enforce', GUARDSPINE_BASE);
      }).not.toThrow();
    });

    test('mode=off skips all processing', () => {
      const interrupt = makeInterrupt({ interrupt_type: 'block' });
      expect(() => {
        handleNomoticInterrupts([interrupt], 'off', GUARDSPINE_BASE);
      }).not.toThrow();
    });

    test('interrupt with no matching triggers returns empty (no action)', () => {
      // If interrupts array is empty, nothing happens
      expect(() => {
        handleNomoticInterrupts([], 'enforce');
      }).not.toThrow();
    });
  });

  // =========================================================================
  // GS-4.4: wireInterruptToBeads tests
  // =========================================================================
  describe('GS-4.4: wireInterruptToBeads', () => {
    test('mandatory_review creates approval and blocks bead', async () => {
      let approvalBody: any = null;
      let beadUpdateBody: any = null;

      nock(GUARDSPINE_BASE)
        .post('/api/v1/approvals', (body: any) => {
          approvalBody = body;
          return true;
        })
        .reply(201, { id: 'appr-bead-001' })
        .put('/api/v1/beads/tasks/bead-wire-001', (body: any) => {
          beadUpdateBody = body;
          return true;
        })
        .reply(200, { id: 'bead-wire-001', status: 'blocked' });

      const interrupt = makeInterrupt({
        interrupt_type: 'mandatory_review',
        timeout_hours: 72,
      });

      await wireInterruptToBeads(interrupt, 'bead-wire-001', GUARDSPINE_BASE);

      expect(approvalBody).toBeDefined();
      expect(approvalBody.bead_id).toBe('bead-wire-001');
      expect(approvalBody.timeout_hours).toBe(72);
      expect(beadUpdateBody).toBeDefined();
      expect(beadUpdateBody.status).toBe('blocked');
    });

    test('escalation sends notification and blocks bead', async () => {
      const savedCallback = process.env.GUARDSPINE_CALLBACK_URL;
      process.env.GUARDSPINE_CALLBACK_URL = CALLBACK_URL;

      let webhookBody: any = null;
      let beadUpdateBody: any = null;

      nock(CALLBACK_URL.replace(/\/webhook\/escalation$/, ''))
        .post('/webhook/escalation', (body: any) => {
          webhookBody = body;
          return true;
        })
        .reply(200, { ok: true });

      nock(GUARDSPINE_BASE)
        .put('/api/v1/beads/tasks/bead-esc-001', (body: any) => {
          beadUpdateBody = body;
          return true;
        })
        .reply(200, { id: 'bead-esc-001', status: 'blocked' });

      const interrupt = makeInterrupt({
        interrupt_type: 'escalation',
        trigger_condition: 'auth_modified',
        timeout_hours: 24,
      });

      await wireInterruptToBeads(interrupt, 'bead-esc-001', GUARDSPINE_BASE);

      expect(webhookBody).toBeDefined();
      expect(webhookBody.bead_id).toBe('bead-esc-001');
      expect(beadUpdateBody).toBeDefined();
      expect(beadUpdateBody.status).toBe('blocked');

      // Restore env
      if (savedCallback === undefined) {
        delete process.env.GUARDSPINE_CALLBACK_URL;
      } else {
        process.env.GUARDSPINE_CALLBACK_URL = savedCallback;
      }
    });

    test('block immediately blocks bead', async () => {
      let beadUpdateBody: any = null;

      nock(GUARDSPINE_BASE)
        .put('/api/v1/beads/tasks/bead-block-001', (body: any) => {
          beadUpdateBody = body;
          return true;
        })
        .reply(200, { id: 'bead-block-001', status: 'blocked' });

      const interrupt = makeInterrupt({
        interrupt_type: 'block',
        trigger_condition: 'signature_changed',
        timeout_hours: 0,
      });

      await wireInterruptToBeads(interrupt, 'bead-block-001', GUARDSPINE_BASE);

      expect(beadUpdateBody).toBeDefined();
      expect(beadUpdateBody.status).toBe('blocked');
      expect(beadUpdateBody.reason).toContain('signature_changed');
    });

    test('bead gets blocked status with reason', async () => {
      let beadUpdateBody: any = null;

      nock(GUARDSPINE_BASE)
        .post('/api/v1/approvals')
        .reply(201, { id: 'appr-reason-001' })
        .put('/api/v1/beads/tasks/bead-reason-001', (body: any) => {
          beadUpdateBody = body;
          return true;
        })
        .reply(200, { id: 'bead-reason-001', status: 'blocked' });

      const interrupt = makeInterrupt({
        interrupt_type: 'mandatory_review',
        trigger_condition: 'new_dependency',
      });

      await wireInterruptToBeads(interrupt, 'bead-reason-001', GUARDSPINE_BASE);

      expect(beadUpdateBody.status).toBe('blocked');
      expect(beadUpdateBody.reason).toContain('mandatory_review');
      expect(beadUpdateBody.reason).toContain('new_dependency');
    });
  });
});
