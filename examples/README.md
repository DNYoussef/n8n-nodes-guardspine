# GuardSpine n8n Workflow Examples

This directory contains example n8n workflows demonstrating the GuardSpine custom nodes for workflow automation with compliance, quality gates, and evidence sealing.

## Workflows

### content-pipeline.json

A complete dogfood workflow that migrates the content automation pipeline to n8n using GuardSpine nodes.

**Purpose**: Demonstrates end-to-end content generation from YouTube videos to published blog posts, with integrated quality gates and approval workflows.

**Workflow Steps**:

1. **Cron Trigger** (1-cron-trigger)
   - Type: `n8n-nodes-base.cron`
   - Schedule: Weekly, Sunday 2:00 AM
   - Initiates the weekly content pipeline run

2. **YouTube Download** (2-youtube-download)
   - Type: `n8n-nodes-base.executeCommand`
   - Tool: yt-dlp
   - Extracts audio from YouTube video and converts to MP3
   - Command: `yt-dlp -f 'best[ext=mp4]' ... --audio-format mp3`

3. **Whisper Transcription** (3-whisper-transcription)
   - Type: `n8n-nodes-base.executeCommand`
   - Tool: OpenAI Whisper
   - Transcribes MP3 audio to text with JSON output
   - Command: `whisper 'downloaded_video.mp3' --model base --output_format json`

4. **GuardGate: Slop Detection** (4-slop-detection-gate)
   - Type: `@guardspine/n8n-nodes-guardspine.guardGate`
   - Purpose: Quality gate for transcript quality
   - Configuration:
     - `guardType`: slop-detector
     - `rubricPack`: content-quality
     - `artifactType`: text
     - `blockTier`: 3
     - `thresholdScore`: 0.7
   - **Output Routing**:
     - Pass (index 0) → Continue to step 5
     - Block (index 1) → Stop pipeline (no connection)

5. **Claude Draft Generation** (5-claude-draft-generation)
   - Type: `n8n-nodes-base.executeCommand`
   - Tool: Claude API
   - Generates blog post draft from transcript
   - Uses Anthropic API endpoint

6. **ApprovalWait: Editorial Review** (6-approval-wait)
   - Type: `@guardspine/n8n-nodes-guardspine.approvalWait`
   - Purpose: Human-in-the-loop approval workflow
   - Configuration:
     - `guardType`: approval-workflow
     - `riskTier`: 2
     - `summary`: "Editorial review for blog draft"
     - `timeoutMinutes`: 1440 (24 hours)
   - **Output Routing**:
     - Approved (index 0) → Continue to step 7
     - Rejected (index 1) → Stop pipeline (no connection)

7. **Git Commit & Push** (7-git-commit-push)
   - Type: `n8n-nodes-base.executeCommand`
   - Purpose: Version control and deployment
   - Command: `git add content/ && git commit ... && git push origin main`

8. **EvidenceSeal: Pipeline Completion** (8-evidence-seal)
   - Type: `@guardspine/n8n-nodes-guardspine.evidenceSeal`
   - Purpose: Compliance and audit trail sealing
   - Configuration:
     - `policyRef`: content-pipeline-v1
     - `sealType`: compliance
     - `retentionDays`: 90
   - Captures execution metadata for compliance records

**Workflow Architecture**:

```
┌─────────────────────────────────────────────┐
│ Cron Trigger (Sunday 2am)                   │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│ Execute: YouTube Download                   │
│ (yt-dlp)                                    │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│ Execute: Whisper Transcription              │
│ (OpenAI Whisper)                            │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────┐
│ GuardGate: Slop Detection                        │
│ ├─ Pass ──> Continue                            │
│ └─ Block ──> STOP                               │
└────────────────────┬─────────────────────────────┘
                     │ (Pass)
┌────────────────────▼────────────────────────┐
│ Execute: Claude Draft Generation            │
│ (Claude API)                                │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│ ApprovalWait: Editorial Review                  │
│ ├─ Approved ──> Continue                       │
│ └─ Rejected ──> STOP                           │
└────────────────────┬────────────────────────────┘
                     │ (Approved)
┌────────────────────▼────────────────────────┐
│ Execute: Git Commit & Push                  │
│ (Git CLI)                                   │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│ EvidenceSeal: Pipeline Completion           │
│ (Compliance & Audit Trail)                  │
└────────────────────────────────────────────┘
```

## Using This Workflow

### Prerequisites

1. Install GuardSpine n8n nodes package:
   ```bash
   npm install @guardspine/n8n-nodes-guardspine
   ```

2. Configure GuardSpine API credentials in n8n:
   - Credential Type: GuardSpine API
   - Name: "GuardSpine API"
   - Add your API key and endpoint

3. Install required command-line tools:
   - `yt-dlp` for YouTube downloads
   - `whisper` for audio transcription
   - `git` for version control

### Import the Workflow

1. Open n8n web interface
2. Click "Add Workflow" or "Import"
3. Upload or paste the `content-pipeline.json` file
4. Update placeholder values:
   - YouTube video URL in step 2
   - API endpoints in step 5
   - Git repository path in step 7
5. Configure the GuardSpine API credential
6. Activate the workflow

### Configuration Options

**GuardGate Node (Step 4)**:
- Adjust `blockTier` (1-5) for sensitivity
- Change `rubricPack` for different quality standards
- Modify `thresholdScore` (0.0-1.0)

**ApprovalWait Node (Step 6)**:
- Update `stakeholders` array with real email addresses
- Adjust `timeoutMinutes` for approval deadline
- Change `riskTier` (1-5) based on risk assessment

**EvidenceSeal Node (Step 8)**:
- Update `policyRef` to match your compliance policy
- Adjust `retentionDays` for audit log retention
- Change `sealType` if using different compliance frameworks

## Metadata

- **Workflow Type**: Content Automation
- **Node Count**: 8
- **GuardSpine Nodes**: 3 (GuardGate, ApprovalWait, EvidenceSeal)
- **Standard n8n Nodes**: 5 (Cron, ExecuteCommand x3, end node)
- **Execution Order**: v1
- **Active**: false (activate after configuration)

## Tags

- content-pipeline
- guardspine
- dogfood
- n8n-workflow
- quality-gates
- approval-workflow
- compliance-sealing

## Node Requirements

- `@guardspine/n8n-nodes-guardspine`
- `n8n-nodes-base.cron`
- `n8n-nodes-base.executeCommand`

## Related Documentation

- GuardSpine Node Types: See node documentation
- n8n Workflow Format: https://docs.n8n.io/
- Content Pipeline Guide: David Youssef portfolio documentation

---

**Version**: 1.0.0
**Last Updated**: 2026-01-27
**Status**: Template/Example
