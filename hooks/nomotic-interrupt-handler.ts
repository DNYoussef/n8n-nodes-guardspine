/**
 * Nomotic Interrupt Handler - GS-6.2
 *
 * Processes nomotic interrupts returned from the GuardSpine backend.
 * - block-type in enforce mode -> throws Error to stop workflow
 * - mandatory_review -> creates approval request with 72h timeout
 * - escalation -> fires notification webhook
 */

import * as http from 'http';
import * as https from 'https';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NomoticInterrupt {
  interrupt_id: string;
  interrupt_type: 'mandatory_review' | 'escalation' | 'block';
  trigger_condition: string;
  severity: string;
  timeout_hours: number;
  metadata: Record<string, unknown>;
}

export interface ApprovalRequest {
  interrupt_id: string;
  artifact_id: string;
  reason: string;
  timeout_hours: number;
  required_approvers: string[];
  interrupt_type: string;
  trigger_condition: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function postJson(
  url: string,
  body: Record<string, unknown>
): Promise<{ status: number | undefined; data: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;
    const payload = JSON.stringify(body);

    const opts: http.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(Buffer.byteLength(payload)),
      },
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
      reject(new Error('Nomotic interrupt handler: request timeout'));
    });
    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

/**
 * Process nomotic interrupts from backend response.
 *
 * @param interrupts - Array of NomoticInterrupt from backend
 * @param mode - GuardSpine mode: "enforce" | "audit" | "off"
 * @param backendUrl - GuardSpine API base URL (default: http://localhost:8000)
 * @param callbackUrl - Webhook URL for escalation notifications
 */
export function handleNomoticInterrupts(
  interrupts: NomoticInterrupt[],
  mode: string,
  backendUrl?: string,
  callbackUrl?: string
): void {
  if (mode === 'off' || !interrupts || interrupts.length === 0) {
    return;
  }

  const apiBase = backendUrl || process.env.GUARDSPINE_API_URL || 'http://localhost:8000';
  const webhook = callbackUrl || process.env.GUARDSPINE_CALLBACK_URL || '';

  for (const interrupt of interrupts) {
    switch (interrupt.interrupt_type) {
      case 'block':
        if (mode === 'enforce') {
          throw new Error(
            `GuardSpine BLOCKED: nomotic interrupt ${interrupt.interrupt_id} ` +
            `(trigger: ${interrupt.trigger_condition}, severity: ${interrupt.severity})`
          );
        }
        // In audit mode, log but do not block
        console.log(
          '[guardspine:warn] Block interrupt in audit mode: %s (trigger: %s)',
          interrupt.interrupt_id,
          interrupt.trigger_condition
        );
        break;

      case 'mandatory_review': {
        const approvalReq: ApprovalRequest = {
          interrupt_id: interrupt.interrupt_id,
          artifact_id: String(interrupt.metadata.artifact_id || ''),
          reason: `Nomotic interrupt: ${interrupt.trigger_condition}`,
          timeout_hours: interrupt.timeout_hours || 72,
          required_approvers: ['owner', 'compliance_delegate'],
          interrupt_type: interrupt.interrupt_type,
          trigger_condition: interrupt.trigger_condition,
        };

        // Fire-and-forget approval creation
        postJson(`${apiBase}/api/v1/approvals`, approvalReq as unknown as Record<string, unknown>)
          .then((res) => {
            console.log(
              '[guardspine:info] Approval created for interrupt %s: %s',
              interrupt.interrupt_id,
              JSON.stringify(res.data)
            );
          })
          .catch((err) => {
            console.log(
              '[guardspine:error] Failed to create approval for interrupt %s: %s',
              interrupt.interrupt_id,
              err instanceof Error ? err.message : String(err)
            );
          });
        break;
      }

      case 'escalation': {
        // Fire notification webhook
        if (webhook) {
          const notification = {
            event_type: 'nomotic_interrupt.escalation',
            interrupt_id: interrupt.interrupt_id,
            trigger_condition: interrupt.trigger_condition,
            severity: interrupt.severity,
            timeout_hours: interrupt.timeout_hours || 24,
            artifact_id: interrupt.metadata.artifact_id || '',
            escalation_level: interrupt.metadata.escalation_level || 'L3',
          };

          postJson(webhook, notification)
            .then((res) => {
              console.log(
                '[guardspine:info] Escalation notification sent for %s: status=%d',
                interrupt.interrupt_id,
                res.status
              );
            })
            .catch((err) => {
              console.log(
                '[guardspine:error] Failed to send escalation for %s: %s',
                interrupt.interrupt_id,
                err instanceof Error ? err.message : String(err)
              );
            });
        } else {
          console.log(
            '[guardspine:warn] Escalation interrupt %s fired but no callback URL configured',
            interrupt.interrupt_id
          );
        }
        break;
      }

      default:
        console.log(
          '[guardspine:warn] Unknown interrupt type: %s',
          interrupt.interrupt_type
        );
    }
  }
}

export default { handleNomoticInterrupts };
