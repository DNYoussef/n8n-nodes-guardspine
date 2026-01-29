import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

import type { CouncilVoteResponse } from '../types';

export class CouncilVote implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Council Vote',
    name: 'councilVote',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["votingMode"]}} vote',
    description: 'Submit a question for council consensus voting and route by decision',
    defaults: { name: 'Council Vote' },
    inputs: ['main'],
    outputs: ['main', 'main'],
    outputNames: ['Pass', 'Block'],
    credentials: [{ name: 'guardSpineApi', required: true }],
    properties: [
      {
        displayName: 'Question',
        name: 'question',
        type: 'string',
        default: '',
        required: true,
        description: 'The question to put to the council for voting',
      },
      {
        displayName: 'Context',
        name: 'context',
        type: 'json',
        default: '{}',
        description: 'Additional JSON context for persona evaluation',
      },
      {
        displayName: 'Voting Mode',
        name: 'votingMode',
        type: 'options',
        options: [
          { name: 'Majority (>50%)', value: 'majority' },
          { name: 'Supermajority (>66%)', value: 'supermajority' },
          { name: 'Unanimous (100%)', value: 'unanimous' },
        ],
        default: 'majority',
        description: 'Consensus threshold required to pass',
      },
      {
        displayName: 'Persona IDs',
        name: 'personaIds',
        type: 'string',
        default: '',
        description: 'Comma-separated persona IDs (leave empty for 5 default personas)',
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
      const question = this.getNodeParameter('question', i) as string;
      const contextRaw = this.getNodeParameter('context', i);
      const votingMode = this.getNodeParameter('votingMode', i) as string;
      const personaIdsRaw = this.getNodeParameter('personaIds', i) as string;

      let contextObj: Record<string, unknown>;
      try {
        contextObj = typeof contextRaw === 'string' ? JSON.parse(contextRaw) : contextRaw;
      } catch {
        throw new NodeOperationError(this.getNode(), 'Invalid JSON in Context field', { itemIndex: i });
      }

      const personaIds = personaIdsRaw
        ? personaIdsRaw.split(',').map((s: string) => s.trim()).filter(Boolean)
        : null;

      let response: CouncilVoteResponse;
      try {
        response = await this.helpers.httpRequest({
          method: 'POST',
          url: `${credentials.baseUrl}/api/v1/council/vote`,
          headers: {
            Authorization: `Bearer ${credentials.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: {
            question,
            context: contextObj,
            voting_mode: votingMode,
            persona_ids: personaIds,
          },
          returnFullResponse: false,
          timeout: 60000,
        });
      } catch (error: any) {
        throw new NodeOperationError(
          this.getNode(),
          `Council Vote API error: ${error.message}`,
          { itemIndex: i },
        );
      }

      const outputItem: INodeExecutionData = {
        json: {
          ...items[i].json,
          _council: {
            consensus_pct: response.consensus_pct,
            decision: response.decision,
            votes: response.votes,
            evidence_hash: response.evidence_hash,
            voting_mode: votingMode,
          },
        },
      };

      if (response.decision === 'pass') {
        passItems.push(outputItem);
      } else {
        blockItems.push(outputItem);
      }
    }

    return [passItems, blockItems];
  }
}
