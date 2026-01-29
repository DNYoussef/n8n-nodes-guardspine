import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

import type { EvidenceSealResponse } from '../types';

export class EvidenceSeal implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Evidence Seal',
    name: 'evidenceSeal',
    group: ['transform'],
    version: 1,
    subtitle: 'Seal evidence bundle',
    description: 'Create a tamper-evident hash-chained evidence bundle via GuardSpine',
    defaults: { name: 'Evidence Seal' },
    inputs: ['main'],
    outputs: ['main'],
    outputNames: ['Sealed'],
    credentials: [{ name: 'guardSpineApi', required: true }],
    properties: [
      {
        displayName: 'Diff Hash',
        name: 'diffHash',
        type: 'string',
        default: '',
        required: true,
        description: 'SHA-256 hash of the diff or artifact being sealed',
      },
      {
        displayName: 'Approver ID',
        name: 'approverId',
        type: 'string',
        default: '',
        required: true,
        description: 'ID of the approver (human or agent)',
      },
      {
        displayName: 'Policy Ref',
        name: 'policyRef',
        type: 'string',
        default: '',
        required: true,
        description: 'Policy reference that was evaluated',
      },
      {
        displayName: 'Previous Chain Hash',
        name: 'previousChainHash',
        type: 'string',
        default: '',
        description: 'Previous chain hash to continue an existing chain (leave empty for genesis)',
      },
      {
        displayName: 'Metadata',
        name: 'metadata',
        type: 'json',
        default: '',
        description: 'Optional JSON metadata to include in the bundle',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const credentials = (await this.getCredentials('guardSpineApi')) as {
      baseUrl: string;
      apiKey: string;
    };
    const items = this.getInputData();
    const results: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const diffHash = this.getNodeParameter('diffHash', i) as string;
      const approverId = this.getNodeParameter('approverId', i) as string;
      const policyRef = this.getNodeParameter('policyRef', i) as string;
      const previousChainHash = this.getNodeParameter('previousChainHash', i) as string;
      const metadataRaw = this.getNodeParameter('metadata', i);

      const body: Record<string, unknown> = {
        diff_hash: diffHash,
        approver_id: approverId,
        policy_ref: policyRef,
      };

      if (previousChainHash) {
        body.previous_chain_hash = previousChainHash;
      }

      if (metadataRaw) {
        try {
          body.metadata = typeof metadataRaw === 'string' ? JSON.parse(metadataRaw) : metadataRaw;
        } catch {
          throw new NodeOperationError(this.getNode(), 'Invalid JSON in Metadata', { itemIndex: i });
        }
      }

      let response: EvidenceSealResponse;
      try {
        response = await this.helpers.httpRequest({
          method: 'POST',
          url: `${credentials.baseUrl}/api/v1/evidence/seal`,
          headers: {
            Authorization: `Bearer ${credentials.apiKey}`,
            'Content-Type': 'application/json',
          },
          body,
          returnFullResponse: false,
          timeout: 15000,
        });
      } catch (error: any) {
        throw new NodeOperationError(
          this.getNode(),
          `GuardSpine Evidence Seal error: ${error.message}`,
          { itemIndex: i },
        );
      }

      results.push({
        json: {
          ...items[i].json,
          _evidence_seal: {
            bundle_hash: response.bundle_hash,
            chain_hash: response.chain_hash,
            sealed_at: response.sealed_at,
            offline_verify_cmd: response.offline_verify_cmd,
          },
        },
      });
    }

    return [results];
  }
}
