# GuardSpine Master Plan

> **Generated**: 2026-01-28
> **Unified from**: beads-plan.md + STRATEGIC-SYNTHESIS-PLAN.md
> **Status**: ACTIVE - 115 beads across 16 phases
> **Canonical Location**: `D:\Projects\n8n-nodes-guardspine\GUARDSPINE-MASTER-PLAN.md`

---

## Thesis

**"Architecture rots because context rots."**

GuardSpine is entropy control for AI-accelerated production. It turns every change into verifiable context + compressed decisions. Scale velocity without drowning in audits.

**Why Now**: AI increases bricklaying rate -> drift accelerates -> humans can't maintain vigilance -> companies need automation-native governance substrate.

**One Sentence**: "GuardSpine is the evidence substrate for AI-speed production--and the compression layer that keeps humans in control as velocity scales."

---

## MECE Architecture Diagram (7 Layers)

```
+---------------------------------------------------------------------------------+
|                    GUARDSPINE ECOSYSTEM - INVESTOR-GRADE MECE                    |
+---------------------------------------------------------------------------------+
|                                                                                  |
|  G. COMMERCIAL LAYER (Go-To-Market)                                              |
|    STARTER (Free/OSS)  |  PRO ($X/mo)  |  ENTERPRISE (Custom)  |  TRUST INVERSION|
|    Single lane          |  Multi-lane    |  SSO, Audit           |  Pre=friction   |
|    Basic policy         |  Council, API  |  Compliance           |  Post=enabler   |
|                                                                                  |
|  F. INTELLIGENCE LAYER (AI-Powered)                                              |
|    COUNCIL SYSTEM         |  AI ANALYSIS            |  LLM ROUTING              |
|    Byzantine consensus    |  /ai/analyze-approval   |  Claude/GPT/Gemini        |
|    Local (OSS Ollama)     |  Risk prediction        |  Cost optimization        |
|    Cloud (Premium)        |  Anomaly detection      |  Quality routing          |
|                                                                                  |
|  E. COMPRESSION / ATTENTION ROUTING  ** SCALE MOAT **                            |
|    DRIFT WINDOWS        |  BEAD PACKER          |  ATTENTION BUDGET            |
|    Time-based grouping  |  Bundle compression   |  Human capacity model       |
|    1000:10 ratio        |  Similarity merge     |  SLA-aware routing          |
|    QUEUE ROUTER         |  DECISION QUEUES      |  COMPRESSION API            |
|    Risk-tier dispatch   |  Per-stakeholder      |  /compress/window,queue     |
|                                                                                  |
|  D. INTEGRATION LAYER (Adapters)                                                 |
|    n8n NODES (7)     |  WEBHOOK ADAPTER   |  TELEMETRY (WHO/WHEN/PROJECT/WHY)  |
|    CLI ADAPTER       |  GITHUB ACTION     |  API GATEWAY (149 routes)          |
|                                                                                  |
|  C. ARTIFACT ROUTING (Multi-Lane Guards)                                         |
|    CodeGuard  |  PDFGuard  |  SheetGuard  |  ImageGuard                         |
|                                                                                  |
|  B. EVIDENCE CHAIN (Provenance Infrastructure)                                   |
|    BEADS SPINE  |  EVIDENCE BUNDLE  |  SEAL SYSTEM  |  VERSION HISTORY          |
|                                                                                  |
|  A. GOVERNANCE ENGINE (Foundation) - OSS KERNEL                                  |
|    RISK TIERS: AUTO [L0,L1] | REVIEW [L2] | BLOCK [L3] | *L4 enterprise*       |
|    POLICY ENGINE  |  NOMOTIC RULES (YAML DSL)  |  DEPT/PERSONA ROUTING         |
|                                                                                  |
+---------------------------------------------------------------------------------+
```

---

## Repo Inventory (Verified 2026-01-28)

### Existing Repositories
| Repo | Path | Status | License |
|------|------|--------|---------|
| GuardSpine (Backend) | `D:\Projects\GuardSpine` | 149 routes, 144 tests | Proprietary |
| guardspine-product | `D:\Projects\guardspine-product` | v1.0.0, 11 guard lanes | Proprietary |
| n8n-nodes-guardspine | `D:\Projects\n8n-nodes-guardspine` | 7 nodes, 113 tests | MIT |
| guardspine-spec | `D:\Projects\GuardSpine\open-source\guardspine-spec` | v1.0.0 | Apache 2.0 |
| guardspine-verify | `D:\Projects\GuardSpine\open-source\guardspine-verify` | v0.1.0 | Apache 2.0 |
| guardspine-connector-template | `D:\Projects\GuardSpine\open-source\guardspine-connector-template` | v1.0.0 | Apache 2.0 |
| codeguard-action | `D:\Projects\GuardSpine\github-action` | Production | Apache 2.0 |
| dnyoussef-portfolio | `D:\Projects\dnyoussef-portfolio` | Astro.js 4.16 | - |

### Planned Repositories (NEW)
| Repo | Path (Target) | Purpose |
|------|---------------|---------|
| guardspine-kernel | `D:\Projects\guardspine-kernel` | OSS trust anchor (schemas + seal + verify) |
| guardspine-adapter-webhook | `D:\Projects\guardspine-adapter-webhook` | Universal webhook integration |
| guardspine-local-council | `D:\Projects\guardspine-local-council` | Ollama-based local council |
| rlm-docsync | `D:\Projects\rlm-docsync` | OSS self-updating docs with proofs (Apache 2.0) |

### OSS/Private Boundary
- **OSS = Truth layer**: "What happened?" (provenance, specs, verification, adapters)
- **Private = Judgment layer**: "What should we do about it?" (packs, compression, queues, org, council)
- **Mixed = Distribution**: thin OSS core + private upgrade (n8n nodes)

---

## Phase 1: n8n Integration Foundation (Original 60 Beads)

### Phase 1.1-1.4: Core Hook Alignment

#### GS-1.1: Fix hooks evaluate URL to match backend [CLOSED]
- **Project**: `D:\Projects\n8n-nodes-guardspine`
- **File**: `hooks/guardspine-hooks.ts`
- Update hooks to call `/api/v1/policies/evaluate` with `EvaluationRequest(artifact_id, artifact_kind, content, pack_ids)`

#### GS-1.2: Add LLM env vars to docker-compose [CLOSED]
- Add `OPENROUTER_API_KEY`, `GUARDSPINE_BACKEND`, `GUARDSPINE_MODEL`, `OLLAMA_BASE_URL`

#### GS-1.3: Rewrite mock-api to match real API schemas [CLOSED]
- **File**: `mock-api/server.js`
- Match `EvaluationResult` shape from backend `policy_schemas.py`

#### GS-1.4: Fix hooks postExecute bundle creation [CLOSED]
- **File**: `hooks/guardspine-hooks.ts`
- Create evidence bundles matching real `/bundles` router schema

### Phase 2: Risk Classification

#### GS-2.1: L0-L4 dynamic classification in hooks [CLOSED]
- Backend `classifier.py` uses fnmatch path patterns
- `GUARDSPINE_CLASSIFICATION` env var (auto|L0|L1|L2|L3|L4)

#### GS-2.2: Hooks respect escalation_level for blocking [CLOSED]
- Compare `escalation_level` from response against `GUARDSPINE_RISK_THRESHOLD`

### Phase 3: LLM Routing

#### GS-3.1: LLM backend routing via hooks env vars [CLOSED]
- `GUARDSPINE_BACKEND` and `GUARDSPINE_MODEL` env vars
- Backend adapters: `openrouter_adapter.py`, `ollama_adapter.py`, `litellm_adapter.py`

#### GS-3.2: Verify OpenRouter adapter integration
- Test with `anthropic/claude-sonnet-4.5`, `openai/gpt-4o`, `openrouter/auto`

### Phase 4: Beads Lifecycle

#### GS-4.1: Beads lifecycle in preExecute hook [CLOSED]
- POST `/api/v1/beads/tasks` with `status=open`
- Store `bead_id` in `executionContext` Map

#### GS-4.2: Beads lifecycle in postExecute hook [CLOSED]
- Update bead `status=completed` or `status=failed`
- Attach evidence via PUT `/api/v1/beads/tasks/{id}/evidence`

#### GS-4.3: Approval callback updates bead status [CLOSED]
- Approval granted -> bead `blocked -> in_progress`
- Approval rejected -> bead `rejected`

#### GS-4.4: Wire nomotic interrupts to bead blockers
- `mandatory_review(72h)` creates approval + blocks bead
- `escalation(24h)` creates notification + blocks bead
- `block(auto)` immediately blocks bead

### Phase 5: Approval Flow

#### GS-5.1: Approval flow on workflow save [CLOSED]
- POST `/approvals` with `artifact_id, risk_tier, required_approvers, reason`

#### GS-5.2: Approval webhook callback to n8n [CLOSED]
- Include `callback_url` pointing to n8n webhook endpoint

#### GS-5.3: Enhance diff postcard rendering
- Color-coded diffs, risk badges, approve/reject buttons

### Phase 6: Nomotic Interrupts

#### GS-6.1: Nomotic interrupt evaluation in backend
- Trigger patterns from `nomotic.yaml`
- Response includes `interrupts_triggered` array

#### GS-6.2: Hooks surface nomotic interrupts
- Block-type in enforce mode -> throw
- `mandatory_review` -> create approval with 72h timeout
- `escalation` -> fire notification

### Phase 7: Testing

#### GS-7.1: Install nock and set up HTTP mocking [CLOSED]
#### GS-7.2: Test hooks preExecute lifecycle [CLOSED]
#### GS-7.3: Test hooks postExecute lifecycle [CLOSED]
#### GS-7.4: Test beads lifecycle [CLOSED]
#### GS-7.5: Test nomotic interrupts
#### GS-7.6: Test approval webhook callback [CLOSED]

### Phase 8: Multi-Artifact

#### GS-8.1: detectArtifactKind() for multi-lane routing [CLOSED]
- `ArtifactKind = 'code' | 'pdf' | 'xlsx' | 'image'`

### Phases 9-16: Approval UI, Board Packets, Connectors, Evidence, Nomotic, Council, Telemetry, Dashboard
(See beads database for full detail on GS-9.x through GS-16.x)

### Risk Pre-Mortems
- GS-RISK-1: Backend not running (graceful degradation)
- GS-RISK-2: OpenRouter key missing (fallback to Ollama)
- GS-RISK-3: Approval timeout hangs workflow (auto-expire)
- GS-RISK-4: Mock API diverges from real API (schema validation)
- GS-RISK-5: Redundant n8n nodes (deprecate 5, keep 2)

---

## Phase K: Kernel Extraction (CRITICAL PATH)

**Goal**: Extract trust-anchor primitives from FastAPI monolith into standalone OSS package

### GS-K1: Kernel Contract Definition (P0)
- **Project**: `D:\Projects\GuardSpine`
- **Files**: `app/core/schemas/evidence.py`, `app/core/schemas/policy.py`, `app/services/evidence_service.py`
- **Deliverable**: JSON Schema + TypeScript types for evidence bundle
- **Acceptance**: Schema validates against all 144 existing tests

### GS-K2: Kernel Package Creation (P0) [blocked by K1]
- **Project**: `D:\Projects\guardspine-kernel` (NEW)
- **Files**: `src/schemas/evidence-bundle.schema.json`, `src/verify.ts`, `src/seal.ts`
- **Deliverable**: npm package `@guardspine/kernel`
- **Acceptance**: Create and verify bundles without FastAPI backend

### GS-K3: Monolith Dependency Inversion (P1) [blocked by K2]
- **Project**: `D:\Projects\GuardSpine`
- **Files**: `app/services/evidence_service.py`, `app/services/bundle_service.py`
- **Acceptance**: All 144 tests still pass after refactor

---

## Phase A: Adapter Pattern (OSS Integration Paths)

**Goal**: Create universal integration adapters that don't depend on n8n

### GS-A1: Webhook Adapter Package (P1) [blocked by K2]
- **Project**: `D:\Projects\guardspine-adapter-webhook` (NEW)
- **Files**: `src/webhook-handler.ts`, `src/bundle-emitter.ts`, `examples/github-webhook.ts`
- **Acceptance**: Receive GitHub webhook, emit evidence bundle

### GS-A2: CLI Adapter Enhancement (P2)
- **Project**: `D:\Projects\GuardSpine\open-source\guardspine-verify`
- Add `src/create-bundle.ts`, `src/submit-bundle.ts`

### GS-A3: Adapter Documentation (P2)
- **Project**: `D:\Projects\GuardSpine\open-source\guardspine-connector-template`
- **Files**: `docs/ADAPTER-SPEC.md`, `docs/INTEGRATION-PATTERNS.md`

---

## Phase L: L0-L4 Progressive Disclosure

**Goal**: 3-tier UI defaults with 5-tier engine capability

### GS-L1: Tier Mapping Schema (P1)
- **Project**: `D:\Projects\GuardSpine`
- **File**: `app/core/schemas/tier_mapping.py`
- Schema: `AUTO=[L0,L1], REVIEW=[L2], BLOCK=[L3], L4=enterprise-only`

### GS-L2: Progressive Disclosure API (P2) [blocked by L1]
- Add `?tier_mode=simple|advanced` to `/api/v1/policies`

### GS-L3: Frontend Tier Selector (P2) [blocked by L2]
- **Project**: `D:\Projects\life-os-frontend`
- **File**: `src/components/TierSelector.tsx`

---

## Phase C: Council Split (OSS Local + Paid Cloud)

### GS-C1: Local Council Package (P1)
- **Project**: `D:\Projects\guardspine-local-council` (NEW)
- **Files**: `src/council.ts`, `src/providers/ollama.ts`, `src/aggregator.ts`

### GS-C2: Council Interface Abstraction (P2) [blocked by C1]
- **Project**: `D:\Projects\guardspine-product`
- Extract `ICouncil` interface

### GS-C3: Cloud Council Premium Features (P3) [blocked by C2]
- Feature matrix: Local vs Cloud (Byzantine voting, calibration, SLAs)

---

## Phase E: Compression / Attention Routing (SCALE MOAT)

### GS-E1: Compression Engine Module (P0)
- **Project**: `D:\Projects\guardspine-product`
- **Files**: `compression/drift_windows.py`, `compression/bead_packer.py`, `compression/queue_router.py`
- **Acceptance**: Compress 1000 events into 10 decision items

### GS-E2: Compression API Endpoints (P1) [blocked by E1]
- **Project**: `D:\Projects\GuardSpine`
- **File**: `app/api/v1/compression.py`
- Endpoints: `/compress/window`, `/compress/queue`, `/compress/stats`

### GS-E3: Compression Metrics Dashboard (P2) [blocked by E2]
- **Project**: `D:\Projects\life-os-frontend`
- **File**: `src/pages/CompressionDashboard.tsx`

### GS-E4: Attention Budget Allocation Algorithm (P1) [blocked by E1]
- **Project**: `D:\Projects\guardspine-product`
- **File**: `compression/attention_budget.py`
- Zero L3/L4 items missed under budget

### GS-E5: n8n Compression Node (P2)
- **Project**: `D:\Projects\n8n-nodes-guardspine`
- **File**: `nodes/GuardSpineCompress/GuardSpineCompress.node.ts`

---

## Phase N: Nomotic Standards Evolution (Meta-Governance)

**Insight**: "Governing rule sets is the real organizational problem"

### GS-N1: Nomotic Pack Versioning (P0)
- **Project**: `D:\Projects\guardspine-product`
- Git-like versioning, policy PRs, diff views, evidence bundles for policy changes
- Makes GuardSpine "standards evolution infrastructure"

### GS-N2: Rollout Modes (P1) [blocked by N1]
- Shadow (7d) -> Warn (7d) -> Enforce (with rollback)

### GS-N3: Policy Diff + Meta-Governance Bundles (P1) [blocked by N1]
- Policy changes produce evidence bundles (governance governs itself)

---

## Phase R: Repo Restructure

### GS-R1: OSS Repo Audit (P2)
- LICENSE, CONTRIBUTING.md, README compliance for all OSS repos

### GS-R2: Private Repo Consolidation (P2)
- All premium features in `guardspine-product`

### GS-R3: n8n Mixed Model (P2) [blocked by R1, R2]
- `nodes/core/` (OSS) + `nodes/premium/` (upgrade)

---

## Phase I: Investor Artifacts

### GS-I1: Architecture One-Pager (P3) [blocked by R3]
### GS-I2: Trust Inversion Case Study (P3) [blocked by I1]
### GS-I3: Competitive Moat Analysis (P3) [blocked by I2]

---

## Phase P: Positioning (Context Infrastructure / Entropy Control)

### GS-P1: Reposition Messaging (P0)
- **Headline**: "Architecture rots because context rots."
- **Category**: Entropy control for AI-accelerated production
- Affects: Homepage, Product pages, Investor docs

### GS-P2: Compression Demo Centerpiece (P1) [blocked by P1]
- Before: 2,400 logs + 180 alerts -> After: 12 decision items

### GS-P3: RAG as Product Proof (P2)
- Query sample evidence bundles through Explore chat

---

## Phase W: Website Architecture (dnyoussef.com)

**Goal**: Product primary, consulting secondary. Two-lane router.

### GS-W1: Homepage Two-Lane Router (P0) [blocked by P1]
- **Project**: `D:\Projects\dnyoussef-portfolio`
- **Files**: `src/pages/index.astro`, `src/components/Hero.astro`
- Engineer CTA (Install) + Leader CTA (Assess Fit) + 3 value blocks

### GS-W2: Product Nav Section (P1)
- **Files**: `src/components/Header.astro` + `src/pages/product/*.astro`
- Nav: Product / Docs / Explore / Assess / Insights / Artifacts / Consulting

### GS-W3: Explore RAG Two-Mode (P1) [blocked by W2]
- **Files**: `src/components/ExploreChat.tsx`, `data/guardspine_corpus.json`

### GS-W4: Assess Fit Branching (P2) [blocked by W2]
- **File**: `src/components/DiagnosticWizard.tsx`

### GS-W5: Artifacts Split (P2) [blocked by W2]
- **File**: `src/pages/artifacts.astro`

### GS-W6: Blog Sticky CTA + Start Here (P2) [blocked by W2]
- **Files**: `src/pages/insights/index.astro`, `src/layouts/PostLayout.astro`

---

## Phase D: Contractor Artifacts

### GS-D1: OSS Boundary Doc (P0)
- **Project**: `D:\Projects\guardspine-product`
- **File**: `docs/OSS-BOUNDARY.md`
- 7 no-exceptions rules (R0-R6) + repo-by-repo spec

### GS-D2: Evidence Pack Template (P0)
- **Project**: `D:\Projects\GuardSpine\open-source\guardspine-spec`
- **Files**: `templates/evidence-pack/` (manifest.json, human-summary.md, verification.md)

### GS-D3: CI Leak-Check Job (P1) [blocked by D1]
- `.github/workflows/oss-boundary-check.yml` on all OSS repos

### GS-D4: Open-Core Contract Page (P2) [blocked by D1]
- **Project**: `D:\Projects\dnyoussef-portfolio`
- **File**: `src/pages/product/open-core.astro`

---

## Phase M: Marketing Loop

### GS-M1: Substrate-First Funnel (P1)
- Content -> Install -> First Bundle -> Verify -> Habit -> Org -> Enterprise
- KPI/Counter-KPI pairs

### GS-M2: Install-First Blog Posts (P2)
- 3 posts: PR to Evidence Bundles, Webhook Governance, Compression/Attention Routing

---

## Phase S: RLM DocSync + Semantic Impact Engine (14 beads)

> **Core Insight**: RLMs (Recursive Language Models) treat the codebase as an external environment
> the model can programmatically inspect, decompose, and recursively query -- not stuff into context.
> This enables two killer features: self-updating documentation and semantic impact analysis.
> Both produce Evidence Packs, making the AI's inspection path auditable.
>
> **OSS Strategy**: Open-source `rlm-docsync` (claim schema + runner + minimal adapters).
> Keep compression/queues/org-policy/approvals private. "Self-updating docs" is the adoption hook.
>
> **Reference**: arxiv.org/abs/2512.24601 (Zhang, Kraska, Khattab -- MIT OASYS Lab)
> Official library: github.com/alexzhang13/rlm (Apache 2.0, pluggable backends + sandboxes)

### GS-S1: DocSync Engine - RLM-powered nightly doc sync runner (P0) [blocked by S5, S6, S9]
- **Project**: `D:\Projects\guardspine-product` or new `rlm-docsync` repo
- Nightly scheduled runner using `rlm` library
- Two modes: spec-first (alerts violations) / reality-first (proposes doc PRs)
- Produces Doc Evidence Packs with access receipts, rule receipts, test receipts
- Budget-capped recursion (max files, steps, tokens per run)

### GS-S2: guardspine.docs.yaml manifest spec (P0) [unblocked -- start here]
- Per-doc manifest: `doc_id`, `path`, `mode` (spec|reality), `coverage` (paths/tags)
- `allowed_updates` (sections AI may edit), `required_tests`, `owners`, `escalation_policy`
- This is the control plane -- no doc gets synced without a manifest entry

### GS-S3: Doc claim extraction module (P1) [blocked by S2]
- Parse docs into structured claims (API contracts, invariants, workflows, config defaults)
- Each claim gets a stable `claim_id`
- Supports markdown, YAML, OpenAPI sources

### GS-S4: RLM Code Environment adapter (P0) [blocked by S14]
- Build `CodeEnvironment` extending `rlm` `BaseEnv`
- Loads: `repo_tree`, `symbols_table` (tree-sitter), `call_graph`, `test_map`, `ownership_map`
- Provides tools: `grep`, `read_file`, `ast_query`, `callers`, `callees`
- Every tool call emits an access receipt (logged by S14)

### GS-S5: RLM inspection loop with budgeted recursion (P1) [blocked by S3, S4]
- For each doc claim: retrieve evidence slices, confirm/refute
- Recursively broaden retrieval if ambiguous
- Budget caps: max files, max steps, max tokens
- Emit `supporting_evidence[]` with hashes and anchors per claim

### GS-S6: Doc Evidence Pack schema + emission (P2) [unblocked -- start here]
- Schema: `doc_id`, `doc_version_hash`, `mode`, `claim_results[]`
  - Per claim: `claim_id`, `status` (supported|violated|ambiguous), `evidence_refs[]`, `proposed_patch_ref`, `risk_tier`
- `tests[]`: command, exit, log_hash, artifacts
- `inspection_trace_digest`: hash of retrieval steps
- Signs and seals as standard Evidence Bundle extension

### GS-S7: Spec-first violation alerting (P2) [blocked by S5, S6]
- When `mode=spec`: mismatches become violations, not edits
- Emit Spec Violation Alert Pack: severity, remediation (update code / update spec w/ owner override / add exception w/ expiry)
- Route to L2/L3 approval

### GS-S8: Reality-first doc PR generation (P2) [blocked by S5, S6]
- When `mode=reality`: propose doc edits as PR with citations
- Every changed statement cites evidence refs
- Protected sections (security, compliance) require L3+
- Never auto-merge

### GS-S9: Test/dry-run execution + log capture (P2) [unblocked]
- Execute `required_tests` declared per doc in `guardspine.docs.yaml`
- Capture: command, env, tool versions, stdout/stderr (hashed), exit codes, artifacts
- Attach as test receipts in Doc Evidence Pack

### GS-S10: Nightly cron scheduler + CI integration (P2) [blocked by S1]
- GitHub Actions: nightly 2am UTC, on-demand via PR label, pre-release via tag
- Summary comment on PRs, dashboard webhook for org view

### GS-S11: rlm-docsync OSS repo scaffold (P0) [blocked by S2, S6]
- **New repo**: `rlm-docsync` (Apache 2.0)
- Contains: doc claim schema, RLM runner interface, Evidence Pack schema + signing
- Minimal adapters: Code (AST + grep), Markdown
- CLI: `docsync run`, `docsync verify`
- Clear statement: does NOT include compression/queues/org policy/approvals
- "Self-updating documentation with proofs" is the adoption hook

### GS-S12: Semantic Impact Engine (SIE) - RLM diff analysis (P0) [blocked by S4]
- Input: diff (PR) or document delta
- RLM inspects repo-as-environment: call graph, test map, ownership
- Output: Impact Pack: impacted surfaces, downstream paths, risk deltas (L0-L4), recommended reviewers
- Every claim includes snippet hash + file:line
- Feeds into CouncilVote and Compression layers
- Plugs into existing flow: CodeGuard -> SIE -> CouncilVote -> Compression -> ApprovalWait

### GS-S13: PDF/Sheet/Slide environment adapters (P3) [blocked by S4]
- PDF: PyMuPDF section tree + citation anchors + defined terms
- Sheet: openpyxl formula DAG + downstream totals + external links
- Slide: python-pptx text blocks + speaker notes + chart metadata
- Each adapter implements `BaseEnv` with domain-specific tools

### GS-S14: Access receipt logging for RLM environment (P1) [unblocked -- start here]
- Every environment tool call emits: `access_receipt(artifact_id, snippet_hash, range, timestamp, purpose_tag)`
- Rule receipts: `(rule_id, version, severity, triggered_on_hashes[])`
- Decision receipts: `(proposed_action_hash, diff_hash, risk_tier, approver, outcome)`
- These become the proof trail in Evidence Bundles -- the audit moat

### Phase S Dependency Graph
```
UNBLOCKED (start in parallel):
  GS-S2 (manifest spec)
  GS-S6 (evidence pack schema)
  GS-S9 (test execution)
  GS-S14 (access receipt logging)

CHAIN 1 (DocSync):
  S2 -> S3 (claims) -+
  S14 -> S4 (env) ---+-> S5 (inspection) -+-> S7 (spec alerts)
                     |                    +-> S8 (reality PRs)
                     +-> S12 (SIE)
                     +-> S13 (multi-artifact adapters)

CHAIN 2 (Engine assembly):
  S5 + S6 + S9 -> S1 (DocSync Engine) -> S10 (nightly cron)

CHAIN 3 (OSS):
  S2 + S6 -> S11 (rlm-docsync OSS repo)
```

---

## Full Dependency Graph

```
CRITICAL PATH (P0 - start now, parallel):
  GS-P1 (Positioning) ------> GS-W1 (Homepage) ----> GS-W2 (Nav) ---> W3,W4,W5,W6
                          +--> GS-P2 (Demo)

  GS-K1 (Kernel Contract) --> GS-K2 (Package) --> GS-K3 (Inversion)
                                    +--> GS-A1 (Webhook Adapter)

  GS-E1 (Compression) --> GS-E2 (API) --> GS-E3 (Dashboard)
                      +--> GS-E4 (Attention Budget)

  GS-N1 (Nomotic Versioning) --> GS-N2 (Rollout) + GS-N3 (Meta-Gov)

  GS-D1 (OSS Boundary) --> GS-D3 (CI Check) + GS-D4 (Open-Core Page)
  GS-D2 (Evidence Pack Template) [parallel]

SECONDARY CHAINS:
  GS-L1 --> GS-L2 --> GS-L3 (Progressive Disclosure)
  GS-C1 --> GS-C2 --> GS-C3 (Council Split)
  GS-R1 + GS-R2 --> GS-R3 --> GS-I1 --> GS-I2 --> GS-I3 (Investor)
  GS-M1 + GS-M2 (Marketing, parallel)

RLM DOCSYNC + SIE CHAINS:
  GS-S2 (manifest) ------> GS-S3 (claims) ---+
  GS-S14 (receipts) --> GS-S4 (code env) -----+-> GS-S5 (inspection) -> S7 (alerts) + S8 (PRs)
                                    +----------+-> GS-S12 (SIE)
                                    +----------+-> GS-S13 (multi-artifact)
  GS-S5 + S6 + S9 --> GS-S1 (engine) --> GS-S10 (nightly cron)
  GS-S2 + S6 --> GS-S11 (rlm-docsync OSS repo)

ORIGINAL n8n CHAINS:
  GS-1.x through GS-16.x (see beads database)
```

---

## Bead Summary

| Phase | Count | Purpose | Priority |
|-------|-------|---------|----------|
| 1-16 (n8n Integration) | 60 | Hook alignment, beads, approval, testing | P0-P3 |
| K (Kernel) | 3 | OSS trust anchor extraction | P0-P1 |
| A (Adapters) | 3 | n8n-independent integration | P1-P2 |
| L (L0-L4) | 3 | Progressive disclosure | P1-P2 |
| C (Council) | 3 | Local vs Cloud split | P1-P3 |
| E (Compression) | 5 | Scale moat | P0-P2 |
| N (Nomotic) | 3 | Meta-governance | P0-P1 |
| R (Repos) | 3 | OSS/private boundary | P2 |
| I (Investor) | 3 | Pitch artifacts | P3 |
| P (Positioning) | 3 | Context infra / entropy control | P0-P2 |
| W (Website) | 6 | Two-lane router | P0-P2 |
| D (Contractor) | 4 | OSS boundary + evidence pack | P0-P2 |
| M (Marketing) | 2 | Substrate-first funnel | P1-P2 |
| S (RLM DocSync + SIE) | 14 | Self-updating docs, semantic impact, OSS repo | P0-P3 |
| **TOTAL** | **115** | | |

**P0 Critical Path (8 beads, run in parallel):**
1. GS-P1 - Reposition messaging (context infra, not governance)
2. GS-K1 - Kernel contract extraction
3. GS-E1 - Compression engine (scale moat)
4. GS-N1 - Nomotic pack versioning (meta-governance)
5. GS-D1 - OSS Boundary Doc (contractor artifact)
6. GS-D2 - Evidence Pack Template (kernel-level)
7. GS-W1 - Homepage router [blocked by P1]
8. GS-K2 - Kernel package [blocked by K1]

---

## Thesis Mapping

| Claim | GuardSpine Component |
|-------|---------------------|
| "Lost context = real failure mode" | Evidence Chain + Beads Spine |
| "AI enforces consistent rules at scale" | Policy Engine + Nomotic Packs |
| "Humans can't hold cathedral + brick" | Council + L0-L4 Escalation |
| "Vigilance without fatigue" | Compression / Attention Routing |
| "Context engineering > model intelligence" | OSS Kernel = context capture infra |
| "Governing rule sets is the real problem" | Nomotic versioning (meta-governance) |
| "Rules repository for AI" | Nomotic YAML DSL + pack library |
| "Out-of-core agents need audit trails" | RLM access receipts + Evidence Bundles |
| "Docs drift is entropy" | DocSync nightly + spec/reality modes |
| "Semantic impact, not just line diffs" | Semantic Impact Engine (SIE) via RLM |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Kernel extraction | FastAPI imports from `@guardspine/kernel` |
| OSS boundary clarity | Zero premium code in public repos |
| Progressive disclosure | Demo: simple + advanced mode toggle |
| Local council | Run council with Ollama only |
| Compression | `/compress/*` endpoints live, 1000:10 ratio |
| Meta-governance | Policy changes produce evidence bundles |
| Website conversion | Two-lane router live, install CTA above fold |
| Investor artifacts | One-pager + case study + moat doc |
| DocSync nightly | Zero manual doc updates; drift detected within 24h |
| rlm-docsync OSS | GitHub stars + forks as adoption signal |
| SIE accuracy | Impact Pack catches downstream breaks missed by line-diff |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Kernel extraction breaks tests | Phased rollout, shadow mode first |
| n8n dependency lock-in | Webhook adapter as primary PLG path |
| Local council quality | Document "best effort" vs cloud SLA |
| Compression complexity | Start with simple time windows |
| OSS fork risk | Clear premium value, Local Council option |
| False activation (Goodhart) | Counter-KPIs on every metric |
| Context rot continues | Adapters-first distribution |
