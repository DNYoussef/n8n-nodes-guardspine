# Content Pipeline Workflow - Technical Specification

## Document Meta

- **Filename**: content-pipeline.json
- **Version**: 1.0.0
- **Release Date**: 2026-01-27
- **Status**: Template/Example
- **Format**: n8n Workflow Definition JSON

## Performance Characteristics

| Stage | Typical Duration | Max Duration |
|-------|------------------|--------------|
| YouTube Download | 2-5 min | 15 min |
| Transcription | 1-3 min | 10 min |
| Slop Detection | 10-30 sec | 2 min |
| Claude Generation | 30-60 sec | 2 min |
| Approval Wait | 1-1440 min | 1440 min |
| Git Push | 10-30 sec | 2 min |
| Evidence Seal | 5-10 sec | 1 min |
| **Total (without approval)** | 4-12 min | 32 min |
| **Total (with approval)** | 5 min - 24+ h | 26+ h |

## Exit Conditions

### Success Path
All nodes execute without errors and both gates pass.
Result: Blog published, evidence sealed.

### Failure Path 1: Quality Gate Block
GuardGate detects slop (score < 0.7).
Result: Pipeline stops, no deployment.

### Failure Path 2: Approval Rejection
ApprovalWait receives rejection.
Result: Pipeline stops, draft not deployed.

### Failure Path 3: Execution Error
Any node fails (network, API, command error).
Result: Workflow stops, error logged.

## Node Type Reference

| Type | Provider | Purpose |
|------|----------|---------|
| n8n-nodes-base.cron | Built-in | Schedule triggers |
| n8n-nodes-base.executeCommand | Built-in | Shell command execution |
| @guardspine/guardGate | GuardSpine | Quality gate validation |
| @guardspine/approvalWait | GuardSpine | Approval workflow |
| @guardspine/evidenceSeal | GuardSpine | Compliance sealing |

## Credential Types

| Type | Package | Auth Method |
|------|---------|-------------|
| guardspineApi | @guardspine/n8n-nodes-guardspine | API Key + Endpoint |

## Environment Variables

For execution:

| Variable | Required | Purpose |
|----------|----------|---------|
| ANTHROPIC_API_KEY | Yes | Claude API access |
| GIT_SSH_KEY | Yes | Git authentication |

## Deployment

1. Import content-pipeline.json into n8n
2. Configure GuardSpine API credentials
3. Update placeholder commands with real values
4. Test each node individually
5. Run in dry-run mode
6. Activate workflow

## Version Compatibility

| Component | Min Version |
|-----------|-------------|
| n8n | 1.0.0 |
| Node.js | 16.x |
| @guardspine/nodes | 1.0.0 |
| yt-dlp | 2023.01+ |
| Whisper | 20230101+ |
| Git | 2.0+ |

## References

- n8n Docs: https://docs.n8n.io/
- Claude API: https://anthropic.com/api
- yt-dlp: https://github.com/yt-dlp/yt-dlp
- OpenAI Whisper: https://github.com/openai/whisper

---

**Version**: 1.0.0
**Updated**: 2026-01-27
**Status**: Template Ready
