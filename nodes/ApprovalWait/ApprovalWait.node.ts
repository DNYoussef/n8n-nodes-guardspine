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

    const webhookUrl = this.getNodeWebhookUrl('default');
    if (!webhookUrl) {
      throw new NodeOperationError(
        this.getNode(),
        'Could not get webhook URL for approval callback',
      );
    }

    const diffData = this.getNodeParameter('diffData', 0);
    const riskTier = this.getNodeParameter('riskTier', 0) as number;
    const guardType = this.getNodeParameter('guardType', 0) as string;
    const timeoutMinutes = this.getNodeParameter('timeoutMinutes', 0) as number;
    const evidenceHash = this.getNodeParameter('evidenceHash', 0) as string;
    const beadId = this.getNodeParameter('beadId', 0) as string;

    // Generate idempotency key from execution context
    const executionId = this.getExecutionId();
    const nodeId = this.getNode().id;
    const idempotencyKey = `${executionId}-${nodeId}`;

    try {
      await this.helpers.httpRequest({
        method: 'POST',
        url: `${credentials.baseUrl}/api/v1/guard/approval/request`,
        headers: {
          Authorization: `Bearer ${credentials.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: {
          resume_webhook_url: webhookUrl,
          diff_data: typeof diffData === 'string' && diffData
            ? JSON.parse(diffData)
            : diffData || null,
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

    // Suspend execution and wait for webhook callback
    return this.putExecutionToWait();
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
