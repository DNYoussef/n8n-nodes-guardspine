import {
  IAuthenticateGeneric,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class GuardSpineApi implements ICredentialType {
  name = 'guardSpineApi';
  displayName = 'GuardSpine API';
  documentationUrl = 'https://github.com/DNYoussef/n8n-nodes-guardspine';
  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'http://localhost:8000',
      placeholder: 'https://api.guardspine.dev',
      description: 'GuardSpine API base URL',
    },
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description: 'GuardSpine API key from GUARDSPINE_API_KEY env var',
    },
    {
      displayName: 'Webhook Secret',
      name: 'webhookSecret',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description: 'HMAC-SHA256 secret for verifying inbound webhook signatures (X-GuardSpine-Signature header)',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        Authorization: '=Bearer {{$credentials.apiKey}}',
      },
    },
  };
}
