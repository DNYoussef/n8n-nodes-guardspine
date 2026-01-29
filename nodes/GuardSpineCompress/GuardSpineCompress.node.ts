import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

interface CompressionResult {
  compressed_count: number;
  original_count: number;
  compression_ratio: number;
  clusters: Array<{
    cluster_id: string;
    representative: unknown;
    member_count: number;
  }>;
  evidence_hash: string;
}

export class GuardSpineCompress implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'GuardSpine Compress',
    name: 'guardSpineCompress',
    group: ['transform'],
    version: 1,
    subtitle: 'Window={{$parameter["windowHours"]}}h | Threshold={{$parameter["similarityThreshold"]}}',
    description: 'Compress similar events via the GuardSpine compression API',
    defaults: { name: 'GuardSpine Compress' },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [{ name: 'guardSpineApi', required: true }],
    properties: [
      {
        displayName: 'Backend URL',
        name: 'backendUrl',
        type: 'string',
        default: '',
        description: 'Override backend URL (leave empty to use credential base URL)',
      },
      {
        displayName: 'Window Hours',
        name: 'windowHours',
        type: 'number',
        typeOptions: { minValue: 1 },
        default: 24,
        description: 'Time window in hours for event grouping',
      },
      {
        displayName: 'Similarity Threshold',
        name: 'similarityThreshold',
        type: 'number',
        typeOptions: { minValue: 0, maxValue: 1, numberStepSize: 0.05 },
        default: 0.85,
        description: 'Cosine similarity threshold for clustering (0-1)',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const credentials = await this.getCredentials('guardSpineApi') as {
      baseUrl: string;
      apiKey: string;
    };
    const items = this.getInputData();

    const backendUrlOverride = this.getNodeParameter('backendUrl', 0) as string;
    const windowHours = this.getNodeParameter('windowHours', 0) as number;
    const similarityThreshold = this.getNodeParameter('similarityThreshold', 0) as number;

    const baseUrl = backendUrlOverride || credentials.baseUrl;
    const events = items.map((item) => item.json);

    let response: CompressionResult;
    try {
      response = await this.helpers.httpRequest({
        method: 'POST',
        url: `${baseUrl}/api/v1/compress/full`,
        headers: {
          Authorization: `Bearer ${credentials.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: {
          events,
          window_hours: windowHours,
          similarity_threshold: similarityThreshold,
        },
        returnFullResponse: false,
        timeout: 60000,
      });
    } catch (error: any) {
      throw new NodeOperationError(
        this.getNode(),
        `GuardSpine Compress API error: ${error.message}`,
      );
    }

    const outputItems: INodeExecutionData[] = [
      {
        json: {
          compressed_count: response.compressed_count,
          original_count: response.original_count,
          compression_ratio: response.compression_ratio,
          clusters: response.clusters,
          evidence_hash: response.evidence_hash,
        },
      },
    ];

    return [outputItems];
  }
}
