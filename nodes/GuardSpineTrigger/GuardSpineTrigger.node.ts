import {
  INodeType,
  INodeTypeDescription,
  IWebhookFunctions,
  IWebhookResponseData,
  INodeExecutionData,
} from 'n8n-workflow';
import { createHmac, timingSafeEqual } from 'crypto';

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

export class GuardSpineTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'GuardSpine Trigger',
    name: 'guardSpineTrigger',
    group: ['trigger'],
    version: 1,
    subtitle: '={{$parameter["eventType"]}}',
    description: 'Receive webhook events from GuardSpine (risk alerts, approvals, scans)',
    defaults: { name: 'GuardSpine Trigger' },
    inputs: [],
    outputs: ['main'],
    credentials: [
      {
        name: 'guardSpineApi',
        required: true,
      },
    ],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'guardspine-event',
        isFullPath: false,
      },
    ],
    properties: [
      {
        displayName: 'Event Type',
        name: 'eventType',
        type: 'options',
        options: [
          { name: 'All Events', value: 'all' },
          { name: 'Risk Alert', value: 'risk_alert' },
          { name: 'Approval Request', value: 'approval_request' },
          { name: 'Bundle Created', value: 'bundle_created' },
          { name: 'Scan Completed', value: 'scan_completed' },
        ],
        default: 'all',
        description: 'Which event type to listen for (or all)',
      },
    ],
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const credentials = await this.getCredentials('guardSpineApi') as {
      webhookSecret?: string;
    };
    const webhookSecret = credentials.webhookSecret || '';

    // HMAC signature verification is mandatory. Unsigned event webhooks are
    // indistinguishable from direct internet calls to the n8n public URL.
    if (!webhookSecret) {
      return {
        webhookResponse: JSON.stringify({ error: 'GuardSpine Webhook Secret is required' }),
        workflowData: [[]],
      };
    }

    const req = this.getRequestObject();
    const signatureHeader = req.headers['x-guardspine-signature'] as string | undefined;
    if (!signatureHeader) {
      return {
        webhookResponse: JSON.stringify({ error: 'Missing X-GuardSpine-Signature header' }),
        workflowData: [[]],
      };
    }

    const signature = signatureHeader.startsWith('sha256=')
      ? signatureHeader.slice('sha256='.length)
      : signatureHeader;
    const expected = createHmac('sha256', webhookSecret)
      .update(canonicalJson(this.getBodyData()))
      .digest('hex');
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return {
        webhookResponse: JSON.stringify({ error: 'Invalid signature' }),
        workflowData: [[]],
      };
    }

    const body = this.getBodyData() as {
      event_type?: string;
      timestamp?: string;
      payload?: Record<string, unknown>;
      [key: string]: unknown;
    };

    const eventType = this.getNodeParameter('eventType') as string;

    // Filter by event type if not "all"
    if (eventType !== 'all' && body.event_type !== eventType) {
      return {
        noWebhookResponse: true,
        workflowData: [[]],
      };
    }

    const outputItem: INodeExecutionData = {
      json: {
        event_type: body.event_type || 'unknown',
        timestamp: body.timestamp || new Date().toISOString(),
        payload: body.payload || body,
        received_at: new Date().toISOString(),
        signature_verified: true,
      },
    };

    return {
      webhookResponse: 'OK',
      workflowData: [[outputItem]],
    };
  }
}
