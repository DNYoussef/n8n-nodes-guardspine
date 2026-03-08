import {
  INodeType,
  INodeTypeDescription,
  IWebhookFunctions,
  IWebhookResponseData,
  INodeExecutionData,
} from 'n8n-workflow';
import { createHmac, timingSafeEqual } from 'crypto';

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

    // HMAC signature verification (if secret configured)
    if (webhookSecret) {
      const req = this.getRequestObject();
      const signature = req.headers['x-guardspine-signature'] as string | undefined;
      if (!signature) {
        return {
          webhookResponse: JSON.stringify({ error: 'Missing X-GuardSpine-Signature header' }),
          workflowData: [[]],
        };
      }

      const rawBody = JSON.stringify(this.getBodyData());
      const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
      const sigBuf = Buffer.from(signature, 'hex');
      const expBuf = Buffer.from(expected, 'hex');
      if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
        return {
          webhookResponse: JSON.stringify({ error: 'Invalid signature' }),
          workflowData: [[]],
        };
      }
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
        signature_verified: !!webhookSecret,
      },
    };

    return {
      webhookResponse: 'OK',
      workflowData: [[outputItem]],
    };
  }
}
