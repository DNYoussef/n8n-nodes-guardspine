/**
 * Bead-Interrupt Wiring - GS-4.4
 *
 * Wires nomotic interrupts to the beads lifecycle:
 * - mandatory_review(72h) -> creates approval + blocks bead (status=blocked)
 * - escalation(24h) -> creates notification + blocks bead
 * - block(auto) -> immediately blocks bead
 */

import * as http from 'http';
import * as https from 'https';

import type { NomoticInterrupt } from './nomotic-interrupt-handler';

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

function apiRequest(
  method: string,
  url: string,
  body?: Record<string, unknown>
): Promise<{ status: number | undefined; data: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;
    const payload = body ? JSON.stringify(body) : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (payload) {
      headers['Content-Length'] = String(Buffer.byteLength(payload));
    }

    const opts: http.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers,
      timeout: 10000,
    };

    const req = transport.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk.toString()));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: { raw: data } });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Bead interrupt wiring: request timeout'));
    });
    req.on('error', (err) => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Block bead helper
// ---------------------------------------------------------------------------

async function blockBead(
  beadId: string,
  backendUrl: string,
  reason: string
): Promise<void> {
  await apiRequest('PUT', `${backendUrl}/api/v1/beads/tasks/${beadId}`, {
    status: 'blocked',
    reason,
  });
}

// ---------------------------------------------------------------------------
// Main wiring function
// ---------------------------------------------------------------------------

/**
 * Wire a nomotic interrupt to a bead in the beads lifecycle.
 *
 * - mandatory_review(72h): creates approval request + blocks bead
 * - escalation(24h): sends notification webhook + blocks bead
 * - block(auto): immediately blocks bead
 *
 * @param interrupt - The nomotic interrupt to wire
 * @param beadId - The bead ID to block
 * @param backendUrl - GuardSpine API base URL
 */
export async function wireInterruptToBeads(
  interrupt: NomoticInterrupt,
  beadId: string,
  backendUrl: string
): Promise<void> {
  const reason = `Nomotic interrupt [${interrupt.interrupt_type}]: ${interrupt.trigger_condition}`;

  switch (interrupt.interrupt_type) {
    case 'mandatory_review': {
      // Create approval request with 72h timeout
      await apiRequest('POST', `${backendUrl}/api/v1/approvals`, {
        interrupt_id: interrupt.interrupt_id,
        bead_id: beadId,
        artifact_id: interrupt.metadata.artifact_id || '',
        reason,
        timeout_hours: interrupt.timeout_hours || 72,
        required_approvers: ['owner', 'compliance_delegate'],
        interrupt_type: interrupt.interrupt_type,
        trigger_condition: interrupt.trigger_condition,
      });

      // Block the bead until approval
      await blockBead(beadId, backendUrl, reason);

      console.log(
        '[guardspine:info] Bead %s blocked for mandatory_review (72h): %s',
        beadId,
        interrupt.trigger_condition
      );
      break;
    }

    case 'escalation': {
      // Send escalation notification
      const callbackUrl = process.env.GUARDSPINE_CALLBACK_URL || '';
      if (callbackUrl) {
        await apiRequest('POST', callbackUrl, {
          event_type: 'nomotic_interrupt.escalation',
          interrupt_id: interrupt.interrupt_id,
          bead_id: beadId,
          trigger_condition: interrupt.trigger_condition,
          severity: interrupt.severity,
          timeout_hours: interrupt.timeout_hours || 24,
        }).catch((err) => {
          console.log(
            '[guardspine:warn] Escalation webhook failed (non-fatal): %s',
            err instanceof Error ? err.message : String(err)
          );
        });
      }

      // Block the bead during escalation
      await blockBead(beadId, backendUrl, reason);

      console.log(
        '[guardspine:info] Bead %s blocked for escalation (24h): %s',
        beadId,
        interrupt.trigger_condition
      );
      break;
    }

    case 'block': {
      // Immediately block the bead
      await blockBead(beadId, backendUrl, reason);

      console.log(
        '[guardspine:info] Bead %s immediately blocked: %s',
        beadId,
        interrupt.trigger_condition
      );
      break;
    }

    default:
      console.log(
        '[guardspine:warn] Unknown interrupt type for bead wiring: %s',
        interrupt.interrupt_type
      );
  }
}

export default { wireInterruptToBeads };
