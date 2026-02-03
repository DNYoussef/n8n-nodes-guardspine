import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

import type { GuardEvaluateResponse } from '../types';

export class GuardSpinePDFGuard implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'GuardSpine PDFGuard',
    name: 'guardSpinePdfGuard',
    group: ['transform'],
    version: 1,
    subtitle: 'PDF | {{$parameter["policyPackId"]}} | Block >= L{{$parameter["riskThreshold"]}}',
    description: 'Send PDF artifact content to GuardSpine for policy review',
    defaults: { name: 'PDFGuard' },
    inputs: ['main'],
    outputs: ['main', 'main'],
    outputNames: ['Pass', 'Block'],
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
        displayName: 'Policy Pack ID',
        name: 'policyPackId',
        type: 'string',
        default: 'nomotic-core',
        required: true,
        description: 'Governance policy pack to evaluate against',
      },
      {
        displayName: 'Risk Threshold',
        name: 'riskThreshold',
        type: 'number',
        typeOptions: { minValue: 0, maxValue: 4 },
        default: 2,
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
      const backendUrl = this.getNodeParameter('backendUrl', i) as string;
      const policyPackId = this.getNodeParameter('policyPackId', i) as string;
      const riskThreshold = this.getNodeParameter('riskThreshold', i) as number;

      const baseUrl = backendUrl || credentials.baseUrl;

      let response: GuardEvaluateResponse;
      try {
        response = await this.helpers.httpRequest({
          method: 'POST',
          url: `${baseUrl}/api/v1/guard/evaluate`,
          headers: {
            Authorization: `Bearer ${credentials.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: {
            artifact_type: 'pdf',
            artifact_data: items[i].json,
            rubric_pack_id: policyPackId,
            create_bead: true,
          },
          returnFullResponse: false,
          timeout: 30000,
        });
      } catch (error: any) {
        throw new NodeOperationError(
          this.getNode(),
          `PDFGuard API error: ${error.message}`,
          { itemIndex: i },
        );
      }

      const outputItem: INodeExecutionData = {
        json: {
          ...items[i].json,
          _guard: {
            artifact_type: 'pdf',
            risk_tier: response.risk_tier,
            score: response.score,
            violations: response.violations,
            bead_id: response.bead_id,
            evidence_hash: response.evidence_hash,
            policy_pack: policyPackId,
            evaluated_at: response.evaluated_at,
          },
        },
      };

      if (response.risk_tier >= riskThreshold) {
        blockItems.push(outputItem);
      } else {
        passItems.push(outputItem);
      }
    }

    return [passItems, blockItems];
  }
}
