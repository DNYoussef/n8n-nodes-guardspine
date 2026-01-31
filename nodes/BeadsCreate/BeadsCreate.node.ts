import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

import type { BeadsCreateResponse } from '../types';

export class BeadsCreate implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Beads Create',
    name: 'beadsCreate',
    group: ['transform'],
    version: 1,
    subtitle: 'Create bead task',
    description: 'Create a new Beads work item in the GuardSpine spine',
    defaults: { name: 'Beads Create' },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [{ name: 'guardSpineApi', required: true }],
    properties: [
      {
        displayName: 'Title',
        name: 'title',
        type: 'string',
        default: '',
        required: true,
        description: 'Title for the bead task',
      },
      {
        displayName: 'Description',
        name: 'description',
        type: 'string',
        typeOptions: { rows: 4 },
        default: '',
        description: 'Task description',
      },
      {
        displayName: 'Priority',
        name: 'priority',
        type: 'number',
        typeOptions: { minValue: 1, maxValue: 5 },
        default: 2,
        description: 'Priority level 1-5',
      },
      {
        displayName: 'Labels',
        name: 'labels',
        type: 'string',
        default: '',
        description: 'Comma-separated labels',
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
      const title = this.getNodeParameter('title', i) as string;
      if (!title.trim()) {
        throw new NodeOperationError(this.getNode(), 'Title is required', { itemIndex: i });
      }
      const description = this.getNodeParameter('description', i) as string;
      const priority = this.getNodeParameter('priority', i) as number;
      const labelsStr = this.getNodeParameter('labels', i) as string;
      const labels = labelsStr
        ? labelsStr.split(',').map((l: string) => l.trim()).filter(Boolean)
        : [];

      let response: BeadsCreateResponse;
      try {
        response = await this.helpers.httpRequest({
          method: 'POST',
          url: `${credentials.baseUrl}/api/v1/beads/tasks`,
          headers: {
            Authorization: `Bearer ${credentials.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: { title, description, priority, labels },
          returnFullResponse: false,
          timeout: 15000,
        });
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
            id: response.id,
            title: response.title,
            status: response.status,
            priority: response.priority,
          },
        },
      });
    }

    return [outputItems];
  }
}
