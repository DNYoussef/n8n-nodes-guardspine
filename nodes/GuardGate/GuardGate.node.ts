import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class GuardGate implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'GuardSpine Gate',
    name: 'guardGate',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["rubricPack"]}} | Block >= L{{$parameter["blockTier"]}}',
    description: 'Evaluate an artifact against a governance rubric and return risk tier',
    defaults: { name: 'Guard Gate' },
    inputs: ['main'],
    outputs: ['main', 'main'],
    outputNames: ['Pass', 'Block'],
    credentials: [{ name: 'guardSpineApi', required: true }],
    properties: [
      {
        displayName: 'Artifact Data',
        name: 'artifactData',
        type: 'json',
        default: '',
        required: true,
        description: 'JSON data of the artifact to evaluate',
      },
      {
        displayName: 'Artifact Type',
        name: 'artifactType',
        type: 'options',
        options: [
          { name: 'Code Diff', value: 'code' },
          { name: 'Document', value: 'document' },
          { name: 'Spreadsheet', value: 'spreadsheet' },
          { name: 'Image', value: 'image' },
          { name: 'Generic', value: 'generic' },
        ],
        default: 'generic',
      },
      {
        displayName: 'Rubric Pack',
        name: 'rubricPack',
        type: 'options',
        options: [
          { name: 'Nomotic Core', value: 'nomotic-core' },
          { name: 'Finance', value: 'finance' },
          { name: 'Healthcare', value: 'healthcare' },
          { name: 'Legal', value: 'legal' },
          { name: 'Software', value: 'software' },
          { name: 'Custom', value: 'custom' },
        ],
        default: 'nomotic-core',
      },
      {
        displayName: 'Block Threshold',
        name: 'blockTier',
        type: 'number',
        typeOptions: { minValue: 0, maxValue: 4 },
        default: 2,
        description: 'Risk tier at which to route to Block output (0=never block, 4=only critical)',
      },
      {
        displayName: 'Create Bead',
        name: 'createBead',
        type: 'boolean',
        default: true,
        description: 'Automatically create a Beads work item for this evaluation',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const credentials = await this.getCredentials('guardSpineApi') as {
      baseUrl: string;
      apiKey: string;
    };
    const items = this.getInputData();
    const passItems: INodeExecutionData[] = [];
    const blockItems: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const artifactData = this.getNodeParameter('artifactData', i);
      const artifactType = this.getNodeParameter('artifactType', i) as string;
      const rubricPack = this.getNodeParameter('rubricPack', i) as string;
      const blockTier = this.getNodeParameter('blockTier', i) as number;
      const createBead = this.getNodeParameter('createBead', i) as boolean;

      let response: any;
      try {
        response = await this.helpers.httpRequest({
          method: 'POST',
          url: `${credentials.baseUrl}/api/v1/guard/evaluate`,
          headers: {
            Authorization: `Bearer ${credentials.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: {
            artifact_type: artifactType,
            artifact_data:
              typeof artifactData === 'string'
                ? JSON.parse(artifactData)
                : artifactData,
            rubric_pack_id: rubricPack,
            create_bead: createBead,
          },
          returnFullResponse: false,
        });
      } catch (error: any) {
        throw new NodeOperationError(
          this.getNode(),
          `GuardSpine API error: ${error.message}`,
          { itemIndex: i },
        );
      }

      const outputItem: INodeExecutionData = {
        json: {
          ...items[i].json,
          _guard: {
            risk_tier: response.risk_tier,
            score: response.score,
            violations: response.violations,
            bead_id: response.bead_id,
            evidence_hash: response.evidence_hash,
            rubric_pack: rubricPack,
            evaluated_at: response.evaluated_at,
          },
        },
      };

      if (response.risk_tier >= blockTier) {
        blockItems.push(outputItem);
      } else {
        passItems.push(outputItem);
      }
    }

    return [passItems, blockItems];
  }
}
