# Content Pipeline Workflow - Quick Reference

## Workflow ID
`content-pipeline.json` (v1.0.0)

## Execution Flow Diagram

```
START
  ↓
1. Cron Trigger (Weekly: Sun 2am)
  ↓
2. YouTube Download (yt-dlp)
  ↓
3. Whisper Transcription
  ↓
4. GuardGate: Slop Detection [QUALITY GATE #1]
  ├─ PASS ──→ Continue
  └─ BLOCK ──→ STOP
  ↓
5. Claude Draft Generation (Claude API)
  ↓
6. ApprovalWait: Editorial Review [APPROVAL GATE #1]
  ├─ APPROVED ──→ Continue
  └─ REJECTED ──→ STOP
  ↓
7. Git Commit & Push
  ↓
8. EvidenceSeal: Pipeline Completion [COMPLIANCE SEAL]
  ↓
END
```

## Node Details

| # | Name | Type | Key Parameters | Outputs |
|---|------|------|-----------------|---------|
| 1 | Cron Trigger | n8n-nodes-base.cron | Weekly, Sunday 2:00 AM | None |
| 2 | YouTube Download | executeCommand | `yt-dlp -f 'best[ext=mp4]'...` | MP3 file |
| 3 | Whisper Transcribe | executeCommand | `whisper 'audio.mp3' --output_format json` | JSON transcript |
| 4 | GuardGate (Slop) | guardGate | blockTier: 3, rubricPack: content-quality | Pass / Block |
| 5 | Claude Draft | executeCommand | Claude API endpoint call | Blog draft |
| 6 | ApprovalWait | approvalWait | riskTier: 2, timeoutMinutes: 1440 | Approved / Rejected |
| 7 | Git Push | executeCommand | `git add content/ && git commit && git push` | Commit hash |
| 8 | EvidenceSeal | evidenceSeal | policyRef: content-pipeline-v1 | Audit trail |

## Configuration Checklist

### Before Activation
- [ ] Install `@guardspine/n8n-nodes-guardspine` npm package
- [ ] Create GuardSpine API credential ("GuardSpine API")
- [ ] Install yt-dlp: `pip install yt-dlp`
- [ ] Install whisper: `pip install openai-whisper`
- [ ] Have git configured locally
- [ ] Have Claude API key available

### During Import
- [ ] Update YouTube URL in step 2 (replace EXAMPLE_VIDEO_ID)
- [ ] Update Claude API endpoint in step 5
- [ ] Update Git repo path in step 7
- [ ] Update stakeholder emails in step 6
- [ ] Configure GuardSpine API credential

### After Import
- [ ] Test each node individually
- [ ] Set workflow to inactive until ready
- [ ] Monitor first execution before scheduling

## Exit Points (Stop Conditions)

The workflow has 2 blocking points where execution stops:

### Exit Point 1: GuardGate Block (Step 4)
**Trigger**: Slop detection score below threshold (default 0.7)
**Action**: Transcript fails quality check
**Resolution**: Review transcript, adjust quality threshold, or re-run

### Exit Point 2: ApprovalWait Rejection (Step 6)
**Trigger**: Editorial reviewer rejects the draft
**Action**: Draft blocked from publication
**Resolution**: Editor must approve or draft must be regenerated

## Customization Points

### Tier Configuration (GuardGate)

```json
"blockTier": 1  // Strictest (most permissive)
"blockTier": 3  // Balanced (default)
"blockTier": 5  // Strictest (fewest pass-throughs)
```

### Risk Assessment (ApprovalWait)

```json
"riskTier": 1  // Low risk (fast approval)
"riskTier": 2  // Medium risk (balanced, default)
"riskTier": 5  // High risk (requires multiple approvers)
```

### Compliance Policy (EvidenceSeal)

```json
"policyRef": "content-pipeline-v1"      // Current
"policyRef": "content-pipeline-strict"  // More strict
"retentionDays": 90                      // Audit log retention
```

## Success Metrics

### Successful Run Indicators
- All 8 nodes execute without errors
- GuardGate passes quality threshold
- ApprovalWait receives approval
- EvidenceSeal captures full execution trail
- Git commit is pushed successfully

### Failure Points to Monitor
- **Step 2**: yt-dlp command fails (network, URL invalid)
- **Step 3**: Whisper transcription fails (audio quality, model issue)
- **Step 4**: Slop detection blocks (threshold adjustment needed)
- **Step 5**: Claude API error (auth, rate limit, model issue)
- **Step 6**: Approval timeout (no reviewer response)
- **Step 7**: Git push fails (auth, network, merge conflict)
- **Step 8**: EvidenceSeal audit failure (policy validation)

## Troubleshooting

### GuardGate Always Blocks
**Solution**: Lower `blockTier` value or adjust `thresholdScore`
```json
"blockTier": 3
"thresholdScore": 0.65
```

### ApprovalWait Timeout
**Solution**: Increase `timeoutMinutes` or add more stakeholders
```json
"timeoutMinutes": 2880  // 48 hours
```

### Git Push Fails
**Solution**: Verify credentials and repo access
```bash
git config --global user.email "example@example.com"
git config --global user.name "CI/CD Bot"
```

### Claude API Errors
**Solution**: Check API key, rate limits, model availability
- Verify `ANTHROPIC_API_KEY` is set
- Check account quota
- Verify model name is valid

## Related Workflows

- `trader-ai-deployment.json` (if available)
- `marketing-automation.json` (if available)
- `quality-assurance.json` (if available)

## Support & Documentation

- GuardSpine Docs: [Link to docs]
- n8n Workflow Docs: https://docs.n8n.io/
- Content Pipeline Guide: [Portfolio documentation]
- David Youssef Blog: https://example.com/

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-27 | Initial template release |

## License

This workflow template is provided as-is for use with GuardSpine and n8n.

---

**Last Updated**: 2026-01-27
**Maintained By**: n8n-nodes-guardspine project
**Status**: Template/Example - Ready for Import
