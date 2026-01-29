## GS-8.1: Multi-artifact routing in hooks
type: task
priority: 1
labels: guardspine, hooks, multi-artifact, phase-8
description: Current hooks hardcode artifact_kind='code'. PDF deck (page 4) promises 4 guard lanes: CodeGuard, PDFGuard, SheetGuard, ImageGuard. Add artifact_kind detection in preExecute based on workflow node types. If workflow contains PDF nodes -> artifact_kind=pdf. Spreadsheet nodes -> xlsx. Image nodes -> image. Default -> code. Pass correct artifact_kind in EvaluationRequest to backend. Backend already has all 4 guards in codeguard/guards/.
estimate: 45

---

## GS-8.2: PDFGuard n8n integration
type: task
priority: 2
labels: guardspine, pdfguard, guard-lane, phase-8
description: Wire PDFGuard (codeguard/guards/pdfguard/) into n8n evaluation pipeline. Backend PDFGuard detects clause changes, reflows, liability alterations in PDF documents. Hooks should detect PDF-processing workflows and tag artifact_kind=pdf. Sarah's Tuesday narrative (PDF page 5) shows PDFGuard detecting liability clause change in 47-page doc triggering General Counsel Interrupt. Verify backend pdfguard returns findings with correct severity for nomotic interrupt firing.
estimate: 60

---

## GS-8.3: SheetGuard n8n integration
type: task
priority: 2
labels: guardspine, sheetguard, guard-lane, phase-8
description: Wire SheetGuard (codeguard/guards/sheetguard/) into n8n evaluation pipeline. Backend SheetGuard detects formula changes, range modifications, VLOOKUP replacements. Sarah's Tuesday narrative (PDF page 5) shows SheetGuard detecting 14 formula changes triggering Finance Authority Rule. Hooks should detect spreadsheet-processing workflows and tag artifact_kind=xlsx.
estimate: 60

---

## GS-8.4: ImageGuard n8n integration
type: task
priority: 2
labels: guardspine, imageguard, guard-lane, phase-8
description: Wire ImageGuard (codeguard/guards/imageguard/) into n8n evaluation pipeline. Backend ImageGuard detects pixel diffs, UI anomalies, added API links in slide decks. Sarah's Tuesday narrative (PDF page 5) shows ImageGuard detecting added API link on Slide 12 triggering External Data interrupt blocked until L3 Review. Hooks should detect image/presentation workflows and tag artifact_kind=image.
estimate: 60

---

## GS-9.1: Approval Inbox React page
type: task
priority: 0
labels: guardspine, frontend, approval-ui, critical, phase-9
description: PDF page 6 shows "GuardSpine Decision View / Approval Inbox" - the 10-Second Decision UI. Build React page that lists pending approvals from GET /api/v1/approvals?status=pending. Each approval card shows: artifact name, risk tier badge (L0-L4 color coded), timestamp, required approvers. Clicking a card opens the Diff Postcard view (GS-9.2). This is THE critical frontend gap - without this UI, approvers cannot make decisions. Can be built in life-os-frontend or as standalone React app.
estimate: 120

---

## GS-9.2: Diff Postcard React component
type: task
priority: 0
labels: guardspine, frontend, diff-postcard, critical, phase-9
description: PDF page 6 shows exact UI spec. Component must render: (1) AI Suggestion panel at top with risk analysis summary from findings. (2) Side-by-side diff showing Original vX.Y vs Proposed vX.Z with highlighted changes (red/green). (3) Risk Analysis badge showing escalation level. (4) Session metadata footer (GuardSpine version, diff count, session ID). Replace the skeletal PIL postcard.py (44 lines) with this proper React component. This component is embedded in the Approval Inbox.
estimate: 120

---

## GS-9.3: AI Suggestion panel in approval view
type: task
priority: 1
labels: guardspine, frontend, ai-suggestion, phase-9
description: PDF page 6 shows AI Suggestion box with specific risk analysis text like "Cash flow impact. Payment term changed from 30 to 45 days. Matches external vendor request pattern." This panel pulls from EvaluationResult.findings and formats them as human-readable risk summary. Use LLM (via backend) to generate natural language summary of findings for the approver. Display above the diff postcard.
estimate: 60

---

## GS-9.4: Approve/Reject actions wired to backend
type: task
priority: 1
labels: guardspine, frontend, approval-actions, phase-9
description: PDF page 6 shows red "X Reject" and green "Approve" buttons. Wire to POST /api/v1/approvals/{id}/approve and POST /api/v1/approvals/{id}/reject endpoints. Reject requires rationale (min 10 chars per backend validation). On action, fire webhook callback to n8n (GS-5.2) and update bead status (GS-4.3). Show confirmation toast. Update inbox list to remove decided approval.
estimate: 45

---

## GS-10.1: Board packet assembly workflow
type: task
priority: 1
labels: guardspine, board-packets, governance, phase-10
description: PDF page 5 shows board packet finalization at 4:30 PM after all conditions met. Backend has board_packets.py router with 17 endpoints. Build n8n workflow that: (1) Collects all evidence bundles for a time period. (2) Aggregates findings by department/severity. (3) Generates board packet via POST /api/v1/board-packets. (4) Requires all nomotic conditions met before marking finalized. (5) Exports sealed bundle. This is the capstone governance artifact.
estimate: 90

---

## GS-10.2: Governance change workflow
type: task
priority: 2
labels: guardspine, governance, change-workflow, phase-10
description: PDF page 7 shows Governed Adaptation -> Governance-Change Workflows. Backend has governance.py router with 11 endpoints including change workflows and impact analysis. Build n8n workflow for rubric/policy pack changes that require multi-party approval. Changes to nomotic-core.yaml or any rubric pack trigger this workflow. Backend supports impact analysis endpoint to preview what would change.
estimate: 90

---

## GS-10.3: Board packet finalization gate
type: task
priority: 2
labels: guardspine, board-packets, finalization, phase-10
description: The "all conditions met, bundle exported" moment from Sarah's Tuesday (PDF page 5, 4:30 PM). Create n8n gate node that checks: all required approvals resolved, all nomotic interrupts cleared, all evidence bundles sealed. Only then marks board packet as finalized. Uses bd.exe gate command for coordination.
estimate: 45

---

## GS-11.1: Connector abstraction layer
type: task
priority: 1
labels: guardspine, connectors, abstraction, spine, phase-11
description: PDF page 13 says Next Sprint is Connector Framework (SharePoint/Drive). Backend has connectors.py with 13 endpoints. Build abstraction in hooks that allows pluggable source connectors. Each connector: (1) Receives change events from external system. (2) Converts to GuardSpine EvaluationRequest. (3) Routes through evaluate pipeline. (4) Returns findings to source system. This is what makes GuardSpine the SPINE across all tools.
estimate: 90

---

## GS-11.2: GitHub connector
type: task
priority: 1
labels: guardspine, connector, github, spine, phase-11
description: PDF page 3 shows GitHub only does Code Governance. GuardSpine connector intercepts GitHub PR/commit webhooks, evaluates code diffs via /policies/evaluate with artifact_kind=code, posts findings as PR review comments with risk badges. Competitor advantage: we also evaluate docs/sheets in same PR. Use GitHub webhook -> n8n -> GuardSpine evaluate -> GitHub API pattern.
estimate: 90

---

## GS-11.3: SharePoint/Drive connector
type: task
priority: 2
labels: guardspine, connector, sharepoint, drive, spine, phase-11
description: PDF page 13 specifically calls out SharePoint/Drive as next sprint. Connector watches document change events from SharePoint/Google Drive. On document change: detect artifact type (pdf/xlsx/pptx), fetch content, evaluate via GuardSpine, create evidence bundle. This covers the "Data Movement" column from competitor matrix where only DLP/Purview currently operates.
estimate: 90

---

## GS-11.4: Vanta/ServiceNow connector
type: task
priority: 2
labels: guardspine, connector, vanta, servicenow, compliance, spine, phase-11
description: PDF page 3 shows Vanta/ServiceNow only does Process Controls. GuardSpine connector syncs findings as compliance evidence into Vanta/ServiceNow. Export evidence bundles in format compatible with SOC2/HIPAA compliance frameworks. Backend already has rubrics for hipaa-safeguards, soc2-controls, pci-dss-requirements. Bridge the gap between process controls and semantic artifact governance.
estimate: 90

---

## GS-11.5: DocuSign connector
type: task
priority: 3
labels: guardspine, connector, docusign, signature, spine, phase-11
description: PDF page 3 shows DocuSign only does Signature Auth but ignores changes. GuardSpine connector intercepts document changes BEFORE signing. Evaluate document diffs, require approval for semantic changes, then release for DocuSign signature. Evidence bundle includes both GuardSpine governance trail AND DocuSign signature chain. Closes the "signs output, ignores changes" gap.
estimate: 60

---

## GS-12.1: Offline bundle verification CLI
type: task
priority: 1
labels: guardspine, evidence, verification, cli, phase-12
description: PDF page 9 shows terminal with "guardspine-verify bundle.zip" returning INTEGRITY VALID, SIGNATURE VERIFIED (Offline Mode). Build CLI tool (Node.js or Python) that takes a sealed evidence bundle ZIP, verifies SHA-256 hash chain integrity without contacting server, validates approver identity digital signatures, confirms policy rule YAML references exist. Zero-Trust pitch: auditors verify the math, not the vendor.
estimate: 90

---

## GS-12.2: Hash chain integrity in evidence seal
type: task
priority: 1
labels: guardspine, evidence, hash-chain, crypto, phase-12
description: PDF page 9 shows evidence bundle with 4 layers: (1) The Diff (Content Hash), (2) Approver Identity (Digital Sig), (3) Policy Rule (YAML Ref), (4) Timestamp. Each layer hashed. Bundle links to Previous Event via SHA-256 Hash Chain creating IMMUTABLE RECORD. Verify backend /evidence/seal actually implements this crypto chain. If not, implement it. Each seal must reference previous_hash creating blockchain-like audit trail.
estimate: 60

---

## GS-13.1: Draft nomotic-core.yaml rubric pack
type: task
priority: 0
labels: guardspine, nomotic, rubric, critical, phase-13
description: PDF page 11 and 15 both say step 1 is "Draft nomotic-core.yaml for review." This is the standard Nomotic-defined rule set containing Authority rules and Interruption triggers. Must include authority_basis and constraints_applied bundle schema fields. All Nomotic references must be direct citations, no AI summarization of rules (Partner Control from page 11). Backend already has rubrics/builtin/ directory. Create nomotic-core.yaml following existing rubric schema.
estimate: 60

---

## GS-13.2: Governed adaptation approval gate
type: task
priority: 1
labels: guardspine, nomotic, governed-adaptation, phase-13
description: PDF page 11 says changes to the rubric require multi-party approval. Build approval gate specifically for rubric pack modifications. When nomotic-core.yaml or any policy pack is modified, trigger L4 evaluation requiring executive sign-off. This ensures the rules that govern AI are themselves governed. Wire into governance change workflow (GS-10.2).
estimate: 45

---

## GS-14.1: AI Council Byzantine consensus integration
type: task
priority: 1
labels: guardspine, council, byzantine, consensus, phase-14
description: For L3+ evaluations, use Byzantine consensus across multiple LLMs (CouncilVote pattern). Backend pipeline.py already supports L2 (2 models peer review) and L3 (3+ models adversarial). Wire into hooks so that high-risk evaluations automatically trigger council vote via OpenRouter with multiple models. Consensus threshold configurable. Dissenting opinions recorded in findings. Backend adapters (openrouter, ollama, litellm) already support multi-model.
estimate: 60

---

## GS-14.2: Department pipeline n8n template
type: task
priority: 1
labels: guardspine, departments, pipeline-template, phase-14
description: Create reusable n8n workflow template for department automation. Each department gets: (1) Input trigger (scheduled/webhook/manual). (2) GuardSpine preExecute evaluation with department-specific rubric pack. (3) LLM processing step for department task. (4) PostExecute evidence bundle. (5) KPI collection node. (6) Counter-KPI validation node. (7) Meta-loop feedback output. Template parameterized by department name, rubric pack, KPI definitions.
estimate: 90

---

## GS-14.3: 24 department definitions with rubric configs
type: task
priority: 2
labels: guardspine, departments, definitions, rubrics, phase-14
description: Define 24 department configurations each with: department_id, name, rubric_pack_ids, kpi_definitions, counter_kpi_definitions, escalation_contacts, meta_loop_connections (which other depts to exchange feedback with). Departments include: Engineering, Legal, Finance, HR, Marketing, Sales, Product, Design, QA, Security, Compliance, Data, DevOps, Support, Research, Content, Partnerships, Growth, Analytics, Infrastructure, Platform, Mobile, AI/ML, Operations. Each stored as YAML in rubrics/departments/.
estimate: 120

---

## GS-14.4: Inter-department meta-loops
type: task
priority: 2
labels: guardspine, departments, meta-loops, feedback, phase-14
description: Build n8n workflows connecting departments in feedback loops. Each department's KPI outputs feed as inputs to related departments' counter-KPIs. Example: Engineering velocity KPI feeds into QA coverage counter-KPI. Finance budget KPI feeds into all departments as constraint. Meta-loops run on weekly schedule, aggregate cross-department metrics, flag misalignments. Store loop results in Memory MCP for longitudinal analysis.
estimate: 90

---

## GS-15.1: Telemetry collection in hooks
type: task
priority: 1
labels: guardspine, telemetry, hooks, metrics, phase-15
description: Add telemetry emission to every hook stage. Capture: evaluation_duration_ms, risk_tier_distribution, findings_by_severity, approval_decision_time, bundle_seal_time, interrupt_trigger_counts, guard_lane_usage (code/pdf/xlsx/image). Emit as structured JSON events via POST /api/v1/events. Backend events.py router already exists. Each telemetry package includes WHO/WHEN/PROJECT/WHY metadata per Memory MCP protocol.
estimate: 45

---

## GS-15.2: Memory MCP telemetry sink
type: task
priority: 1
labels: guardspine, telemetry, memory-mcp, persistence, phase-15
description: Route telemetry packages from hooks into Memory MCP triple-layer system. Short-term (24h): current execution metrics. Mid-term (7d): weekly aggregates. Long-term (30d): trend data and pattern analysis. Store in vector layer for semantic search ("show me high-risk evaluations in Finance department last month"). Store in graph layer for relationship queries (department -> risk -> finding -> fix chains). Use Memory MCP's unified_search for retrieval.
estimate: 60

---

## GS-15.3: KPI and Counter-KPI schema
type: task
priority: 1
labels: guardspine, kpi, counter-kpi, schema, phase-15
description: Define KPI schema per department. Each KPI has: metric_id, name, formula, target_value, warning_threshold, critical_threshold. Counter-KPIs are adversarial metrics that ensure KPIs aren't gamed. Example: if Engineering KPI is "code velocity" (lines/day), counter-KPI is "defect rate per line." If Marketing KPI is "content output," counter-KPI is "slop score." Store as YAML alongside department definitions. Evaluated weekly.
estimate: 45

---

## GS-15.4: Weekly review automation workflow
type: task
priority: 1
labels: guardspine, weekly-review, automation, scheduling, phase-15
description: Build n8n workflow triggered weekly (cron) that: (1) Queries Memory MCP for past week's telemetry. (2) Aggregates KPIs per department. (3) Evaluates counter-KPIs for gaming detection. (4) Compares to targets and previous week. (5) Generates improvement suggestions via LLM analysis. (6) Creates board packet summary. (7) Stores review in Memory MCP long-term layer. (8) Fires alerts for departments below threshold.
estimate: 90

---

## GS-15.5: Improvement suggestion engine
type: task
priority: 2
labels: guardspine, improvement, suggestions, llm, phase-15
description: LLM-powered analysis of weekly KPI data that proposes concrete improvements. Analyzes patterns: which rubric rules fire most? Which departments have highest approval rejection rates? Which nomotic interrupts are false positives? Generates suggestions like "Relax rule X for department Y based on 4 weeks of zero true positives" or "Tighten financial_formula_changed threshold based on 3 missed catches." Suggestions require governed adaptation approval (GS-13.2) before implementation.
estimate: 60

---

## GS-16.1: GuardSpine dashboard page
type: task
priority: 1
labels: guardspine, dashboard, frontend, monitoring, phase-16
description: PDF page 13 lists Dashboard as part of Frontend (89%). Build dashboard page showing: (1) Risk overview heatmap across departments. (2) Audit trail timeline (last 24h/7d/30d). (3) Department health scores from KPIs. (4) Pending approvals count with urgency badges. (5) Evidence bundle count and seal status. (6) Guard lane utilization (code/pdf/xlsx/image). Can be in life-os-frontend or standalone. Pulls data from GET /api/v1/dashboard endpoints (backend already has dashboard.py router).
estimate: 120

---

## GS-16.2: Real-time guard event monitor
type: task
priority: 2
labels: guardspine, monitor, websocket, real-time, phase-16
description: WebSocket-based real-time feed of guard events. Shows live: evaluations happening, approvals pending/decided, interrupts firing, bundles sealed. Like a security operations center for AI governance. Uses backend events router. Displays event type, severity, artifact, department, timestamp in scrolling feed. Filters by department, risk tier, event type.
estimate: 60
