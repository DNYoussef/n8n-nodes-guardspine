$bd = "C:\Users\17175\AppData\Local\beads\bd.exe"
Set-Location "D:\2026-AI-EXOSKELETON"

# Helper to update a bead description from a temp file
function Update-Bead($id, $desc) {
    $tmpFile = [System.IO.Path]::GetTempFileName()
    $desc | Out-File -FilePath $tmpFile -Encoding UTF8 -NoNewline
    & $bd update "life-os-dashboard-$id" --body-file $tmpFile
    Remove-Item $tmpFile
}

# === EPIC ===
Update-Bead "82zh" @"
PROJECT CONTEXT: GuardSpine is an AI accountability infrastructure (FastAPI backend at D:\Projects\GuardSpine with 138 endpoints, 17 routers). It evaluates code/document changes for risk using LLM-powered guard lanes. This epic integrates GuardSpine into n8n (workflow automation platform) via External Hooks - a thin JavaScript client at D:\Projects\n8n-nodes-guardspine\hooks\guardspine-hooks.js that intercepts n8n workflow events and calls the GuardSpine backend API.

SCOPE: Full 16-phase integration covering: (1) Hooks calling correct backend APIs, (2) L0-L4 risk classification, (3) LLM routing via OpenRouter/Ollama, (4) Beads work-item lifecycle, (5) Approval UI with diff postcards, (6) Nomotic interrupt system, (7) Tests, (8) Multi-artifact guard lanes (Code/PDF/Sheet/Image), (9) React approval inbox, (10) Board packet governance, (11) Connector framework for GitHub/SharePoint/Vanta/DocuSign, (12) Evidence bundles with crypto chain, (13) Nomotic rubric packs, (14) AI Council + 24 department automation, (15) Telemetry + Memory MCP + weekly review, (16) Dashboard + real-time monitoring.

KEY REPOS: Backend=D:\Projects\GuardSpine, n8n nodes=D:\Projects\n8n-nodes-guardspine, Frontend=D:\Projects\life-os-frontend, Memory MCP=D:\Projects\memory-mcp-triple-system.
"@

# === PHASE 1 ===
Update-Bead "njsd" @"
PROJECT CONTEXT: GuardSpine is a FastAPI backend (D:\Projects\GuardSpine) providing AI-powered artifact evaluation. n8n hooks (D:\Projects\n8n-nodes-guardspine\hooks\guardspine-hooks.js) act as a thin client calling the backend on every workflow execution.

PROBLEM: The hooks file currently calls the WRONG backend URL. It must call POST /api/v1/policies/evaluate (not /api/v1/guard/evaluate). The request body must be EvaluationRequest: {artifact_id: string, artifact_kind: 'code'|'pdf'|'xlsx'|'image', content: string, pack_ids: string[]}. The response is EvaluationResult: {artifact_id, pack_ids_evaluated, total_score, severity, escalation_level: 'L0'|'L1'|'L2'|'L3'|'L4', findings: [{rule_id, description, severity, location}], required_approvers: string[]}.

FILE TO EDIT: D:\Projects\n8n-nodes-guardspine\hooks\guardspine-hooks.js - update the preExecute and workflowSave functions to use correct URL and schema.

ACCEPTANCE CRITERIA: (1) preExecute calls POST /api/v1/policies/evaluate with EvaluationRequest shape. (2) Response parsed as EvaluationResult. (3) escalation_level used for blocking decisions. (4) findings array logged. (5) Tests pass in __tests__/guardspine-hooks.test.ts.

NOTE: This bead was partially addressed in a prior session but needs verification against the real backend at D:\Projects\GuardSpine\app\routers\policies.py.
"@

Update-Bead "ojpq" @"
PROJECT CONTEXT: GuardSpine n8n integration runs via Docker. The docker-compose.yml at D:\Projects\n8n-nodes-guardspine\docker-compose.yml defines the n8n service and a mock-api service.

TASK: Add environment variables to the n8n service in docker-compose.yml so the hooks can configure LLM routing. The GuardSpine backend (D:\Projects\GuardSpine\app\config.py) supports multiple LLM backends: auto, litellm, openrouter, ollama.

VARS TO ADD: OPENROUTER_API_KEY (for OpenRouter LLM calls, format sk-or-...), GUARDSPINE_BACKEND (auto|litellm|openrouter|ollama, default auto), GUARDSPINE_MODEL (model name like anthropic/claude-sonnet-4.5), OLLAMA_BASE_URL (default http://host.docker.internal:11434). Also add these to the mock-api service for passthrough.

FILE TO EDIT: D:\Projects\n8n-nodes-guardspine\docker-compose.yml

ACCEPTANCE CRITERIA: (1) All 4 env vars added to n8n service environment section. (2) Same vars added to mock-api service. (3) docker-compose config validates without errors. (4) Existing GUARDSPINE_API_URL and GUARDSPINE_MODE vars preserved.
"@

Update-Bead "ajk6" @"
PROJECT CONTEXT: GuardSpine has a real FastAPI backend (D:\Projects\GuardSpine) and a mock API server (D:\Projects\n8n-nodes-guardspine\mock-api\server.js) used for local development without the full backend. The mock must return responses matching the real backend's Pydantic schemas.

PROBLEM: The current mock-api/server.js returns fabricated response shapes that don't match the real backend. The real backend schemas are defined in D:\Projects\GuardSpine\app\schemas\policy_schemas.py (EvaluationRequest, EvaluationResult) and D:\Projects\GuardSpine\app\schemas\approval_schemas.py.

TASK: Rewrite mock-api/server.js to: (1) Serve POST /api/v1/policies/evaluate returning EvaluationResult shape: {artifact_id, pack_ids_evaluated:[], total_score:float, severity:string, escalation_level:'L0'-'L4', findings:[{rule_id,description,severity,location}], required_approvers:[]}. (2) POST /api/v1/approvals matching backend approvals router. (3) POST /api/v1/bundles matching evidence bundle schema. (4) Remove old /api/v1/guard/evaluate endpoint. (5) Do basic keyword analysis on content to return non-trivial risk scores (e.g. detect 'eval', 'exec', 'password' -> higher risk).

FILES: Edit D:\Projects\n8n-nodes-guardspine\mock-api\server.js. Reference D:\Projects\GuardSpine\app\schemas\policy_schemas.py for exact field names.

ACCEPTANCE CRITERIA: Mock responses pass JSON schema validation against real backend Pydantic models. All hooks tests pass with mock responses.
"@

Update-Bead "64sr" @"
PROJECT CONTEXT: After n8n finishes executing a workflow, the postExecute hook in D:\Projects\n8n-nodes-guardspine\hooks\guardspine-hooks.js creates an evidence bundle documenting what happened. Evidence bundles are the audit trail for GuardSpine governance.

TASK: Update the postExecute hook to create evidence bundles matching the real backend's /bundles router schema (D:\Projects\GuardSpine\app\routers\bundles.py). The bundle must include: signer metadata (who created it), assertion_type (execution_result|approval_decision|policy_evaluation), artifact_id (workflow ID). After creating the bundle via POST /api/v1/bundles, seal it via POST /api/v1/evidence/seal with bundle_id.

DEPENDS ON: GS-1.1 (correct API URLs must be in place first).

FILE TO EDIT: D:\Projects\n8n-nodes-guardspine\hooks\guardspine-hooks.js - the postExecute function.

ACCEPTANCE CRITERIA: (1) postExecute creates bundle with correct schema. (2) Bundle sealed via /evidence/seal. (3) Seal response includes hash for audit chain. (4) Null/failed executions handled gracefully. (5) Tests pass.
"@

# === PHASE 2 ===
Update-Bead "0pn6" @"
PROJECT CONTEXT: GuardSpine classifies every artifact evaluation into risk tiers L0 (no risk) through L4 (critical risk). The backend classifier at D:\Projects\GuardSpine\app\services\classifier.py uses fnmatch path patterns and content analysis to determine the tier. The n8n hooks need to pass enough workflow metadata for the backend to classify correctly.

TASK: (1) Send workflow metadata (name, node types, tags) in the evaluate request so backend can classify. (2) Add GUARDSPINE_CLASSIFICATION env var to hooks CONFIG supporting values: auto (let backend decide), L0, L1, L2, L3, L4 (force override). (3) Parse escalation_level from EvaluationResult response. The hooks already have a tierFromEscalation() helper that converts L0-L4 strings to numbers 0-4.

DEPENDS ON: GS-1.1 (correct API integration).

FILE TO EDIT: D:\Projects\n8n-nodes-guardspine\hooks\guardspine-hooks.js - CONFIG section and evaluate request construction.

ACCEPTANCE CRITERIA: (1) Workflow metadata included in evaluate request. (2) GUARDSPINE_CLASSIFICATION env var respected. (3) escalation_level parsed from response. (4) tierFromEscalation() correctly maps L0->0, L1->1, etc.
"@

Update-Bead "mk2c" @"
PROJECT CONTEXT: GuardSpine hooks can run in two modes: 'audit' (log only, never block) and 'enforce' (block workflow execution if risk too high). The blocking decision compares the escalation_level from the backend response against a threshold.

TASK: Update the enforce logic in hooks to compare escalation_level (L0-L4) from the EvaluationResult against GUARDSPINE_RISK_THRESHOLD env var (default 'L3'). Use the existing tierFromEscalation() helper to convert both to numbers for comparison. If evaluation tier >= threshold tier AND mode is 'enforce', throw an error to block workflow execution. Log the escalation_level and required_approvers from response regardless of mode.

DEPENDS ON: GS-2.1 (classification must be working first).

FILE TO EDIT: D:\Projects\n8n-nodes-guardspine\hooks\guardspine-hooks.js - the blocking logic in preExecute.

ACCEPTANCE CRITERIA: (1) Enforce mode blocks when escalation_level >= threshold. (2) Audit mode never blocks. (3) Required approvers logged. (4) GUARDSPINE_RISK_THRESHOLD defaults to L3 if not set.
"@

# === PHASE 3 ===
Update-Bead "64pl" @"
PROJECT CONTEXT: GuardSpine backend supports multiple LLM backends for artifact evaluation: OpenRouter (cloud, multi-model), Ollama (local), LiteLLM (unified). The backend config at D:\Projects\GuardSpine\app\config.py reads BACKEND and MODEL settings. The hooks need to pass these settings to the backend.

TASK: (1) Add GUARDSPINE_BACKEND (auto|litellm|openrouter|ollama) and GUARDSPINE_MODEL env vars to hooks CONFIG object. (2) Pass these as headers (X-GuardSpine-Backend, X-GuardSpine-Model) or query params in evaluate requests so backend routes to correct LLM adapter. (3) The backend adapters already exist at D:\Projects\GuardSpine\app\adapters\openrouter_adapter.py, ollama_adapter.py, litellm_adapter.py.

DEPENDS ON: GS-1.1 (correct API integration).

FILE TO EDIT: D:\Projects\n8n-nodes-guardspine\hooks\guardspine-hooks.js - CONFIG section and HTTP request construction.

ACCEPTANCE CRITERIA: (1) GUARDSPINE_BACKEND and GUARDSPINE_MODEL read from env. (2) Values passed to backend in requests. (3) Default GUARDSPINE_BACKEND=auto. (4) Works with all 3 adapters.
"@

Update-Bead "epx0" @"
PROJECT CONTEXT: OpenRouter is a cloud LLM routing service that GuardSpine uses for AI-powered artifact evaluation. The backend adapter is at D:\Projects\GuardSpine\app\adapters\openrouter_adapter.py.

TASK: Verify end-to-end: hooks -> backend -> OpenRouter API -> response. Test with models: anthropic/claude-sonnet-4.5, openai/gpt-4o, openrouter/auto. Verify the backend pipeline at D:\Projects\GuardSpine\app\services\pipeline.py supports L1 (single model), L2 (2 models peer review), L3 (3+ models adversarial) audit levels with OpenRouter. Document the required env var OPENROUTER_API_KEY (format: sk-or-...).

DEPENDS ON: GS-3.1 (LLM routing config in hooks).

ACCEPTANCE CRITERIA: (1) Hooks send request, backend calls OpenRouter, findings returned. (2) L1/L2/L3 pipeline levels work. (3) Error handling for invalid/missing API key. (4) Test results documented.
"@

# === PHASE 4 ===
Update-Bead "ct10" @"
PROJECT CONTEXT: Beads is a git-backed work item system (CLI at C:\Users\17175\AppData\Local\beads\bd.exe). In GuardSpine, each workflow execution creates a bead to track its governance lifecycle. The beads API lives at D:\Projects\GuardSpine\app\routers\beads.py.

TASK: In the preExecute hook, create a bead via POST /api/v1/beads/tasks with: status=open, title=workflow name, labels=[guardspine, n8n, execution]. Store the returned bead_id in the executionContext Map (keyed by execution ID) so postExecute can retrieve it. If evaluation returns escalation_level >= L3, update bead status to 'blocked' via PUT /api/v1/beads/tasks/{id}.

DEPENDS ON: GS-1.1 (correct API URLs).

FILE TO EDIT: D:\Projects\n8n-nodes-guardspine\hooks\guardspine-hooks.js - preExecute function, after evaluate call.

ACCEPTANCE CRITERIA: (1) Bead created on preExecute. (2) bead_id stored in executionContext. (3) High-risk evaluations set bead to blocked. (4) API errors don't break workflow execution.
"@

Update-Bead "an9y" @"
PROJECT CONTEXT: Each n8n workflow execution has a bead tracking its governance lifecycle. The preExecute hook creates the bead (GS-4.1), and the postExecute hook must close it.

TASK: In postExecute, retrieve bead_id from executionContext Map using execution ID. Update bead status to 'completed' (if execution succeeded) or 'failed' (if execution had errors). Attach the evidence bundle to the bead via PUT /api/v1/beads/tasks/{id}/evidence with evidence_hash and evidence_type=execution_result. Clean up executionContext entry after.

DEPENDS ON: GS-4.1 (bead creation in preExecute).

FILE TO EDIT: D:\Projects\n8n-nodes-guardspine\hooks\guardspine-hooks.js - postExecute function.

ACCEPTANCE CRITERIA: (1) Bead status updated based on execution result. (2) Evidence bundle attached. (3) executionContext cleaned up. (4) Missing bead_id handled gracefully.
"@

Update-Bead "v3uz" @"
PROJECT CONTEXT: When a GuardSpine evaluation requires human approval (L3+ risk), the workflow is blocked until an approver decides. The approval decision must update the associated bead's status.

TASK: When an approval callback fires (from the approval webhook - GS-5.2), update the associated bead: approved -> change bead from 'blocked' to 'in_progress'; rejected -> change bead to 'rejected'. The approval webhook payload must include bead_id so the callback handler knows which bead to update.

DEPENDS ON: GS-4.1 (bead creation), GS-5.1 (approval flow).

FILE TO EDIT: D:\Projects\n8n-nodes-guardspine\hooks\guardspine-hooks.js - approval callback handling.

ACCEPTANCE CRITERIA: (1) Approved decision sets bead to in_progress. (2) Rejected decision sets bead to rejected. (3) bead_id included in approval request payload. (4) Missing bead handled gracefully.
"@

Update-Bead "ot3h" @"
PROJECT CONTEXT: Nomotic interrupts are rule-triggered governance events (e.g., 'external_link_added', 'liability_clause_altered') that can block work items. When an interrupt fires, the associated bead should be blocked with details about what triggered it.

TASK: When the evaluate response includes interrupts_triggered (from nomotic.yaml rules), create bead blockers: mandatory_review(72h) -> create approval + block bead. escalation(24h) -> create notification + block bead. block(auto) -> immediately block bead. Store interrupt details (type, message, resolution rules) in bead description/comments.

DEPENDS ON: GS-4.1 (bead creation), GS-6.1 (nomotic interrupt evaluation in backend).

FILE TO EDIT: D:\Projects\n8n-nodes-guardspine\hooks\guardspine-hooks.js

ACCEPTANCE CRITERIA: (1) Each interrupt type creates correct bead blocker. (2) Interrupt details stored in bead. (3) Timeout values respected. (4) Multiple simultaneous interrupts handled.
"@

# === PHASE 5 ===
Update-Bead "01dg" @"
PROJECT CONTEXT: When a user saves/modifies an n8n workflow, GuardSpine evaluates the diff between old and new versions. If risk is high enough, an approval request is created requiring human sign-off before the change takes effect.

TASK: Update the workflowSaveHook (afterCreate/afterUpdate) to: (1) Call POST /api/v1/policies/evaluate with the workflow diff. (2) If escalation_level >= L3, create approval via POST /api/v1/approvals with: artifact_id (workflow ID), risk_tier, required_approvers (from evaluate response), reason (summary of findings). (3) Include diff data and nomotic findings in approval request for the diff postcard UI (GS-9.2).

DEPENDS ON: GS-1.1 (correct API URLs), GS-1.3 (mock API matching real schemas).

FILE TO EDIT: D:\Projects\n8n-nodes-guardspine\hooks\guardspine-hooks.js - afterCreate and afterUpdate hooks.

ACCEPTANCE CRITERIA: (1) Workflow save triggers evaluation. (2) High-risk saves create approval. (3) Approval includes diff data and findings. (4) Low-risk saves proceed without approval.
"@

Update-Bead "561c" @"
PROJECT CONTEXT: When an approval is created (GS-5.1), n8n needs to know when a human makes a decision. This is done via webhook callbacks - the approval request includes a callback URL that the backend calls when approved/rejected.

TASK: (1) When creating approval, include callback_url pointing to an n8n webhook endpoint. (2) The backend /approvals/{id}/decisions endpoint fires webhook to callback_url when decided. (3) The ApprovalWait n8n node (D:\Projects\n8n-nodes-guardspine\nodes\ApprovalWait\ApprovalWait.node.ts) should use webhook mode for real-time response. (4) The mock API already has a fireCallback() helper. (5) Backend approvals router supports pr_url and author_slack_id for notifications.

DEPENDS ON: GS-5.1 (approval creation flow).

FILES: D:\Projects\n8n-nodes-guardspine\hooks\guardspine-hooks.js (callback URL in approval request), D:\Projects\n8n-nodes-guardspine\nodes\ApprovalWait\ApprovalWait.node.ts (webhook receiver).

ACCEPTANCE CRITERIA: (1) Approval request includes callback_url. (2) Backend fires webhook on decision. (3) ApprovalWait node receives callback. (4) Callback payload includes approval_id, decision, decided_at.
"@

Update-Bead "gm0d" @"
PROJECT CONTEXT: The 'diff postcard' is the visual representation of changes that approvers review. The current implementation at D:\Projects\GuardSpine\visual\postcard.py is 44 lines of PIL rendering text on a white rectangle - far below the design in the PDF deck (page 6) which shows a polished card with color-coded diffs, risk badges, and approve/reject buttons.

TASK: Either (A) enhance postcard.py with proper visual diff rendering (color-coded additions/deletions, risk tier badge, findings summary), or (B) build an HTML template served by the backend as an approval UI page. Must include: original vs proposed diff (red/green highlighting), AI suggestion panel with risk analysis, risk tier badge (L0-L4 color coded), approve/reject action buttons.

DEPENDS ON: GS-5.1 (approval flow creating diff data).

FILES: D:\Projects\GuardSpine\visual\postcard.py (current), or create new HTML template in D:\Projects\GuardSpine\templates\.

ACCEPTANCE CRITERIA: (1) Diff postcard shows meaningful visual diff. (2) Risk tier clearly visible. (3) Findings summarized. (4) Approve/reject actions present. (5) Replaces 44-line PIL placeholder.
"@

# === PHASE 6 ===
Update-Bead "75gl" @"
PROJECT CONTEXT: Nomotic is a governance philosophy that defines 'interrupts' - rule-triggered events when specific patterns are detected in artifacts. The interrupt triggers are defined in nomotic.yaml. The GuardSpine backend must evaluate these on every /policies/evaluate call.

TASK: Implement interrupt evaluation in the backend. Trigger patterns from nomotic.yaml: external_link_added, signature_changed, financial_formula_changed, liability_clause_altered, pii_field_added, auth_code_modified, api_key_pattern. The evaluate response must include an interrupts_triggered array with: type (mandatory_review|escalation|block), message, resolution rules (timeout_hours, auto_resolve).

DEPENDS ON: GS-1.1 (API integration working).

FILES: D:\Projects\GuardSpine\app\services\pipeline.py (evaluation pipeline), D:\Projects\GuardSpine\rubrics\nomotic.yaml (interrupt definitions - create if missing).

ACCEPTANCE CRITERIA: (1) Each trigger pattern detected in content. (2) interrupts_triggered included in EvaluationResult. (3) Correct interrupt types assigned. (4) Resolution rules included. (5) No false positives on clean content.
"@

Update-Bead "dqg4" @"
PROJECT CONTEXT: When the GuardSpine backend returns nomotic interrupts in the evaluate response, the n8n hooks must handle them appropriately based on type and enforcement mode.

TASK: Update hooks to parse interrupts_triggered from EvaluationResult. For each interrupt: (1) Log with severity-appropriate level. (2) block type in enforce mode -> throw to stop execution. (3) mandatory_review -> create approval with 72h timeout. (4) escalation -> fire notification via backend /slack or email. (5) In audit mode, log all but never block.

DEPENDS ON: GS-6.1 (backend interrupt evaluation).

FILE TO EDIT: D:\Projects\n8n-nodes-guardspine\hooks\guardspine-hooks.js - add interrupt handling after evaluate response parsing.

ACCEPTANCE CRITERIA: (1) All 3 interrupt types handled correctly. (2) Enforce mode blocks on 'block' type. (3) Audit mode logs only. (4) Mandatory review creates approval. (5) No interrupts -> normal flow continues.
"@

# === PHASE 7 ===
Update-Bead "nez8" @"
PROJECT CONTEXT: The hooks tests at D:\Projects\n8n-nodes-guardspine\__tests__\guardspine-hooks.test.ts need HTTP mocking to test API calls without a running server. Currently tests mock http.request via jest.mock.

TASK: Add 'nock' npm package to devDependencies for cleaner HTTP mocking. Create a test helper that sets up nock interceptors for all GuardSpine API endpoints: /api/v1/policies/evaluate, /api/v1/approvals, /api/v1/bundles, /api/v1/evidence/seal, /api/v1/beads/tasks. Tests should not require mock-api server running.

FILE TO EDIT: D:\Projects\n8n-nodes-guardspine\package.json (add nock), create D:\Projects\n8n-nodes-guardspine\__tests__\helpers\nock-setup.ts.

ACCEPTANCE CRITERIA: (1) nock in devDependencies. (2) Helper provides mock setup for all endpoints. (3) Existing tests still pass. (4) No external server needed for tests.
"@

Update-Bead "2aq1" @"
PROJECT CONTEXT: The preExecute hook evaluates workflow content before execution. Tests must verify correct behavior for various scenarios.

TASK: Write tests for preExecute using nock mocks: (1) Clean workflow returns L0 -> no block in any mode. (2) Dangerous workflow returns L4 -> blocks in enforce mode, logs in audit mode. (3) API timeout -> logs error, doesn't block in audit mode. (4) Verify correct URL /api/v1/policies/evaluate called. (5) Verify EvaluationRequest schema (artifact_id, artifact_kind, content, pack_ids) sent correctly.

DEPENDS ON: GS-7.1 (nock setup).

FILE TO EDIT: D:\Projects\n8n-nodes-guardspine\__tests__\guardspine-hooks.test.ts

ACCEPTANCE CRITERIA: All 5 scenarios pass. Nock verifies exact request shapes. No real HTTP calls made.
"@

Update-Bead "9ig8" @"
PROJECT CONTEXT: The postExecute hook creates evidence bundles after workflow execution completes.

TASK: Write tests: (1) Successful execution creates evidence bundle via POST /api/v1/bundles. (2) Failed execution creates bundle with error status. (3) Null workflowData handled without crash. (4) Bundle sealed via POST /api/v1/evidence/seal. (5) executionContext Map cleaned up after post.

DEPENDS ON: GS-7.1 (nock setup).

FILE TO EDIT: D:\Projects\n8n-nodes-guardspine\__tests__\guardspine-hooks.test.ts

ACCEPTANCE CRITERIA: All 5 scenarios pass with nock mocks. No side effects between tests.
"@

Update-Bead "9cns" @"
PROJECT CONTEXT: Beads track the full governance lifecycle of each workflow execution: open -> blocked (if high risk) -> in_progress (if approved) -> completed/failed.

TASK: Test the full bead lifecycle: (1) preExecute creates bead with open status via POST /api/v1/beads/tasks. (2) High risk evaluation updates bead to blocked. (3) Approval callback updates to in_progress. (4) postExecute completes bead. (5) Evidence attached to bead. All via nock mocks for beads API endpoints.

DEPENDS ON: GS-7.1 (nock), GS-4.2 (bead lifecycle implemented).

FILE TO EDIT: D:\Projects\n8n-nodes-guardspine\__tests__\guardspine-hooks.test.ts

ACCEPTANCE CRITERIA: Full lifecycle tested end-to-end. All state transitions verified.
"@

Update-Bead "8okn" @"
PROJECT CONTEXT: Nomotic interrupts are governance events triggered by specific content patterns (e.g., external links added, financial formulas changed).

TASK: Test interrupt handling: (1) 'block' interrupt throws in enforce mode. (2) 'mandatory_review' creates approval with 72h timeout. (3) 'escalation' fires notification. (4) No interrupts -> normal flow. Mock evaluate response with interrupts_triggered array.

DEPENDS ON: GS-7.1 (nock), GS-6.2 (interrupt handling implemented in hooks).

FILE TO EDIT: D:\Projects\n8n-nodes-guardspine\__tests__\guardspine-hooks.test.ts

ACCEPTANCE CRITERIA: All 4 scenarios tested. Correct behavior per interrupt type per enforcement mode.
"@

Update-Bead "j3di" @"
PROJECT CONTEXT: Approval webhooks allow n8n to be notified when a human approves/rejects a high-risk change.

TASK: Test approval flow: (1) High risk workflow save creates approval via POST /api/v1/approvals. (2) Approval decision fires webhook callback to n8n. (3) Webhook payload includes approval_id, decision, decided_at. (4) Bead status updated on callback (blocked -> in_progress on approve, blocked -> rejected on reject).

DEPENDS ON: GS-7.1 (nock), GS-5.2 (approval webhook implemented).

FILE TO EDIT: D:\Projects\n8n-nodes-guardspine\__tests__\guardspine-hooks.test.ts

ACCEPTANCE CRITERIA: Approval creation and callback tested. Bead state transitions verified.
"@

# === RISKS ===
Update-Bead "lthw" @"
PROJECT CONTEXT: GuardSpine hooks call a backend API on every n8n workflow execution. If the backend is down, all API calls fail.

RISK: HIGH likelihood, HIGH impact. When GuardSpine backend is unreachable, hooks API calls fail silently.

EXISTING MITIGATION: Hooks catch all errors and log. Audit mode never blocks. Enforce mode only blocks on SUCCESSFUL evaluation with high risk. Connection errors logged as warnings.

VALIDATION TASK: (1) Stop the GuardSpine backend (docker stop guardspine). (2) Run an n8n workflow. (3) Verify workflow executes normally. (4) Verify warning logged about unreachable backend. (5) Verify no data loss or crash.

ACCEPTANCE CRITERIA: Workflows execute normally when backend is down. Warnings logged. No silent failures.
"@

Update-Bead "vgqv" @"
PROJECT CONTEXT: GuardSpine uses OpenRouter (cloud LLM service) for AI-powered artifact evaluation. The API key is set via OPENROUTER_API_KEY env var.

RISK: MEDIUM likelihood, MEDIUM impact. Missing or invalid API key means LLM evaluation returns errors.

EXISTING MITIGATION: Backend config.py falls back to ollama if openrouter fails. If both fail, evaluation returns error findings but doesn't crash. Hooks treat API errors as non-blocking in audit mode.

VALIDATION TASK: (1) Set OPENROUTER_API_KEY to invalid value. (2) Run evaluation. (3) Verify graceful fallback. (4) Verify error logged but workflow not blocked in audit mode.

ACCEPTANCE CRITERIA: Invalid/missing API key doesn't crash system. Fallback to alternative LLM or error findings returned.
"@

Update-Bead "5rqy" @"
PROJECT CONTEXT: The ApprovalWait n8n node blocks a workflow until a human approves or rejects. If nobody responds, the workflow hangs forever.

RISK: HIGH likelihood, HIGH impact. Approval never comes, workflow blocked indefinitely.

EXISTING MITIGATION: Backend escalation/workflow.py has timeout_hours (default 24h) with auto-expire.

VALIDATION TASK: (1) Create an approval request. (2) Don't respond. (3) Wait for timeout. (4) Verify approval auto-rejects after timeout. (5) Verify workflow continues after timeout. (6) Wire n8n ApprovalWait node timeout to match backend timeout.

ACCEPTANCE CRITERIA: Approvals auto-expire. Workflows resume after timeout. No infinite hangs.
"@

Update-Bead "4ajp" @"
PROJECT CONTEXT: The mock API server (D:\Projects\n8n-nodes-guardspine\mock-api\server.js) is used for local development. If its response shapes diverge from the real backend, integration tests pass but production fails.

RISK: HIGH likelihood, HIGH impact. Schema drift between mock and real backend.

MITIGATION: (1) GS-1.3 rewrites mock to match real schemas. (2) Generate mock responses from actual backend Pydantic models (D:\Projects\GuardSpine\app\schemas\policy_schemas.py). (3) Add schema validation in tests comparing mock responses to expected shapes.

VALIDATION TASK: Run hooks against real backend and compare behavior with mock. Document any differences.

ACCEPTANCE CRITERIA: Mock responses validated against real backend schemas. Schema drift detected in CI.
"@

Update-Bead "697l" @"
PROJECT CONTEXT: The n8n-nodes-guardspine package contains 7 custom n8n nodes (GuardGate, CodeGuard, CouncilVote, BeadsCreate, BeadsUpdate, EvidenceSeal, ApprovalWait). However, the hooks handle most functionality invisibly.

RISK: MEDIUM likelihood, LOW impact. 5 of 7 nodes are redundant since hooks cover their functionality.

DECISION: Keep ApprovalWait (manual approval workflows need explicit control). Keep GuardGate (manual per-node evaluation). Deprecate CodeGuard, CouncilVote, BeadsCreate, BeadsUpdate, EvidenceSeal. Mark as deprecated in package.json but don't remove yet.

VALIDATION TASK: (1) Verify hooks cover all use cases handled by the 5 deprecated nodes. (2) Mark deprecated in node descriptions. (3) Document migration path for users of deprecated nodes.

ACCEPTANCE CRITERIA: 5 nodes marked deprecated. 2 nodes retained. Hooks verified as complete replacement.
"@

# === PHASE 8 ===
Update-Bead "18lu" @"
PROJECT CONTEXT: GuardSpine has 4 guard lanes: CodeGuard (code diffs, PRs), PDFGuard (clause changes, reflows), SheetGuard (formula changes, ranges), ImageGuard (pixel diffs, UI anomalies). Each lives in D:\Projects\GuardSpine\codeguard\guards\{name}guard\. Currently hooks hardcode artifact_kind='code' for all evaluations.

TASK: Add artifact_kind auto-detection in preExecute based on n8n workflow node types. If workflow contains PDF-processing nodes (e.g., ReadPDF, PDFMerge) -> artifact_kind='pdf'. Spreadsheet nodes (Spreadsheet, GoogleSheets, Excel) -> artifact_kind='xlsx'. Image nodes (ImageResize, Screenshot) -> artifact_kind='image'. Default -> artifact_kind='code'. Pass correct artifact_kind in EvaluationRequest to backend.

DEPENDS ON: GS-1.1 (correct API).

FILE TO EDIT: D:\Projects\n8n-nodes-guardspine\hooks\guardspine-hooks.js - add detectArtifactKind(workflowData) function, call in preExecute.

ACCEPTANCE CRITERIA: (1) Node type detection works for PDF, spreadsheet, image nodes. (2) Correct artifact_kind sent in request. (3) Unknown nodes default to 'code'. (4) Multiple artifact types in one workflow -> use highest-risk lane.
"@

Update-Bead "xkpt" @"
PROJECT CONTEXT: PDFGuard (D:\Projects\GuardSpine\codeguard\guards\pdfguard\) detects clause changes, reflows, and liability alterations in PDF documents. The PDF pitch deck (page 5, Sarah's Tuesday) shows PDFGuard detecting a liability clause change in a 47-page doc and triggering a General Counsel Interrupt.

TASK: Wire PDFGuard into the n8n evaluation pipeline. (1) Hooks detect PDF-processing workflows and tag artifact_kind='pdf'. (2) Backend routes to PDFGuard based on artifact_kind. (3) PDFGuard returns findings with severity levels. (4) High-severity findings (e.g., liability_clause_altered) trigger nomotic interrupts. (5) Verify end-to-end with a test PDF document.

DEPENDS ON: GS-8.1 (multi-artifact routing).

FILES: D:\Projects\n8n-nodes-guardspine\hooks\guardspine-hooks.js (detection), D:\Projects\GuardSpine\codeguard\guards\pdfguard\ (backend guard).

ACCEPTANCE CRITERIA: PDF workflow -> artifact_kind=pdf -> PDFGuard evaluation -> findings returned -> interrupts fire for high-severity.
"@

Update-Bead "dijd" @"
PROJECT CONTEXT: SheetGuard (D:\Projects\GuardSpine\codeguard\guards\sheetguard\) detects formula changes, range modifications, VLOOKUP replacements in spreadsheets. The PDF deck (page 5) shows SheetGuard detecting 14 formula changes triggering Finance Authority Rule.

TASK: Wire SheetGuard into n8n evaluation pipeline. (1) Hooks detect spreadsheet workflows (GoogleSheets, Excel, Spreadsheet nodes) and tag artifact_kind='xlsx'. (2) Backend routes to SheetGuard. (3) SheetGuard returns findings about formula/range changes. (4) High-severity findings trigger nomotic interrupts (e.g., financial_formula_changed).

DEPENDS ON: GS-8.1 (multi-artifact routing).

FILES: D:\Projects\n8n-nodes-guardspine\hooks\guardspine-hooks.js, D:\Projects\GuardSpine\codeguard\guards\sheetguard\.

ACCEPTANCE CRITERIA: Spreadsheet workflow -> artifact_kind=xlsx -> SheetGuard evaluation -> formula change findings -> interrupts for financial patterns.
"@

Update-Bead "7vvq" @"
PROJECT CONTEXT: ImageGuard (D:\Projects\GuardSpine\codeguard\guards\imageguard\) detects pixel diffs, UI anomalies, and added API links in slide decks/images. The PDF deck (page 5) shows ImageGuard detecting an added API link on Slide 12 triggering External Data interrupt.

TASK: Wire ImageGuard into n8n evaluation pipeline. (1) Hooks detect image/presentation workflows and tag artifact_kind='image'. (2) Backend routes to ImageGuard. (3) ImageGuard returns findings about visual changes. (4) Added external links trigger 'external_link_added' nomotic interrupt.

DEPENDS ON: GS-8.1 (multi-artifact routing).

FILES: D:\Projects\n8n-nodes-guardspine\hooks\guardspine-hooks.js, D:\Projects\GuardSpine\codeguard\guards\imageguard\.

ACCEPTANCE CRITERIA: Image/presentation workflow -> artifact_kind=image -> ImageGuard evaluation -> findings returned -> external link interrupt fires.
"@

# === PHASE 9 ===
Update-Bead "yva7" @"
PROJECT CONTEXT: GuardSpine's PDF deck (page 6) shows a '10-Second Decision' Approval Inbox - the critical frontend UI where approvers review pending governance decisions. Without this UI, there is no way for humans to approve/reject flagged changes. This is THE most important frontend gap.

TASK: Build a React page (can be in D:\Projects\life-os-frontend or standalone) that: (1) Lists pending approvals from GET /api/v1/approvals?status=pending. (2) Each card shows: artifact name, risk tier badge (L0=green, L1=blue, L2=yellow, L3=orange, L4=red), timestamp, required approvers list. (3) Clicking a card opens the Diff Postcard view (GS-9.2). (4) Auto-refreshes every 30s or via WebSocket.

BACKEND API: GET /api/v1/approvals?status=pending returns [{id, artifact_id, risk_tier, required_approvers, created_at, reason, diff_data, findings}].

ACCEPTANCE CRITERIA: (1) Page renders list of pending approvals. (2) Risk tier color-coded badges. (3) Click navigates to detail view. (4) Empty state shown when no pending approvals. (5) Responsive design.
"@

Update-Bead "m38p" @"
PROJECT CONTEXT: The Diff Postcard is the detailed view an approver sees when reviewing a flagged change. The PDF deck (page 6) shows exact UI spec with side-by-side diffs, AI suggestion, and action buttons.

TASK: Build React component rendering: (1) AI Suggestion panel at top with risk analysis summary generated from findings. (2) Side-by-side diff showing Original vX.Y vs Proposed vX.Z with red (deletions) / green (additions) highlighting. (3) Risk Analysis badge showing escalation level (L0-L4 color coded). (4) Session metadata footer: GuardSpine version, diff count, session ID. (5) Approve (green) and Reject (red) buttons (wired in GS-9.4).

REPLACES: The skeletal PIL-based postcard.py (44 lines) at D:\Projects\GuardSpine\visual\postcard.py.

DATA SOURCE: Approval detail from GET /api/v1/approvals/{id} which includes diff_data and findings.

ACCEPTANCE CRITERIA: (1) Side-by-side diff renders correctly. (2) AI suggestion panel displays findings summary. (3) Risk badge matches escalation_level. (4) Metadata footer present. (5) Responsive.
"@

Update-Bead "wd2i" @"
PROJECT CONTEXT: When an approver reviews a diff postcard, they need AI-generated context about WHY the change is risky. The PDF deck (page 6) shows text like 'Cash flow impact. Payment term changed from 30 to 45 days. Matches external vendor request pattern.'

TASK: Build AI Suggestion panel component that: (1) Takes EvaluationResult.findings as input. (2) Calls backend LLM endpoint to generate natural language risk summary. (3) Displays as a card above the diff postcard. (4) Shows key risk factors in bullet points. (5) Highlights financial/legal/security implications.

DEPENDS ON: GS-9.2 (embedded in diff postcard view).

ACCEPTANCE CRITERIA: (1) Findings transformed to human-readable summary. (2) Key risk factors highlighted. (3) Non-blocking - shows 'Analyzing...' while LLM generates. (4) Falls back to raw findings if LLM unavailable.
"@

Update-Bead "6mz1" @"
PROJECT CONTEXT: The approval inbox needs Approve and Reject buttons that call the backend and trigger downstream updates (webhook to n8n, bead status change).

TASK: Wire Approve and Reject buttons: (1) Approve calls POST /api/v1/approvals/{id}/approve. (2) Reject calls POST /api/v1/approvals/{id}/reject with rationale (minimum 10 characters, enforced by backend). (3) On action, backend fires webhook callback to n8n (GS-5.2) and updates bead status (GS-4.3). (4) Show confirmation toast on success. (5) Remove decided approval from inbox list. (6) Reject shows text input for required rationale.

DEPENDS ON: GS-9.1 (approval inbox page), GS-9.2 (diff postcard with buttons).

ACCEPTANCE CRITERIA: (1) Approve/reject call correct endpoints. (2) Reject requires rationale >= 10 chars. (3) Toast on success/error. (4) Inbox refreshes after decision. (5) Optimistic UI update.
"@

# === PHASE 10 ===
Update-Bead "gjdy" @"
PROJECT CONTEXT: Board packets are the capstone governance artifact - a sealed bundle proving all governance conditions were met for a time period. The PDF deck (page 5) shows Sarah's Tuesday ending at 4:30 PM with 'all conditions met, bundle exported.' The backend has board_packets.py router with 17 endpoints.

TASK: Build n8n workflow that: (1) Collects all evidence bundles for a time period via GET /api/v1/bundles?from=X&to=Y. (2) Aggregates findings by department/severity. (3) Generates board packet via POST /api/v1/board-packets. (4) Checks all nomotic conditions met. (5) Exports sealed bundle. (6) Stores in long-term Memory MCP layer.

BACKEND API: D:\Projects\GuardSpine\app\routers\board_packets.py (17 endpoints).

ACCEPTANCE CRITERIA: (1) All evidence collected for period. (2) Board packet generated with aggregated findings. (3) Only finalized when all conditions met. (4) Sealed bundle exportable. (5) Stored in Memory MCP.
"@

Update-Bead "5koo" @"
PROJECT CONTEXT: Governance changes (modifications to rubric packs or policy rules) themselves require governed approval. The backend has governance.py router with 11 endpoints including change workflows and impact analysis.

TASK: Build n8n workflow for rubric/policy changes: (1) Detect changes to nomotic-core.yaml or any rubric pack. (2) Call backend impact analysis endpoint to preview effects. (3) Require multi-party approval for the change. (4) Apply change only after approval. (5) Create evidence bundle documenting the governance change.

BACKEND API: D:\Projects\GuardSpine\app\routers\governance.py (11 endpoints, includes impact analysis).

ACCEPTANCE CRITERIA: (1) Rubric changes trigger approval workflow. (2) Impact analysis previewed before approval. (3) Multi-party sign-off required. (4) Evidence trail for governance changes.
"@

Update-Bead "q36t" @"
PROJECT CONTEXT: Board packet finalization is the 'all conditions met, bundle exported' moment from Sarah's Tuesday narrative (PDF page 5, 4:30 PM).

TASK: Create n8n gate node that checks finalization conditions: (1) All required approvals resolved (no pending). (2) All nomotic interrupts cleared (no active blocks). (3) All evidence bundles sealed (no unsealed). Only then mark board packet as finalized via PUT /api/v1/board-packets/{id}/finalize. Use bd.exe gate command for coordination if needed.

DEPENDS ON: GS-10.1 (board packet assembly).

ACCEPTANCE CRITERIA: (1) Gate blocks finalization until ALL conditions met. (2) Clear reporting of which conditions are unmet. (3) Finalized packet is immutable. (4) Notification sent on finalization.
"@

# === PHASE 11 ===
Update-Bead "9pu0" @"
PROJECT CONTEXT: GuardSpine's competitive advantage is being THE SPINE that connects across all enterprise tools - not just code repos but documents, spreadsheets, images, contracts across GitHub, SharePoint, Vanta, DocuSign. The PDF deck (page 3) shows competitors each cover 1-2 columns, GuardSpine covers all 5.

TASK: Build a connector abstraction layer in hooks allowing pluggable source connectors. Each connector: (1) Receives change events from external system (webhook/polling). (2) Converts to GuardSpine EvaluationRequest format (artifact_id, artifact_kind, content). (3) Routes through evaluate pipeline. (4) Returns findings to source system. Backend connectors.py has 13 endpoints.

FILES: Create D:\Projects\n8n-nodes-guardspine\connectors\base-connector.js (abstract), D:\Projects\n8n-nodes-guardspine\connectors\index.js.

ACCEPTANCE CRITERIA: (1) Base connector class with connect/transform/evaluate/respond methods. (2) Pluggable registration. (3) Standardized event -> EvaluationRequest transformation. (4) Standardized findings -> source system response.
"@

Update-Bead "6d85" @"
PROJECT CONTEXT: GitHub is the primary code governance platform. GuardSpine must intercept GitHub PR/commit webhooks and evaluate code diffs. The PDF deck (page 3) shows GitHub only does 'Code Governance' - GuardSpine adds the other 4 columns.

TASK: Build GitHub connector: (1) Receive GitHub PR webhook events via n8n webhook node. (2) Extract diff content from PR. (3) Evaluate via /policies/evaluate with artifact_kind='code'. (4) Post findings as PR review comments with risk tier badges. (5) Competitive advantage: also evaluate docs/sheets changed in same PR.

DEPENDS ON: GS-11.1 (connector abstraction).

FILES: Create D:\Projects\n8n-nodes-guardspine\connectors\github-connector.js. Build n8n workflow template for GitHub webhook -> evaluate -> comment.

ACCEPTANCE CRITERIA: (1) GitHub webhook triggers evaluation. (2) Findings posted as PR comments. (3) Risk badges in comments. (4) Multi-artifact PRs (code + docs) evaluated correctly.
"@

Update-Bead "hpyi" @"
PROJECT CONTEXT: The PDF deck (page 13) specifically calls out SharePoint/Drive as the next sprint connector. These are document storage platforms where changes to PDFs, spreadsheets, and presentations happen.

TASK: Build SharePoint/Google Drive connector: (1) Watch document change events (via webhook or polling). (2) Detect artifact type (pdf/xlsx/pptx). (3) Fetch changed content. (4) Evaluate via GuardSpine with correct artifact_kind. (5) Create evidence bundle. This covers the 'Data Movement' column from the competitor matrix.

DEPENDS ON: GS-11.1 (connector abstraction).

FILES: Create D:\Projects\n8n-nodes-guardspine\connectors\sharepoint-drive-connector.js.

ACCEPTANCE CRITERIA: (1) Document changes detected. (2) Correct artifact type detected. (3) Evaluation with appropriate guard lane. (4) Evidence bundle created. (5) Notifications for high-risk changes.
"@

Update-Bead "mqh6" @"
PROJECT CONTEXT: Vanta and ServiceNow do 'Process Controls' (PDF deck page 3) but lack semantic artifact governance. GuardSpine can export findings as compliance evidence into these platforms.

TASK: Build connector that syncs GuardSpine findings into Vanta/ServiceNow: (1) Export evidence bundles in SOC2/HIPAA compliance format. (2) Map GuardSpine findings to compliance control IDs. (3) The backend already has rubrics for hipaa-safeguards, soc2-controls, pci-dss-requirements at D:\Projects\GuardSpine\rubrics\builtin\. (4) Bridge process controls and semantic governance.

DEPENDS ON: GS-11.1 (connector abstraction).

FILES: Create D:\Projects\n8n-nodes-guardspine\connectors\compliance-connector.js.

ACCEPTANCE CRITERIA: (1) Findings exported as compliance evidence. (2) Mapped to SOC2/HIPAA controls. (3) Evidence format compatible with Vanta API. (4) Audit trail maintained.
"@

Update-Bead "r3j3" @"
PROJECT CONTEXT: DocuSign does 'Signature Auth' (PDF deck page 3) but 'signs output, ignores changes' - meaning it authenticates WHO signed but not WHETHER the document changed since review.

TASK: Build DocuSign connector that intercepts document changes BEFORE signing: (1) Evaluate document diffs when document is updated. (2) Require GuardSpine approval for semantic changes. (3) Only release for DocuSign signature after approval. (4) Evidence bundle includes both GuardSpine governance trail AND DocuSign signature chain.

DEPENDS ON: GS-11.1 (connector abstraction).

FILES: Create D:\Projects\n8n-nodes-guardspine\connectors\docusign-connector.js.

ACCEPTANCE CRITERIA: (1) Document changes evaluated before signing. (2) High-risk changes require approval. (3) Evidence includes governance + signature chain. (4) Closes the 'signs but ignores changes' gap.
"@

# === PHASE 12 ===
Update-Bead "yyjq" @"
PROJECT CONTEXT: Evidence bundles are the audit trail for GuardSpine governance. The PDF deck (page 9) shows a terminal running 'guardspine-verify bundle.zip' returning INTEGRITY VALID, SIGNATURE VERIFIED (Offline Mode). Zero-Trust pitch: auditors verify the math, not the vendor.

TASK: Build CLI tool (Node.js or Python) that takes a sealed evidence bundle ZIP and verifies offline: (1) SHA-256 hash chain integrity (each seal references previous_hash). (2) Approver identity digital signatures valid. (3) Policy rule YAML references exist and match. (4) Timestamps are monotonically increasing. (5) No network calls needed.

FILES: Create D:\Projects\n8n-nodes-guardspine\cli\guardspine-verify.js (or .py).

ACCEPTANCE CRITERIA: (1) CLI verifies bundle without network. (2) Reports INTEGRITY VALID or INTEGRITY FAILED with details. (3) Verifies signature chain. (4) Checks YAML rule references. (5) Exit code 0 for valid, 1 for invalid.
"@

Update-Bead "yjoe" @"
PROJECT CONTEXT: Evidence bundles use a 4-layer structure (PDF page 9): (1) The Diff (Content Hash), (2) Approver Identity (Digital Sig), (3) Policy Rule (YAML Ref), (4) Timestamp. Each layer is hashed, and bundles link to previous events via SHA-256 hash chain creating an IMMUTABLE RECORD (like a blockchain audit trail).

TASK: Verify the backend evidence/seal endpoint at D:\Projects\GuardSpine\app\routers\evidence.py actually implements this 4-layer crypto chain. If not, implement it: (1) Content hash of diff. (2) Digital signature of approver. (3) YAML rule reference hash. (4) ISO timestamp. (5) previous_hash field linking to previous seal, creating chain. (6) Return combined seal hash.

FILES: D:\Projects\GuardSpine\app\routers\evidence.py, D:\Projects\GuardSpine\app\services\evidence_service.py (if exists).

ACCEPTANCE CRITERIA: (1) 4-layer hash structure implemented. (2) previous_hash creates blockchain-like chain. (3) Each seal deterministically reproducible from inputs. (4) CLI verify tool (GS-12.1) can validate. (5) Tamper-evident - any change breaks chain.
"@

# === PHASE 13 ===
Update-Bead "brs1" @"
PROJECT CONTEXT: Nomotic is the governance philosophy partner for GuardSpine. The PDF deck (pages 11, 15) says step 1 is 'Draft nomotic-core.yaml for review.' This is the standard rule set containing Authority rules (who can approve what) and Interruption triggers (what patterns force human review).

TASK: Create nomotic-core.yaml following the existing rubric schema in D:\Projects\GuardSpine\rubrics\builtin\. Must include: (1) Authority rules (e.g., financial changes require Finance Director, legal changes require General Counsel). (2) Interruption triggers (external_link_added, signature_changed, financial_formula_changed, liability_clause_altered, pii_field_added, auth_code_modified, api_key_pattern). (3) Bundle schema fields: authority_basis and constraints_applied. (4) All Nomotic references must be direct citations, no AI summarization (Partner Control from page 11).

FILES: Create D:\Projects\GuardSpine\rubrics\builtin\nomotic-core.yaml. Reference existing rubrics in same directory for schema format.

ACCEPTANCE CRITERIA: (1) Valid YAML following existing rubric schema. (2) All 7+ interrupt triggers defined. (3) Authority rules with approver requirements. (4) Bundle schema fields present. (5) Direct Nomotic citations only.
"@

Update-Bead "ltr3" @"
PROJECT CONTEXT: Changes to governance rules (the nomotic-core.yaml rubric pack) must themselves be governed. This prevents unauthorized modification of the rules that control AI behavior.

TASK: Build approval gate for rubric pack modifications: (1) When nomotic-core.yaml or any policy pack is modified (detected via file watch or git hook). (2) Trigger L4 evaluation (highest risk tier) automatically. (3) Require executive sign-off (not just any approver). (4) Create evidence bundle documenting the rule change. (5) Wire into governance change workflow (GS-10.2).

DEPENDS ON: GS-13.1 (nomotic-core.yaml must exist first).

FILES: D:\Projects\n8n-nodes-guardspine\hooks\guardspine-hooks.js (detection), n8n workflow for rubric change approval.

ACCEPTANCE CRITERIA: (1) Rubric changes auto-detected. (2) L4 evaluation triggered. (3) Executive approval required. (4) Evidence trail created. (5) Unauthorized changes blocked.
"@

# === PHASE 14 ===
Update-Bead "utnu" @"
PROJECT CONTEXT: For high-risk (L3+) evaluations, GuardSpine uses Byzantine consensus - multiple LLMs independently evaluate the same artifact and must reach agreement. This prevents any single model's bias from causing false negatives. The backend pipeline at D:\Projects\GuardSpine\app\services\pipeline.py already supports L2 (2 models peer review) and L3 (3+ models adversarial).

TASK: Wire Byzantine consensus into hooks: (1) When evaluate response indicates L3+, hooks should trigger council vote via OpenRouter with multiple models. (2) Configure consensus threshold (e.g., 2/3 agreement). (3) Record dissenting opinions in findings. (4) Backend adapters (openrouter, ollama, litellm) support multi-model calls.

DEPENDS ON: GS-3.1 (LLM routing), GS-2.1 (risk classification).

FILES: D:\Projects\n8n-nodes-guardspine\hooks\guardspine-hooks.js, D:\Projects\GuardSpine\app\services\pipeline.py.

ACCEPTANCE CRITERIA: (1) L3+ evaluations use multiple models. (2) Consensus threshold configurable. (3) Dissenting opinions recorded. (4) Works with OpenRouter multi-model.
"@

Update-Bead "gxbr" @"
PROJECT CONTEXT: GuardSpine will automate 24 departments in the business. Each department needs its own n8n workflow pipeline with domain-specific rubric packs, KPIs, and feedback mechanisms.

TASK: Create a reusable n8n workflow template (JSON) that each department instantiates. Template includes: (1) Input trigger (scheduled/webhook/manual). (2) GuardSpine preExecute evaluation with department-specific rubric pack. (3) LLM processing step for department task. (4) PostExecute evidence bundle creation. (5) KPI collection node. (6) Counter-KPI validation node. (7) Meta-loop feedback output to connected departments.

Template parameterized by: department_name, rubric_pack_id, kpi_definitions, connected_departments.

FILES: Create D:\Projects\n8n-nodes-guardspine\templates\department-pipeline.json.

ACCEPTANCE CRITERIA: (1) Template imports into n8n. (2) Parameters replaceable per department. (3) All 7 pipeline stages present. (4) KPI and counter-KPI nodes functional.
"@

Update-Bead "bcbd" @"
PROJECT CONTEXT: The business has 24 departments, each needing a unique configuration for GuardSpine governance. Each department has different risk profiles, approval chains, and quality metrics.

TASK: Define 24 department YAML configurations each containing: department_id, name, rubric_pack_ids (which governance rules apply), kpi_definitions (what to measure), counter_kpi_definitions (adversarial metrics to prevent gaming), escalation_contacts (who approves), meta_loop_connections (which departments exchange feedback).

DEPARTMENTS: Engineering, Legal, Finance, HR, Marketing, Sales, Product, Design, QA, Security, Compliance, Data, DevOps, Support, Research, Content, Partnerships, Growth, Analytics, Infrastructure, Platform, Mobile, AI/ML, Operations.

Example KPI/Counter-KPI pairs: Engineering velocity (lines/day) vs defect rate (bugs/line). Marketing content output vs slop score. Finance accuracy vs audit finding rate.

FILES: Create D:\Projects\GuardSpine\rubrics\departments\{department-name}.yaml (24 files).

ACCEPTANCE CRITERIA: (1) 24 YAML files, one per department. (2) Valid schema matching rubric format. (3) KPI/counter-KPI pairs for each. (4) Meta-loop connections defined. (5) Escalation contacts realistic.
"@

Update-Bead "hcj2" @"
PROJECT CONTEXT: Meta-loops are cross-department feedback mechanisms where one department's output metrics feed as inputs to related departments, creating a self-correcting system. Example: Engineering velocity KPI feeds into QA coverage counter-KPI.

TASK: Build n8n workflows connecting departments in feedback loops: (1) Each department's KPI outputs route to related departments' counter-KPI inputs. (2) Finance budget KPI feeds ALL departments as a constraint. (3) Meta-loops run weekly (cron schedule). (4) Aggregate cross-department metrics. (5) Flag misalignments (e.g., Engineering velocity up but QA coverage down). (6) Store results in Memory MCP long-term layer for longitudinal analysis.

DEPENDS ON: GS-14.2 (department template), GS-14.3 (department definitions with meta_loop_connections).

FILES: Create D:\Projects\n8n-nodes-guardspine\workflows\meta-loops\{loop-name}.json.

ACCEPTANCE CRITERIA: (1) Department KPIs route to connected counter-KPIs. (2) Misalignment detection works. (3) Weekly schedule. (4) Results in Memory MCP. (5) Dashboard-ready output.
"@

# === PHASE 15 ===
Update-Bead "b14h" @"
PROJECT CONTEXT: Telemetry is the data collection layer that captures metrics from every GuardSpine evaluation. This data feeds weekly reviews and improvement suggestions. Without telemetry, there's no way to measure if governance is working.

TASK: Add structured telemetry emission to every hook stage. Capture: evaluation_duration_ms, risk_tier_distribution, findings_by_severity, approval_decision_time, bundle_seal_time, interrupt_trigger_counts, guard_lane_usage (code/pdf/xlsx/image). Emit as JSON events via POST /api/v1/events (backend events.py router exists). Each package includes WHO/WHEN/PROJECT/WHY metadata per Memory MCP protocol.

FILE TO EDIT: D:\Projects\n8n-nodes-guardspine\hooks\guardspine-hooks.js - add emitTelemetry() calls in preExecute, postExecute, workflowSave.

ACCEPTANCE CRITERIA: (1) Telemetry emitted on every hook call. (2) All 7 metric types captured. (3) WHO/WHEN/PROJECT/WHY metadata included. (4) Events posted to /api/v1/events. (5) Telemetry failures don't break workflow execution.
"@

Update-Bead "yx9n" @"
PROJECT CONTEXT: Memory MCP (D:\Projects\memory-mcp-triple-system) is a triple-layer memory system with short-term (24h), mid-term (7d), and long-term (30d) retention, plus vector search (ChromaDB) and graph reasoning (NetworkX). Telemetry data from hooks needs to be stored here for weekly analysis.

TASK: Route telemetry from hooks into Memory MCP: (1) Short-term (24h): current execution metrics for real-time monitoring. (2) Mid-term (7d): weekly aggregates for trend analysis. (3) Long-term (30d): historical patterns. (4) Vector layer: enable semantic search like 'show me high-risk evaluations in Finance department last month'. (5) Graph layer: build relationship chains (department -> risk -> finding -> fix).

DEPENDS ON: GS-15.1 (telemetry collection).

INTEGRATION: Use Memory MCP's mcp__memory-mcp__memory_store for writes and mcp__memory-mcp__unified_search for reads.

ACCEPTANCE CRITERIA: (1) Telemetry stored in correct retention layer. (2) Semantic search works. (3) Graph relationships queryable. (4) Weekly aggregation job runs. (5) 30-day history retained.
"@

Update-Bead "sfod" @"
PROJECT CONTEXT: KPIs measure department performance. Counter-KPIs are adversarial metrics that prevent gaming - if you optimize one metric at the expense of quality, the counter-KPI catches it. This is inspired by Goodhart's Law prevention.

TASK: Define KPI schema: metric_id, name, formula (how to calculate), target_value, warning_threshold, critical_threshold. Define Counter-KPI schema: same fields plus primary_kpi_id (what it guards against), correlation (expected relationship: inverse/proportional).

Example pairs: Engineering 'code_velocity' (lines/day, target 200) vs 'defect_rate_per_line' (bugs/line, target <0.01). Marketing 'content_output' (posts/week, target 5) vs 'slop_score' (%, target <5%). Finance 'processing_speed' (invoices/hour) vs 'error_rate' (%, target <1%).

FILES: Create D:\Projects\GuardSpine\rubrics\kpi-schema.yaml and D:\Projects\GuardSpine\rubrics\departments\{dept}.yaml entries.

ACCEPTANCE CRITERIA: (1) KPI schema defined. (2) Counter-KPI schema with adversarial relationship. (3) At least 1 KPI/counter-KPI pair per department. (4) Thresholds realistic. (5) Weekly evaluation formula clear.
"@

Update-Bead "yszd" @"
PROJECT CONTEXT: Every week, GuardSpine should automatically review all telemetry, aggregate KPIs, check for gaming via counter-KPIs, compare to targets, and suggest improvements. This is the self-improving feedback loop.

TASK: Build n8n workflow (cron-triggered weekly): (1) Query Memory MCP for past week's telemetry via unified_search. (2) Aggregate KPIs per department. (3) Evaluate counter-KPIs for gaming detection (e.g., velocity up but quality down). (4) Compare to targets and previous week. (5) Generate improvement suggestions via LLM analysis (GS-15.5). (6) Create board packet summary. (7) Store review in Memory MCP long-term layer. (8) Fire alerts for departments below threshold.

DEPENDS ON: GS-15.1 (telemetry), GS-15.2 (Memory MCP sink), GS-15.3 (KPI schema).

FILES: Create D:\Projects\n8n-nodes-guardspine\workflows\weekly-review.json.

ACCEPTANCE CRITERIA: (1) Runs weekly on schedule. (2) All departments' KPIs aggregated. (3) Counter-KPI gaming detection works. (4) Week-over-week comparison. (5) Suggestions generated. (6) Alerts fired for underperformers.
"@

Update-Bead "3ztm" @"
PROJECT CONTEXT: The improvement suggestion engine analyzes weekly KPI/telemetry data and proposes concrete governance improvements. This closes the loop: measure -> analyze -> suggest -> approve (via GS-13.2) -> implement.

TASK: Build LLM-powered analysis that: (1) Identifies which rubric rules fire most frequently. (2) Finds departments with highest approval rejection rates. (3) Detects nomotic interrupts that are false positives (fire but always get approved). (4) Generates suggestions like 'Relax rule X for department Y based on 4 weeks of zero true positives' or 'Tighten financial_formula_changed threshold based on 3 missed catches'. (5) All suggestions require governed adaptation approval (GS-13.2) before implementation.

DEPENDS ON: GS-15.4 (weekly review provides the data).

FILES: Add to D:\Projects\n8n-nodes-guardspine\workflows\weekly-review.json or create separate improvement-engine.json.

ACCEPTANCE CRITERIA: (1) Pattern analysis across 4+ weeks. (2) False positive detection. (3) Concrete, actionable suggestions. (4) Suggestions routed to governed adaptation (GS-13.2). (5) Approved suggestions auto-applied.
"@

# === PHASE 16 ===
Update-Bead "fko4" @"
PROJECT CONTEXT: GuardSpine needs a monitoring dashboard showing real-time governance health across all departments. The PDF deck (page 13) lists Dashboard as part of Frontend (89% complete). The backend already has dashboard.py router at D:\Projects\GuardSpine\app\routers\dashboard.py.

TASK: Build dashboard page (React, can be in D:\Projects\life-os-frontend) showing: (1) Risk overview heatmap across 24 departments (color-coded L0-L4). (2) Audit trail timeline (last 24h/7d/30d with filters). (3) Department health scores from KPIs (green/yellow/red). (4) Pending approvals count with urgency badges. (5) Evidence bundle count and seal status. (6) Guard lane utilization chart (code/pdf/xlsx/image percentages).

BACKEND API: GET /api/v1/dashboard/* endpoints from D:\Projects\GuardSpine\app\routers\dashboard.py.

ACCEPTANCE CRITERIA: (1) All 6 sections render with real data. (2) Time range filters work. (3) Department drill-down clickable. (4) Auto-refreshes. (5) Responsive design.
"@

Update-Bead "rokd" @"
PROJECT CONTEXT: A real-time event monitor is like a Security Operations Center (SOC) for AI governance. It shows live events as they happen: evaluations, approvals, interrupts, bundle seals.

TASK: Build WebSocket-based real-time event feed: (1) Connect to backend events WebSocket. (2) Display scrolling feed of events with: event type icon, severity color, artifact name, department, timestamp. (3) Filter controls: by department, risk tier, event type. (4) Sound/visual alert for L3+ events. (5) Pause/resume feed button.

DEPENDS ON: GS-16.1 (embedded in dashboard page).

BACKEND: Uses events router WebSocket endpoint from D:\Projects\GuardSpine\app\routers\events.py.

ACCEPTANCE CRITERIA: (1) Real-time events display within 1s. (2) Filters work without reconnecting. (3) High-risk events highlighted. (4) Feed performant with 100+ events/minute. (5) Pause preserves buffer.
"@

Write-Host "All 60 beads updated with self-contained descriptions."
