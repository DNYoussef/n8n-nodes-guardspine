/**
 * GuardSpine External Hooks for n8n - THIN CLIENT (TypeScript)
 *
 * Loads via: EXTERNAL_HOOK_FILES=/path/to/guardspine-hooks.js
 *
 * All guard evaluation is delegated to the GuardSpine FastAPI backend.
 * This file contains zero local guard logic - it is a pure API client.
 *
 * Environment variables:
 *   GUARDSPINE_API_URL        - GuardSpine API base URL (default: http://localhost:8000)
 *   GUARDSPINE_API_KEY        - Bearer token for API auth
 *   GUARDSPINE_MODE           - "enforce" (block on fail) | "audit" (log only) | "off"
 *   GUARDSPINE_RISK_THRESHOLD - Max escalation level before blocking (default: L3)
 *   GUARDSPINE_RUBRIC_PACK    - Rubric pack ID (default: "nomotic")
 *   GUARDSPINE_LOG_LEVEL      - "debug" | "info" | "warn" | "error" (default: info)
 *   GUARDSPINE_CLASSIFICATION - Force classification: auto|L0|L1|L2|L3|L4 (default: auto)
 *   GUARDSPINE_BACKEND        - LLM backend: auto|litellm|openrouter|ollama (default: auto)
 *   GUARDSPINE_MODEL          - LLM model name (default: empty, uses backend default)
 *   GUARDSPINE_CALLBACK_URL   - Webhook callback URL for approvals (default: empty)
 */

import * as http from 'http';
import * as https from 'https';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type GuardSpineMode = 'enforce' | 'audit' | 'off';
type EscalationLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'auto';
type BackendType = 'auto' | 'litellm' | 'openrouter' | 'ollama';
// GS-8.1: Artifact types for multi-lane routing
type ArtifactKind = 'code' | 'pdf' | 'xlsx' | 'image';

interface GuardSpineConfig {
  apiUrl: string;
  apiKey: string;
  mode: GuardSpineMode;
  riskThreshold: string;
  rubricPack: string;
  logLevel: LogLevel;
  classification: EscalationLevel;
  backend: BackendType;
  model: string;
  // GS-5.2: Callback URL for approval webhooks
  callbackUrl: string;
}

interface ApiResponse<T = Record<string, unknown>> {
  status: number | undefined;
  data: T;
}

interface WorkflowNode {
  id: string;
  name: string;
  type: string;
  parameters: Record<string, unknown>;
}

interface WorkflowData {
  id?: string;
  name?: string;
  nodes?: WorkflowNode[];
  connections?: Record<string, unknown>;
  tags?: string[];
}

interface EvaluationResult {
  artifact_id?: string;
  escalation_level?: string;
  total_score?: number;
  findings?: Finding[];
  required_approvers?: string[];
}

interface Finding {
  finding_id?: string;
  id?: string;
  title: string;
  description?: string;
  severity: string;
  source_trigger?: string;
  enforcement?: string;
}

interface ExecutionContext {
  artifact_id: string;
  escalation_level?: string;
  risk_tier: number;
  bead_id: string | null;
  findings: Finding[];
  // GS-4.3: Track approval ID for callback handling
  approval_id?: string | null;
  // GS-8.1: Track detected artifact kind
  artifact_kind?: ArtifactKind;
  // GS-15.1: Telemetry tracking
  start_time?: number;
  evaluation_duration_ms?: number;
}

// GS-15.1: Telemetry event interface
interface TelemetryEvent {
  event_type: string;
  timestamp: string;
  // WHO/WHEN/PROJECT/WHY metadata (Memory MCP protocol)
  who: string;
  when: string;
  project: string;
  why: string;
  // Metrics
  metrics: Record<string, unknown>;
}

interface FullRunData {
  finished?: boolean;
}

// ---------------------------------------------------------------------------
// Config - exported for testing
// ---------------------------------------------------------------------------

export function createConfig(): GuardSpineConfig {
  return {
    apiUrl: process.env.GUARDSPINE_API_URL || 'http://localhost:8000',
    apiKey: process.env.GUARDSPINE_API_KEY || '',
    mode: (process.env.GUARDSPINE_MODE as GuardSpineMode) || 'audit',
    riskThreshold: process.env.GUARDSPINE_RISK_THRESHOLD || 'L3',
    rubricPack: process.env.GUARDSPINE_RUBRIC_PACK || 'nomotic',
    logLevel: (process.env.GUARDSPINE_LOG_LEVEL as LogLevel) || 'info',
    classification: (process.env.GUARDSPINE_CLASSIFICATION as EscalationLevel) || 'auto',
    backend: (process.env.GUARDSPINE_BACKEND as BackendType) || 'auto',
    model: process.env.GUARDSPINE_MODEL || '',
    // GS-5.2: Callback URL for approval webhooks
    callbackUrl: process.env.GUARDSPINE_CALLBACK_URL || '',
  };
}

// Default config instance
let CONFIG = createConfig();

// Allow tests to reset config
export function resetConfig(): void {
  CONFIG = createConfig();
}

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

// ---------------------------------------------------------------------------
// Error serialization helper
// ---------------------------------------------------------------------------

function serializeError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'object' && err !== null) {
    // Handle objects like { code: 'ETIMEDOUT' }
    const obj = err as Record<string, unknown>;
    if (obj.code) return `${obj.code}`;
    if (obj.message) return String(obj.message);
    try {
      return JSON.stringify(obj);
    } catch {
      return '[Unserializable object]';
    }
  }
  return String(err);
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const log = (level: LogLevel, msg: string, data?: unknown): void => {
  if (LOG_LEVELS[level] < LOG_LEVELS[CONFIG.logLevel]) return;
  const prefix = `[guardspine:${level}]`;
  if (data !== undefined) {
    console.log('%s %s %j', prefix, msg, data);
  } else {
    console.log('%s %s', prefix, msg);
  }
};

// ---------------------------------------------------------------------------
// HTTP client (zero dependencies)
// ---------------------------------------------------------------------------

const apiCall = <T = Record<string, unknown>>(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<ApiResponse<T>> => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, CONFIG.apiUrl);
    const transport = url.protocol === 'https:' ? https : http;
    const payload = body ? JSON.stringify(body) : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (CONFIG.apiKey) {
      headers['Authorization'] = `Bearer ${CONFIG.apiKey}`;
    }

    // GS-3.1: LLM backend routing headers
    if (CONFIG.backend !== 'auto') {
      headers['X-GuardSpine-Backend'] = CONFIG.backend;
    }
    if (CONFIG.model) {
      headers['X-GuardSpine-Model'] = CONFIG.model;
    }

    if (payload) {
      headers['Content-Length'] = String(Buffer.byteLength(payload));
    }

    const opts: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers,
      timeout: 10000,
    };

    const req = transport.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk.toString()));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) as T });
        } catch {
          resolve({ status: res.statusCode, data: { raw: data } as unknown as T });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('GuardSpine API timeout'));
    });

    req.on('error', (err) => reject(err));

    if (payload) req.write(payload);
    req.end();
  });
};

// ---------------------------------------------------------------------------
// Execution context map (passes bead_id/evidence_hash from pre -> post)
// ---------------------------------------------------------------------------

const executionContext = new Map<string, ExecutionContext>();

// Map backend escalation_level (L0-L4) to numeric risk tier
const tierFromEscalation = (level: string | undefined): number => {
  if (!level) return 0;
  const match = level.match(/L(\d)/);
  return match ? parseInt(match[1], 10) : 0;
};

// ---------------------------------------------------------------------------
// GS-8.1: Multi-artifact routing - detect artifact kind from node types
// ---------------------------------------------------------------------------

// Node type patterns for each guard lane
const PDF_NODE_PATTERNS = [
  'n8n-nodes-base.readPdf',
  'n8n-nodes-base.pdfMerge',
  'n8n-nodes-base.pdfExtract',
  '@n8n/n8n-nodes-langchain.documentLoaderPdf',
  'pdf',
];

const SPREADSHEET_NODE_PATTERNS = [
  'n8n-nodes-base.spreadsheetFile',
  'n8n-nodes-base.googleSheets',
  'n8n-nodes-base.microsoftExcel',
  'n8n-nodes-base.airtable',
  'excel',
  'sheets',
  'csv',
];

const IMAGE_NODE_PATTERNS = [
  'n8n-nodes-base.imageResize',
  'n8n-nodes-base.screenshot',
  'n8n-nodes-base.imageEdit',
  'n8n-nodes-base.imageMagick',
  '@n8n/n8n-nodes-langchain.documentLoaderImage',
  'image',
  'screenshot',
];

// Risk priority for artifact kinds (higher = more risky, takes precedence)
const ARTIFACT_RISK_PRIORITY: Record<ArtifactKind, number> = {
  code: 1,
  xlsx: 2,
  pdf: 3,
  image: 4,
};

/**
 * GS-8.1: Detect artifact kind from workflow node types.
 * Returns the highest-risk artifact kind found in the workflow.
 */
function detectArtifactKind(nodes: WorkflowNode[]): ArtifactKind {
  const nodeTypes = nodes.map((n) => n.type.toLowerCase());
  const detectedKinds: ArtifactKind[] = [];

  for (const nodeType of nodeTypes) {
    // Check PDF patterns
    if (PDF_NODE_PATTERNS.some((p) => nodeType.includes(p.toLowerCase()))) {
      detectedKinds.push('pdf');
    }
    // Check spreadsheet patterns
    if (SPREADSHEET_NODE_PATTERNS.some((p) => nodeType.includes(p.toLowerCase()))) {
      detectedKinds.push('xlsx');
    }
    // Check image patterns
    if (IMAGE_NODE_PATTERNS.some((p) => nodeType.includes(p.toLowerCase()))) {
      detectedKinds.push('image');
    }
  }

  if (detectedKinds.length === 0) {
    return 'code'; // Default
  }

  // Return highest-risk artifact kind
  return detectedKinds.reduce((highest, current) =>
    ARTIFACT_RISK_PRIORITY[current] > ARTIFACT_RISK_PRIORITY[highest] ? current : highest
  );
}

// ---------------------------------------------------------------------------
// GS-15.1: Telemetry collection
// ---------------------------------------------------------------------------

// Telemetry aggregators for batch metrics
const telemetryAggregators = {
  risk_tier_distribution: new Map<string, number>(),
  findings_by_severity: new Map<string, number>(),
  guard_lane_usage: new Map<ArtifactKind, number>(),
  interrupt_trigger_counts: 0,
};

/**
 * GS-15.1: Emit telemetry event to /api/v1/events.
 * Failures are non-fatal - telemetry should never break workflow execution.
 */
async function emitTelemetry(
  eventType: string,
  projectId: string,
  why: string,
  metrics: Record<string, unknown>
): Promise<void> {
  const event: TelemetryEvent = {
    event_type: eventType,
    timestamp: new Date().toISOString(),
    // WHO/WHEN/PROJECT/WHY metadata (Memory MCP protocol)
    who: 'guardspine-hooks:n8n',
    when: new Date().toISOString(),
    project: projectId,
    why,
    metrics,
  };

  try {
    await apiCall('POST', '/api/v1/events', event as unknown as Record<string, unknown>);
    log('debug', `Telemetry emitted: ${eventType}`, { project: projectId });
  } catch (err) {
    // GS-15.1: Telemetry failures are non-fatal
    log('warn', `Telemetry failed (non-fatal): ${serializeError(err)}`);
  }
}

/**
 * GS-15.1: Count findings by severity for telemetry.
 */
function countFindingsBySeverity(findings: Finding[]): Record<string, number> {
  const counts: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const f of findings) {
    const severity = f.severity?.toLowerCase() || 'info';
    if (severity in counts) {
      counts[severity]++;
    }
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Hook: n8n.ready
// ---------------------------------------------------------------------------

const readyHook = async (): Promise<void> => {
  log('info', '=== GuardSpine Hooks Loaded (Thin Client) ===');
  log('info', `Mode: ${CONFIG.mode}`);
  log('info', `API: ${CONFIG.apiUrl}`);
  log('info', `Risk threshold: ${CONFIG.riskThreshold}`);
  log('info', `Rubric pack: ${CONFIG.rubricPack}`);
  log('info', `Classification: ${CONFIG.classification}`);
  log('info', `Backend: ${CONFIG.backend}${CONFIG.model ? ` (model: ${CONFIG.model})` : ''}`);

  try {
    const res = await apiCall('GET', '/health');
    if (res.status === 200) {
      log('info', 'GuardSpine API is reachable');
    } else {
      log('warn', `GuardSpine API returned status ${res.status}`, res.data);
    }
  } catch (err) {
    log('error', `GuardSpine API unreachable: ${serializeError(err)}`);
  }

  log('info', '==============================================');
};

// ---------------------------------------------------------------------------
// Hook: workflow.preExecute
// ---------------------------------------------------------------------------

const preExecuteHook = async (
  workflowData: WorkflowData,
  executionMode?: string
): Promise<void> => {
  if (CONFIG.mode === 'off') return;

  // GS-15.1: Start timing for telemetry
  const startTime = Date.now();

  const wfName = workflowData?.name || 'unnamed';
  const wfId = workflowData?.id || 'unknown';
  log('info', `Pre-execute: "${wfName}" (id: ${wfId}, mode: ${executionMode || 'unknown'})`);

  try {
    const nodes = (workflowData?.nodes || []).map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      parameters: n.parameters || {},
    }));

    // GS-2.1: Extract node types for classification metadata
    const nodeTypes = [...new Set(nodes.map((n) => n.type))];
    const tags = workflowData?.tags || [];

    // GS-8.1: Detect artifact kind from node types
    const artifactKind = detectArtifactKind(nodes);
    if (artifactKind !== 'code') {
      log('info', `Detected artifact kind: ${artifactKind} (guard lane: ${artifactKind}Guard)`);
    }

    // Serialize workflow as content for policy evaluation
    const content = JSON.stringify({
      workflow_id: wfId,
      workflow_name: wfName,
      nodes,
      node_types: nodeTypes,
      tags,
      connections: workflowData?.connections || {},
      execution_mode: executionMode || 'manual',
    });

    // GS-2.1: Build evaluate request with optional forced classification
    // GS-8.1: Use detected artifact_kind instead of hardcoded 'code'
    const evalRequest: Record<string, unknown> = {
      artifact_id: wfId,
      artifact_kind: artifactKind,
      content,
      pack_ids: [CONFIG.rubricPack],
      metadata: {
        workflow_name: wfName,
        node_types: nodeTypes,
        tags,
        artifact_kind: artifactKind, // Include in metadata for backend routing
      },
    };

    // GS-2.1: If classification is not 'auto', force the escalation level
    if (CONFIG.classification !== 'auto') {
      evalRequest.forced_escalation = CONFIG.classification;
    }

    const res = await apiCall<EvaluationResult>('POST', '/api/v1/policies/evaluate', evalRequest);

    const result = res.data;
    const riskTier = tierFromEscalation(result.escalation_level);
    const thresholdTier = tierFromEscalation(CONFIG.riskThreshold);

    log(
      'info',
      `Guard evaluate: escalation=${result.escalation_level}, score=${result.total_score}, findings=${(result.findings || []).length}`
    );

    // GS-2.2: Log required approvers from response
    if (result.required_approvers && result.required_approvers.length > 0) {
      log('info', `Required approvers: ${result.required_approvers.join(', ')}`);
    }

    // Log findings by severity
    if (result.findings && result.findings.length > 0) {
      for (const f of result.findings) {
        const lvl: LogLevel =
          f.severity === 'critical' ? 'error' : f.severity === 'high' ? 'warn' : 'info';
        log(lvl, `[${f.source_trigger || f.finding_id}] ${f.title}`);
      }
    }

    // GS-4.1: Create bead for this execution
    let beadId: string | null = null;
    try {
      const beadRes = await apiCall<{ id?: string; bead_id?: string }>(
        'POST',
        '/api/v1/beads/tasks',
        {
          title: `[n8n] ${wfName}`,
          description: `Execution of workflow ${wfId}`,
          status: 'open',
          labels: ['guardspine', 'n8n', 'execution'],
          metadata: {
            workflow_id: wfId,
            workflow_name: wfName,
            execution_mode: executionMode || 'manual',
          },
        }
      );
      beadId = beadRes.data.id || beadRes.data.bead_id || null;
      log('debug', `Bead created: ${beadId}`);

      // If high risk, update bead status to blocked
      if (beadId && riskTier >= thresholdTier) {
        await apiCall('PUT', `/api/v1/beads/tasks/${beadId}`, {
          status: 'blocked',
          reason: `Blocked by GuardSpine: escalation=${result.escalation_level}`,
        });
        log('warn', `Bead ${beadId} set to blocked (${result.escalation_level})`);
      }
    } catch (beadErr) {
      log('warn', `Bead creation failed (non-fatal): ${serializeError(beadErr)}`);
    }

    // GS-15.1: Calculate evaluation duration
    const evaluationDurationMs = Date.now() - startTime;

    // Store context for postExecute
    executionContext.set(wfId, {
      artifact_id: result.artifact_id || wfId,
      escalation_level: result.escalation_level,
      risk_tier: riskTier,
      bead_id: beadId,
      findings: result.findings || [],
      artifact_kind: artifactKind,
      start_time: startTime,
      evaluation_duration_ms: evaluationDurationMs,
    });

    // GS-15.1: Update telemetry aggregators
    const tierKey = result.escalation_level || 'L0';
    telemetryAggregators.risk_tier_distribution.set(
      tierKey,
      (telemetryAggregators.risk_tier_distribution.get(tierKey) || 0) + 1
    );
    telemetryAggregators.guard_lane_usage.set(
      artifactKind,
      (telemetryAggregators.guard_lane_usage.get(artifactKind) || 0) + 1
    );

    // GS-15.1: Emit telemetry for preExecute
    await emitTelemetry('workflow.preExecute', wfId, 'evaluation', {
      evaluation_duration_ms: evaluationDurationMs,
      escalation_level: result.escalation_level,
      risk_tier: riskTier,
      artifact_kind: artifactKind,
      findings_count: (result.findings || []).length,
      findings_by_severity: countFindingsBySeverity(result.findings || []),
      bead_id: beadId,
      mode: CONFIG.mode,
    });

    // GS-2.2: Enforce mode - block if risk exceeds threshold
    if (CONFIG.mode === 'enforce' && riskTier >= thresholdTier) {
      const msg = `GuardSpine BLOCKED workflow "${wfName}" (escalation=${result.escalation_level}, threshold=${CONFIG.riskThreshold})`;
      log('error', msg);
      throw new Error(msg);
    }
  } catch (err) {
    // Re-throw blocking errors to stop workflow execution
    if (err instanceof Error && err.message.startsWith('GuardSpine BLOCKED')) {
      throw err;
    }
    log('error', `Pre-execute guard failed: ${serializeError(err)}`);
  }
};

// ---------------------------------------------------------------------------
// Hook: workflow.postExecute
// ---------------------------------------------------------------------------

const postExecuteHook = async (
  fullRunData: FullRunData | null,
  workflowData: WorkflowData | null
): Promise<void> => {
  if (CONFIG.mode === 'off') return;

  const wfName = workflowData?.name || 'unnamed';
  const wfId = workflowData?.id || 'unknown';
  const success = fullRunData && fullRunData.finished !== false;
  const status = success ? 'success' : 'error';

  log('info', `Post-execute: "${wfName}" (id: ${wfId}) status=${status}`);

  const ctx = executionContext.get(wfId) || {
    artifact_id: wfId,
    risk_tier: 0,
    bead_id: null,
    findings: [],
  };
  executionContext.delete(wfId);

  // GS-4.2: Update bead status based on execution result
  if (ctx.bead_id) {
    try {
      const beadStatus = success ? 'done' : 'failed';
      await apiCall('PUT', `/api/v1/beads/tasks/${ctx.bead_id}`, {
        status: beadStatus,
        execution_result: status,
      });
      log('debug', `Bead ${ctx.bead_id} updated to ${beadStatus}`);

      // Attach evidence to bead
      await apiCall('PUT', `/api/v1/beads/tasks/${ctx.bead_id}/evidence`, {
        evidence_type: 'execution_log',
        escalation_level: ctx.escalation_level || 'L0',
        findings_count: ctx.findings.length,
      });
    } catch (beadErr) {
      log('warn', `Bead update failed (non-fatal): ${serializeError(beadErr)}`);
    }
  }

  try {
    // Create evidence bundle for the execution
    const bundleRes = await apiCall<{ id?: string; bundle_id?: string }>(
      'POST',
      '/api/v1/bundles',
      {
        artifact_id: wfId,
        assertion_type: 'execution_completed',
        assertion_text: `Workflow ${wfName} executed with status ${status}`,
        signer: {
          signer_id: 'n8n-hooks',
          signer_type: 'system',
          display_name: 'n8n GuardSpine Hooks',
        },
        metadata: {
          escalation_level: ctx.escalation_level || 'L0',
          execution_status: status,
        },
      }
    );

    const bundle = bundleRes.data;
    log('debug', 'Evidence bundle created', { bundle_id: bundle.id || bundle.bundle_id });

    // Seal the bundle
    const sealStartTime = Date.now();
    await apiCall('POST', '/api/v1/evidence/seal', {
      bundle_id: bundle.id || bundle.bundle_id,
    });
    const bundleSealTimeMs = Date.now() - sealStartTime;

    log('debug', 'Evidence bundle sealed');

    // GS-15.1: Emit telemetry for postExecute
    const totalDurationMs = ctx.start_time ? Date.now() - ctx.start_time : 0;
    await emitTelemetry('workflow.postExecute', wfId, 'execution_completed', {
      execution_status: status,
      total_duration_ms: totalDurationMs,
      evaluation_duration_ms: ctx.evaluation_duration_ms || 0,
      bundle_seal_time_ms: bundleSealTimeMs,
      escalation_level: ctx.escalation_level || 'L0',
      bead_id: ctx.bead_id,
      findings_count: ctx.findings.length,
    });
  } catch (err) {
    log('error', `Post-execute evidence failed: ${serializeError(err)}`);
  }
};

// ---------------------------------------------------------------------------
// Hook: workflow.afterCreate / workflow.afterUpdate
// ---------------------------------------------------------------------------

const workflowSaveHook = async (workflowData: WorkflowData): Promise<void> => {
  if (CONFIG.mode === 'off') return;

  // GS-15.1: Start timing for telemetry
  const saveStartTime = Date.now();

  const wfId = workflowData?.id || 'unknown';
  const wfName = workflowData?.name || 'unnamed';

  try {
    // Create versioned artifact snapshot
    const versionRes = await apiCall<{
      version_id?: string;
      id?: string;
      previous_version_id?: string;
    }>('POST', `/api/v1/artifacts/${wfId}/versions`, {
      artifact_type: 'n8n_workflow',
      artifact_data: workflowData,
    });

    const version = versionRes.data;
    log('debug', `Artifact version created: ${version.version_id || version.id}`);

    // Compute diff against previous version
    const diffRes = await apiCall<{
      id?: string;
      changes_count?: number;
      changes?: unknown[];
    }>('POST', '/api/v1/diffs', {
      artifact_id: wfId,
      from_version_id: version.previous_version_id || null,
      to_version_id: version.version_id || version.id,
    });

    const diff = diffRes.data;
    log('info', `Workflow "${wfName}" diff: ${diff.changes_count || 0} change(s)`);

    // GS-8.1: Detect artifact kind from workflow nodes
    const nodes = (workflowData?.nodes || []).map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      parameters: n.parameters || {},
    }));
    const artifactKind = detectArtifactKind(nodes);

    // Evaluate risk on the diff
    const diffContent = JSON.stringify({
      workflow_id: wfId,
      workflow_name: wfName,
      diff_id: diff.id,
      changes: diff.changes || [],
    });

    // GS-8.1: Use detected artifact_kind in evaluation
    const evalRes = await apiCall<EvaluationResult>('POST', '/api/v1/policies/evaluate', {
      artifact_id: wfId,
      artifact_kind: artifactKind,
      content: diffContent,
      pack_ids: [CONFIG.rubricPack],
      metadata: {
        artifact_kind: artifactKind,
      },
    });

    const evalResult = evalRes.data;
    const evalTier = tierFromEscalation(evalResult.escalation_level);
    log(
      'info',
      `Save evaluation: escalation=${evalResult.escalation_level}, findings=${(evalResult.findings || []).length}`
    );

    // GS-5.1: If high risk, request approval gate with diff_data and findings
    if (evalTier >= 3) {
      log('warn', `High risk (${evalResult.escalation_level}) on save of "${wfName}" - requesting approval`);

      // GS-4.3: Get bead_id from execution context if available
      const ctx = executionContext.get(wfId);
      const beadId = ctx?.bead_id || null;

      // Build approval request
      const approvalRequest: Record<string, unknown> = {
        artifact_id: wfId,
        artifact_name: wfName,
        risk_tier: evalResult.escalation_level,
        required_approvers: evalResult.required_approvers || [],
        reason: `Workflow "${wfName}" save triggered ${evalResult.escalation_level}`,
        findings: (evalResult.findings || []).map((f) => ({
          finding_id: f.finding_id || f.id,
          title: f.title,
          description: f.description || f.title,
          severity: f.severity,
          source_trigger: f.source_trigger,
          enforcement: f.enforcement || 'warn',
        })),
        diff_data: {
          from_version_id: version.previous_version_id || 'initial',
          to_version_id: version.version_id || version.id,
          changes_count: diff.changes_count || (diff.changes || []).length,
          changes: diff.changes || [],
        },
      };

      // GS-4.3: Include bead_id so approval callback can update bead status
      if (beadId) {
        approvalRequest.bead_id = beadId;
        log('debug', `Including bead_id in approval request: ${beadId}`);
      }

      // GS-5.2: Include callback_url for webhook notification on decision
      if (CONFIG.callbackUrl) {
        approvalRequest.callback_url = CONFIG.callbackUrl;
        log('debug', `Including callback_url in approval request: ${CONFIG.callbackUrl}`);
      }

      const approvalRes = await apiCall<{ id?: string; approval_id?: string }>(
        'POST',
        '/api/v1/approvals',
        approvalRequest
      );

      const approvalId = approvalRes.data.id || approvalRes.data.approval_id;
      log('info', `Approval gate created: ${approvalId} (bead: ${beadId || 'none'}, callback: ${CONFIG.callbackUrl ? 'yes' : 'no'})`);

      // GS-4.3: Store approval_id in context for callback handling
      if (ctx && approvalId) {
        ctx.approval_id = approvalId;
      }
    }

    // Log findings
    if (evalResult.findings && evalResult.findings.length > 0) {
      for (const f of evalResult.findings) {
        const lvl: LogLevel =
          f.severity === 'critical' ? 'error' : f.severity === 'high' ? 'warn' : 'info';
        log(lvl, `[${f.source_trigger || f.finding_id}] ${f.title}`);
      }
    }

    // GS-15.1: Emit telemetry for workflow save
    const saveDurationMs = Date.now() - saveStartTime;
    await emitTelemetry('workflow.save', wfId, 'workflow_saved', {
      save_duration_ms: saveDurationMs,
      artifact_kind: artifactKind,
      escalation_level: evalResult.escalation_level,
      findings_count: (evalResult.findings || []).length,
      findings_by_severity: countFindingsBySeverity(evalResult.findings || []),
      changes_count: diff.changes_count || 0,
      approval_required: evalTier >= 3,
    });
  } catch (err) {
    log('error', `Workflow save hook failed: ${serializeError(err)}`);
  }
};

// ---------------------------------------------------------------------------
// Export hooks
// ---------------------------------------------------------------------------

export const n8n = {
  ready: [readyHook],
};

export const workflow = {
  preExecute: [preExecuteHook],
  postExecute: [postExecuteHook],
  afterCreate: [workflowSaveHook],
  afterUpdate: [workflowSaveHook],
};

// CommonJS compatibility
module.exports = { n8n, workflow, createConfig, resetConfig };
