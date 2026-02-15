import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

import type { IDataObject } from 'n8n-workflow';

export class BeadsList implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Beads List',
    name: 'beadsList',
    group: ['transform'],
    version: 1,
    subtitle: '{{$parameter["status"]}} | limit {{$parameter["limit"]}}',
    description: 'List Beads work items from GuardSpine with optional filters',
    defaults: { name: 'Beads List' },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [{ name: 'guardSpineApi', required: true }],
    properties: [
      {
        displayName: 'Status',
        name: 'status',
        type: 'options',
        options: [
          { name: 'All', value: 'all' },
          { name: 'Ready', value: 'ready' },
          { name: 'In Progress', value: 'in_progress' },
          { name: 'Done', value: 'done' },
          { name: 'Blocked', value: 'blocked' },
        ],
        default: 'all',
        description: 'Filter by bead status',
      },
      {
        displayName: 'Owner',
        name: 'owner',
        type: 'string',
        default: '',
        description: 'Filter by owner (exact match)',
      },
      {
        displayName: 'Tags',
        name: 'tags',
        type: 'string',
        default: '',
        description: 'Comma-separated tags to filter by',
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        typeOptions: { minValue: 1, maxValue: 200 },
        default: 50,
        description: 'Maximum number of results to return',
      },
      {
        displayName: 'Offset',
        name: 'offset',
        type: 'number',
        typeOptions: { minValue: 0 },
        default: 0,
        description: 'Number of results to skip (for pagination)',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const credentials = await this.getCredentials('guardSpineApi') as {
      baseUrl: string;
      apiKey: string;
    };

    const status = this.getNodeParameter('status', 0) as string;
    const owner = this.getNodeParameter('owner', 0) as string;
    const tagsStr = this.getNodeParameter('tags', 0) as string;
    const limit = this.getNodeParameter('limit', 0) as number;
    const offset = this.getNodeParameter('offset', 0) as number;

    const qs: Record<string, string | number> = { limit, offset };
    if (status !== 'all') {
      qs.status = status;
    }
    if (owner) {
      qs.owner = owner;
    }
    if (tagsStr) {
      qs.tags = tagsStr.split(',').map((t: string) => t.trim()).filter(Boolean).join(',');
    }

    const queryString = Object.entries(qs)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    let response: { items: IDataObject[]; total: number; limit: number; offset: number };
    try {
      response = await this.helpers.httpRequest({
        method: 'GET',
        url: `${credentials.baseUrl}/api/v1/beads/tasks?${queryString}`,
        headers: {
          Authorization: `Bearer ${credentials.apiKey}`,
        },
        returnFullResponse: false,
        timeout: 15000,
      });
    } catch (error: any) {
      throw new NodeOperationError(
        this.getNode(),
        `Beads API error: ${error.message}`,
      );
    }

    const outputItems: INodeExecutionData[] = (response.items || []).map(
      (item) => ({ json: item }),
    );

    return [outputItems];
  }
}
