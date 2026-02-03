import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

import type { BundleImportResponse } from '../types';

export class BundleImport implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Bundle Import',
    name: 'bundleImport',
    group: ['transform'],
    version: 1,
    subtitle: 'Import evidence bundle',
    description: 'Import a v0.2.0 evidence bundle into GuardSpine for verification and storage',
    defaults: { name: 'Bundle Import' },
    inputs: ['main'],
    outputs: ['main', 'main'],
    outputNames: ['Success', 'Failed'],
    credentials: [{ name: 'guardSpineApi', required: true }],
    properties: [
      {
        displayName: 'Bundle JSON',
        name: 'bundleJson',
        type: 'json',
        default: '',
        required: true,
        description: 'The v0.2.0 evidence bundle JSON to import',
      },
      {
        displayName: 'Require Signatures',
        name: 'requireSignatures',
        type: 'boolean',
        default: false,
        description: 'Whether to require valid signatures for import',
      },
      {
        displayName: 'Export Format',
        name: 'exportFormat',
        type: 'options',
        options: [
          { name: 'Spec (v0.2.0)', value: 'spec' },
          { name: 'Report', value: 'report' },
          { name: 'None', value: 'none' },
        ],
        default: 'none',
        description: 'Optionally export the bundle after import',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const credentials = (await this.getCredentials('guardSpineApi')) as {
      baseUrl: string;
      apiKey: string;
    };
    const items = this.getInputData();
    const successResults: INodeExecutionData[] = [];
    const failedResults: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const bundleJsonRaw = this.getNodeParameter('bundleJson', i);
      const requireSignatures = this.getNodeParameter('requireSignatures', i) as boolean;
      const exportFormat = this.getNodeParameter('exportFormat', i) as string;

      let bundle: Record<string, unknown>;
      try {
        bundle = typeof bundleJsonRaw === 'string' ? JSON.parse(bundleJsonRaw) : bundleJsonRaw;
      } catch {
        failedResults.push({
          json: {
            ...items[i].json,
            _bundle_import: {
              success: false,
              error: 'Invalid JSON in Bundle JSON field',
            },
          },
        });
        continue;
      }

      // Validate required fields
      if (!bundle.bundle_id || !bundle.version || !bundle.items) {
        failedResults.push({
          json: {
            ...items[i].json,
            _bundle_import: {
              success: false,
              error: 'Bundle missing required fields (bundle_id, version, items)',
            },
          },
        });
        continue;
      }

      // Import the bundle
      let response: BundleImportResponse;
      try {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${credentials.apiKey}`,
          'Content-Type': 'application/json',
        };
        if (requireSignatures) {
          headers['X-Require-Signatures'] = 'true';
        }

        response = await this.helpers.httpRequest({
          method: 'POST',
          url: `${credentials.baseUrl}/api/v1/bundles/import`,
          headers,
          body: bundle,
          returnFullResponse: false,
          timeout: 30000,
        });
      } catch (error: any) {
        const errorDetail = error.response?.data?.detail || error.message;
        failedResults.push({
          json: {
            ...items[i].json,
            _bundle_import: {
              success: false,
              error: `Import failed: ${JSON.stringify(errorDetail)}`,
            },
          },
        });
        continue;
      }

      // Optionally export in requested format
      let exportedData: Record<string, unknown> | null = null;
      if (exportFormat !== 'none' && response.bundle_id) {
        try {
          const exportUrl = exportFormat === 'spec'
            ? `${credentials.baseUrl}/api/v1/bundles/import/${response.bundle_id}/export/spec`
            : `${credentials.baseUrl}/api/v1/bundles/import/${response.bundle_id}/export/report`;

          exportedData = await this.helpers.httpRequest({
            method: 'GET',
            url: exportUrl,
            headers: {
              Authorization: `Bearer ${credentials.apiKey}`,
            },
            returnFullResponse: false,
            timeout: 15000,
          });
        } catch {
          // Export failed but import succeeded - don't fail the whole operation
          exportedData = { error: 'Export failed after successful import' };
        }
      }

      successResults.push({
        json: {
          ...items[i].json,
          _bundle_import: {
            success: true,
            bundle_id: response.bundle_id,
            raw_sha256: response.raw_sha256,
            imported_at: response.imported_at,
            verified: response.verified,
            version: response.version,
            item_count: response.item_count,
            root_hash: response.root_hash,
            errors: response.errors,
            exported: exportedData,
          },
        },
      });
    }

    return [successResults, failedResults];
  }
}
