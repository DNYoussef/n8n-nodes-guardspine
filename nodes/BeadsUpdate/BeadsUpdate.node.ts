import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

import type { BeadsUpdateResponse, BeadsEvidenceResponse } from '../types';

export class BeadsUpdate implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Beads Update',
    name: 'beadsUpdate',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}} task {{$parameter["taskId"]}}',
    description: 'Update a Beads task or add evidence via the existing PUT endpoints',
    defaults: { name: 'Beads Update' },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [{ name: 'guardSpineApi', required: true }],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Update Task', value: 'updateTask' },
          { name: 'Add Evidence', value: 'addEvidence' },
        ],
        default: 'updateTask',
      },
      {
        displayName: 'Task ID',
        name: 'taskId',
        type: 'string',
        default: '',
        required: true,
        description: 'The Beads task ID to update',
      },
      // --- updateTask fields ---
      {
        displayName: 'Status',
        name: 'status',
        type: 'options',
        options: [
          { name: 'Open', value: 'open' },
          { name: 'In Progress', value: 'in_progress' },
          { name: 'Done', value: 'done' },
          { name: 'Blocked', value: 'blocked' },
        ],
        default: 'open',
        displayOptions: { show: { operation: ['updateTask'] } },
        description: 'New status for the task',
      },
      {
        displayName: 'Priority',
        name: 'priority',
        type: 'number',
        typeOptions: { minValue: 1, maxValue: 5 },
        default: 2,
        displayOptions: { show: { operation: ['updateTask'] } },
        description: 'Priority level 1-5 (optional, sent if changed)',
      },
      {
        displayName: 'Labels',
        name: 'labels',
        type: 'string',
        default: '',
        displayOptions: { show: { operation: ['updateTask'] } },
        description: 'Comma-separated labels',
      },
      {
        displayName: 'Description',
        name: 'description',
        type: 'string',
        typeOptions: { rows: 4 },
        default: '',
        displayOptions: { show: { operation: ['updateTask'] } },
        description: 'Updated task description',
      },
      // --- addEvidence fields ---
      {
        displayName: 'Evidence Hash',
        name: 'evidenceHash',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { operation: ['addEvidence'] } },
        description: 'Hash identifying the evidence artifact',
      },
      {
        displayName: 'Evidence Type',
        name: 'evidenceType',
        type: 'string',
        default: 'guard_result',
        displayOptions: { show: { operation: ['addEvidence'] } },
        description: 'Type of evidence being attached',
      },
      {
        displayName: 'Evidence Data',
        name: 'evidenceData',
        type: 'json',
        default: '{}',
        displayOptions: { show: { operation: ['addEvidence'] } },
        description: 'Additional JSON data for the evidence record',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const credentials = await this.getCredentials('guardSpineApi') as {
      baseUrl: string;
      apiKey: string;
    };
    const items = this.getInputData();
    const outputItems: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const operation = this.getNodeParameter('operation', i) as string;
      const taskId = this.getNodeParameter('taskId', i) as string;

      let response: BeadsUpdateResponse | BeadsEvidenceResponse;
      try {
        if (operation === 'updateTask') {
          const status = this.getNodeParameter('status', i) as string;
          const priority = this.getNodeParameter('priority', i) as number;
          const labelsStr = this.getNodeParameter('labels', i) as string;
          const description = this.getNodeParameter('description', i) as string;

          const body: Record<string, unknown> = { status, priority };
          if (labelsStr) {
            body.labels = labelsStr.split(',').map((l: string) => l.trim()).filter(Boolean);
          }
          if (description) {
            body.description = description;
          }

          response = await this.helpers.httpRequest({
            method: 'PUT',
            url: `${credentials.baseUrl}/api/v1/beads/tasks/${taskId}`,
            headers: {
              Authorization: `Bearer ${credentials.apiKey}`,
              'Content-Type': 'application/json',
            },
            body,
            returnFullResponse: false,
            timeout: 15000,
          });
        } else {
          // addEvidence
          const evidenceHash = this.getNodeParameter('evidenceHash', i) as string;
          const evidenceType = this.getNodeParameter('evidenceType', i) as string;
          const evidenceDataRaw = this.getNodeParameter('evidenceData', i);
          let evidenceData: Record<string, unknown>;
          try {
            evidenceData = typeof evidenceDataRaw === 'string'
              ? JSON.parse(evidenceDataRaw) : evidenceDataRaw;
          } catch {
            throw new NodeOperationError(this.getNode(), 'Invalid JSON in Evidence Data', { itemIndex: i });
          }

          response = await this.helpers.httpRequest({
            method: 'PUT',
            url: `${credentials.baseUrl}/api/v1/beads/tasks/${taskId}/evidence`,
            headers: {
              Authorization: `Bearer ${credentials.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: {
              evidence_hash: evidenceHash,
              evidence_type: evidenceType,
              evidence_data: evidenceData,
            },
            returnFullResponse: false,
            timeout: 15000,
          });
        }
      } catch (error: any) {
        throw new NodeOperationError(
          this.getNode(),
          `Beads API error: ${error.message}`,
          { itemIndex: i },
        );
      }

      outputItems.push({
        json: {
          ...items[i].json,
          _bead: {
            id: response.id || taskId,
            status: response.status,
            operation,
            ...('evidence' in response && response.evidence?.[0]?.evidence_hash ? { evidence_hash: response.evidence[0].evidence_hash } : {}),
          },
        },
      });
    }

    return [outputItems];
  }
}
