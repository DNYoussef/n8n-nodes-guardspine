import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IWebhookFunctions,
  IWebhookResponseData,
  NodeOperationError,
} from 'n8n-workflow';

export class ApprovalWait implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'GuardSpine Approval',
    name: 'approvalWait',
    group: ['transform'],
    version: 1,
    subtitle: 'L{{$parameter["riskTier"]}} | {{$parameter["timeoutMinutes"]}}m timeout',
    description: 'Pause workflow and wait for human approval via GuardSpine Inbox',
    defaults: { name: 'Approval Gate' },
    inputs: ['main'],
    outputs: ['main', 'main'],
    outputNames: ['Approved', 'Rejected'],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'approval-callback',
        isFullPath: false,
        restartWebhook: true,
      },
    ],
    credentials: [{ name: 'guardSpineApi', required: true }],
    properties: [
      {
        displayName: 'Diff Data',
        name: 'diffData',
        type: 'json',
        default: '',
        description: 'JSON diff data to display in approval inbox (original vs proposed)',
      },
      {
        displayName: 'Risk Tier',
        name: 'riskTier',
        type: 'number',
        typeOptions: { minValue: 0, maxValue: 4 },
        default: 2,
        description: 'Risk tier for this approval (0=info, 4=critical)',
      },
      {
        displayName: 'Guard Type',
        name: 'guardType',
        type: 'options',
        options: [
          { name: 'Code', value: 'code' },
          { name: 'Document', value: 'document' },
          { name: 'Spreadsheet', value: 'spreadsheet' },
          { name: 'Image', value: 'image' },
          { name: 'Generic', value: 'generic' },
        ],
        default: 'generic',
      },
      {
        displayName: 'Timeout (Minutes)',
        name: 'timeoutMinutes',
        type: 'number',
        typeOptions: { minValue: 1, maxValue: 1440 },
        default: 60,
        description: 'Minutes to wait before auto-timeout',
      },
      {
        displayName: 'Evidence Hash',
        name: 'evidenceHash',
        type: 'string',
        default: '={{$json._guard?.evidence_hash || ""}}',
        description: 'Evidence hash from previous guard evaluation',
      },
      {
        displayName: 'Bead ID',
        name: 'beadId',
        type: 'string',
        default: '={{$json._guard?.bead_id || ""}}',
        description: 'Bead ID from previous guard evaluation',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const credentials = await this.getCredentials('guardSpineApi') as {
      baseUrl: string;
      apiKey: string;
    };

    const diffData = this.getNodeParameter('diffData', 0);
    const riskTier = this.getNodeParameter('riskTier', 0) as number;
    const guardType = this.getNodeParameter('guardType', 0) as string;
    const timeoutMinutes = this.getNodeParameter('timeoutMinutes', 0) as number;
    const evidenceHash = this.getNodeParameter('evidenceHash', 0) as string;
    const beadId = this.getNodeParameter('beadId', 0) as string;

    // Parse diff data safely
    let parsedDiffData: unknown = null;
    if (typeof diffData === 'string' && diffData) {
      try {
        parsedDiffData = JSON.parse(diffData);
      } catch {
        throw new NodeOperationError(this.getNode(), 'Invalid JSON in Diff Data field');
      }
    } else if (diffData) {
      parsedDiffData = diffData;
    }

    const executionId = this.getExecutionId();
    const nodeId = this.getNode().id;
    const idempotencyKey = `${executionId}-${nodeId}`;

    // Build the webhook URL that n8n will listen on for the callback.
    // n8n exposes waiting webhooks at /webhook-waiting/<path>/<executionId>
    const baseWebhookUrl = (this as any).getNodeWebhookUrl?.('default')
      || `${credentials.baseUrl}/webhook-waiting/approval-callback`;

    try {
      await this.helpers.httpRequest({
        method: 'POST',
        url: `${credentials.baseUrl}/api/v1/guard/approval/request`,
        headers: {
          Authorization: `Bearer ${credentials.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: {
          resume_webhook_url: baseWebhookUrl,
          diff_data: parsedDiffData,
          risk_tier: riskTier,
          guard_type: guardType,
          workflow_execution_id: executionId,
          timeout_minutes: timeoutMinutes,
          evidence_hash: evidenceHash || '0'.repeat(64),
          bead_id: beadId || null,
          idempotency_key: idempotencyKey,
        },
        returnFullResponse: false,
      });
    } catch (error: any) {
      throw new NodeOperationError(
        this.getNode(),
        `Failed to create approval request: ${error.message}`,
      );
    }

    // Put execution to wait - n8n will resume when webhook fires
    await this.putExecutionToWait(new Date(Date.now() + timeoutMinutes * 60_000));
    return [[]];
  }

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const body = this.getBodyData() as {
      decision: string;
      decided_by: string;
      reason?: string;
    };

    const outputItem: INodeExecutionData = {
      json: {
        decision: body.decision,
        decided_by: body.decided_by,
        reason: body.reason || '',
        decided_at: new Date().toISOString(),
      },
    };

    if (body.decision === 'approved') {
      return {
        webhookResponse: 'OK',
        workflowData: [[outputItem], []],
      };
    } else {
      return {
        webhookResponse: 'OK',
        workflowData: [[], [outputItem]],
      };
    }
  }
}
