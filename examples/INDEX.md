# GuardSpine n8n Workflow Examples - Index

This directory contains production-ready n8n workflow examples demonstrating the GuardSpine custom nodes integration.

## Files in This Directory

### 1. content-pipeline.json (6.7 KB, 266 lines)
**Type**: n8n Workflow Definition (JSON)
**Status**: Template/Example - Ready for import

The main dogfood workflow that migrates the content automation pipeline to n8n using GuardSpine nodes.

**Contains**:
- 8 nodes with complete configuration
- 3 GuardSpine custom nodes (GuardGate, ApprovalWait, EvidenceSeal)
- 5 standard n8n nodes (Cron, ExecuteCommand x3)
- Full connection routing with conditional logic
- Metadata for node requirements and credentials

**Import Process**:
1. Copy the full JSON content
2. Open n8n web interface
3. Create new workflow
4. Use "Import" function to paste JSON
5. Configure credentials and parameters
6. Activate when ready

### 2. README.md (8.3 KB, 205 lines)
**Type**: Documentation
**Purpose**: Comprehensive workflow guide

Detailed documentation covering:
- Workflow overview and purpose
- Step-by-step breakdown of all 8 nodes
- Node types and configurations
- Visual ASCII diagram of workflow flow
- Prerequisites and setup instructions
- Import procedure
- Customization options
- Node requirements

**Audience**: Developers, DevOps engineers, workflow designers

### 3. WORKFLOW-QUICK-REFERENCE.md (5.3 KB, 182 lines)
**Type**: Quick Reference Card
**Purpose**: At-a-glance workflow information

Quick lookup guide including:
- Compact execution flow diagram
- Node details table
- Configuration checklist (before/during/after import)
- Exit points and stop conditions
- Customization parameters with ranges
- Success metrics and KPIs
- Failure points to monitor
- Troubleshooting guide
- Version history

**Audience**: Operations, DevOps, workflow operators, QA

### 4. council-vote-13-persona.json
**Type**: n8n Workflow Definition (JSON)
**Status**: Template/Example - Sub-Workflow

13-persona Byzantine consensus voting workflow. Fan-out to all personas across Claude/Gemini/Codex, collect votes, apply 2/3 Byzantine threshold. Called as sub-workflow by Guard Lane Evaluation for L4 decisions.

**Contains**:
- 8 nodes: trigger, fan-out, HTTP eval, vote parser, consensus calculator, router, pass/block outputs
- Byzantine 2/3 threshold with cross-model agreement tracking
- SHA-256 evidence hash of all votes
- Designed as Execute Workflow Trigger (callable sub-workflow)

### 5. guard-lane-evaluation.json
**Type**: n8n Workflow Definition (JSON)
**Status**: Template/Example - Webhook-triggered

Evaluates artifacts through the 5 guard lanes (CommsGuard, TicketGuard, DealGuard, ContractGuard, DeployGuard). Applies static risk tier rules + payload-based dynamic escalation. Routes to L0 auto-approve, L1 audit, L2/L3 human approval, or L4 council vote.

**Contains**:
- 9 nodes: webhook trigger, risk evaluation, 4-way switch, L0-L4 handlers, merge, respond
- All 5 guard lane rule sets with payload escalation logic
- Sub-workflow call to Council Vote for L4 decisions
- ApprovalWait node for L2/L3 human approvals

### 6. department-loop-orchestrator.json
**Type**: n8n Workflow Definition (JSON)
**Status**: Template/Example - Sub-Workflow

Orchestrates evaluation across all 24 departments in 7 categories. Fan-out to department APIs, aggregate findings, detect critical issues, escalate to guard lanes when needed.

**Contains**:
- 7 nodes: trigger, fan-out, HTTP eval, aggregator, critical check, escalate/clear outputs
- All 24 departments mapped by category
- KPI and counter-KPI tracking per department
- Auto-escalation to guard lanes on critical findings

### 7. INDEX.md (this file)
**Type**: Directory Index
**Purpose**: Navigation and file overview

## Workflow Specifications

**Workflow Name**: Content Pipeline with GuardSpine
**Version**: 1.0.0
**Release Date**: 2026-01-27
**Status**: Template/Example - Ready for Import

## Node Architecture

```
┌─────────────────────────────────────────┐
│ Cron Trigger (Weekly Sunday 2am)        │
└──────────────┬──────────────────────────┘
               ↓
┌──────────────────────────────────────────┐
│ Execute: YouTube Download (yt-dlp)      │
└──────────────┬──────────────────────────┘
               ↓
┌──────────────────────────────────────────┐
│ Execute: Whisper Transcription          │
└──────────────┬──────────────────────────┘
               ↓
┌──────────────────────────────────────────┐
│ GuardGate: Slop Detection [QUALITY]     │
│ ├─ Pass  → Continue                    │
│ └─ Block → STOP                        │
└──────────────┬──────────────────────────┘
               ↓
┌──────────────────────────────────────────┐
│ Execute: Claude Draft Generation        │
└──────────────┬──────────────────────────┘
               ↓
┌──────────────────────────────────────────┐
│ ApprovalWait: Editorial Review [APPROVAL]│
│ ├─ Approved → Continue                 │
│ └─ Rejected → STOP                     │
└──────────────┬──────────────────────────┘
               ↓
┌──────────────────────────────────────────┐
│ Execute: Git Commit & Push              │
└──────────────┬──────────────────────────┘
               ↓
┌──────────────────────────────────────────┐
│ EvidenceSeal: Pipeline Completion [SEAL]│
└──────────────────────────────────────────┘
```

## GuardSpine Nodes Used

1. **GuardGate** (Quality Gate)
   - Position: Step 4
   - Guard Type: slop-detector
   - Rubric Pack: content-quality
   - Artifact Type: text
   - Block Tier: 3
   - Dual Output: Pass/Block

2. **ApprovalWait** (Approval Workflow)
   - Position: Step 6
   - Guard Type: approval-workflow
   - Risk Tier: 2
   - Timeout: 1440 minutes (24 hours)
   - Dual Output: Approved/Rejected

3. **EvidenceSeal** (Compliance Sealing)
   - Position: Step 8
   - Seal Type: compliance
   - Policy Reference: content-pipeline-v1
   - Retention: 90 days
   - Purpose: Audit trail and compliance record

## Key Features

- **Quality Gates**: 2 blocking points ensure content meets standards
- **Approval Workflow**: Human-in-the-loop editorial review
- **Compliance Sealing**: Full audit trail with evidence capture
- **Modular Design**: Each step can be modified independently
- **Standard n8n Nodes**: Uses common executable and trigger nodes
- **Placeholder Commands**: Ready for real environment configuration

## Getting Started

### Quick Start (5 minutes)

1. **Read**: Start with `README.md` (comprehensive guide)
2. **Review**: Check `WORKFLOW-QUICK-REFERENCE.md` (quick facts)
3. **Import**: Copy JSON from `content-pipeline.json` into n8n
4. **Configure**: Update credentials and parameters
5. **Activate**: Turn workflow on when ready

### Deep Dive (30 minutes)

1. Read the full README.md
2. Study the node configuration in content-pipeline.json
3. Review the WORKFLOW-QUICK-REFERENCE.md for customization
4. Set up test environment
5. Run first test execution
6. Monitor and adjust thresholds

## Use Cases

This workflow template is suitable for:

- Content automation from video to blog post
- Multi-stage quality verification pipelines
- Editorial review workflows
- Compliance-audited automation
- Media processing workflows
- Documentation generation
- Any workflow requiring quality gates + approvals

## Customization

All configuration parameters can be adjusted:

- **Schedule**: Change cron expression for different timing
- **Quality Thresholds**: Adjust blockTier and thresholdScore
- **Approval Timeout**: Set different timeout for approvals
- **Stakeholders**: Add/remove approval reviewers
- **Commands**: Replace placeholder commands with real ones
- **Policies**: Reference different compliance policies

See WORKFLOW-QUICK-REFERENCE.md for specific parameter ranges.

## Prerequisites

Before importing:

- n8n instance with GuardSpine nodes installed
- GuardSpine API credentials configured
- Command-line tools: yt-dlp, whisper, git
- Claude API key for draft generation
- Edit team with approval capabilities

## File Details

| File | Size | Lines | Type | Purpose |
|------|------|-------|------|---------|
| content-pipeline.json | 6.7K | 266 | JSON | Workflow definition |
| README.md | 8.3K | 205 | Markdown | Full documentation |
| WORKFLOW-QUICK-REFERENCE.md | 5.3K | 182 | Markdown | Quick reference |
| INDEX.md | this | ~ | Markdown | File index |

## Version Control

**Current Version**: 1.0.0
**Last Updated**: 2026-01-27
**Status**: Template/Example - Ready for Import
**Maintainer**: n8n-nodes-guardspine project

## Next Steps

1. Import `content-pipeline.json` into n8n
2. Configure GuardSpine API credentials
3. Update placeholder values for your environment
4. Test each node individually
5. Run complete workflow in dry-run mode
6. Monitor first production execution
7. Adjust parameters based on results

## Support

- n8n Documentation: https://docs.n8n.io/
- GuardSpine Nodes: See node documentation
- Content Pipeline: David Youssef portfolio
- Issues: Report via project issue tracker

## Related Projects

- n8n-nodes-guardspine (main project)
- GuardSpine quality analysis system
- David Youssef portfolio website
- Content automation pipeline

---

**Created**: 2026-01-27
**Status**: Ready for Use
**License**: MIT (or as specified by GuardSpine project)
