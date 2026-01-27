import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class CodeGuard implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'CodeGuard',
    name: 'codeGuard',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["gateType"]}} | Block >= L{{$parameter["blockTier"]}}',
    description: 'Run quality gate validation on a code diff and return SARIF-compatible findings',
    defaults: { name: 'CodeGuard' },
    inputs: ['main'],
    outputs: ['main', 'main'],
    outputNames: ['Pass', 'Block'],
    credentials: [{ name: 'guardSpineApi', required: true }],
    properties: [
      {
        displayName: 'Diff Text',
        name: 'diffText',
        type: 'string',
        typeOptions: { rows: 10 },
        default: '',
        required: true,
        description: 'Code diff or source text to analyze',
      },
      {
        displayName: 'Gate Type',
        name: 'gateType',
        type: 'options',
        options: [
          { name: 'Strict', value: 'strict' },
          { name: 'Standard', value: 'standard' },
          { name: 'Lenient', value: 'lenient' },
        ],
        default: 'standard',
        description: 'Quality gate strictness level',
      },
      {
        displayName: 'Block Threshold',
        name: 'blockTier',
        type: 'number',
        typeOptions: { minValue: 0, maxValue: 4 },
        default: 3,
        description: 'Risk tier at which to route to Block output (0=never block, 4=only critical)',
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
      const diffText = this.getNodeParameter('diffText', i) as string;
      const gateType = this.getNodeParameter('gateType', i) as string;
      const blockTier = this.getNodeParameter('blockTier', i) as number;

      let response: any;
      try {
        response = await this.helpers.httpRequest({
          method: 'POST',
          url: `${credentials.baseUrl}/api/v1/guard/code`,
          headers: {
            Authorization: `Bearer ${credentials.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: {
            diff_text: diffText,
            gate_type: gateType,
          },
          returnFullResponse: false,
        });
      } catch (error: any) {
        throw new NodeOperationError(
          this.getNode(),
          `CodeGuard API error: ${error.message}`,
          { itemIndex: i },
        );
      }

      const outputItem: INodeExecutionData = {
        json: {
          ...items[i].json,
          _guard: {
            risk_tier: response.risk_tier,
            passed: response.passed,
            findings: response.findings,
            sigma_level: response.sigma_level,
            dpmo: response.dpmo,
            evidence_hash: response.evidence_hash,
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
