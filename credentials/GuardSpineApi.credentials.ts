import {
  IAuthenticateGeneric,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class GuardSpineApi implements ICredentialType {
  name = 'guardSpineApi';
  displayName = 'GuardSpine API';
  documentationUrl = 'https://github.com/DNYoussef/life-os-dashboard';
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
