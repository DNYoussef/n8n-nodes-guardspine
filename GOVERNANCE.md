# Governance Guard Pattern for n8n Workflows

Every n8n workflow that touches an external system must be governed.
This is not a guideline -- it is a structural requirement enforced by
the `validate-governance.js` script.

## The Pattern

```
[Your Logic] -> GuardGate -> HTTP Request -> EvidenceSeal -> [Continue]
                   |
                   +-> Blocked Response (risk too high)
```

Three nodes. Two rules:

1. **Every external node has a GuardGate upstream.** The gate evaluates
   the request payload against a rubric pack and assigns a risk tier
   (L0-L4). If the tier exceeds the block threshold, traffic routes to
   the Block output. The request never fires.

2. **Every external node has an EvidenceSeal downstream.** The seal
   creates a tamper-evident, hash-chained record of what was sent and
   what came back. This is the audit trail.

No exceptions. No "quick" HTTP requests that skip the gate.

## Using the Guarded HTTP Request Sub-Workflow

Instead of adding a raw HTTP Request node, call the
`guarded-http-request` sub-workflow via n8n's Execute Workflow node.

Import `examples/guarded-http-request.json` into your n8n instance.
Then call it with this input shape:

```json
{
  "url": "https://api.example.com/endpoint",
  "method": "POST",
  "headers": { "Content-Type": "application/json" },
  "body": { "key": "value" },
  "rubricPack": "nomotic-core",
  "blockTier": 2,
  "policyRef": "my-workflow-v1",
  "approverId": "system:my-workflow"
}
```

**Output on pass:**
- `_request`: what was sent
- `_response`: statusCode, body, received_at
- `_guard`: risk_tier, score, violations, bead_id, evidence_hash
- `_evidence_seal`: bundle_hash, chain_hash, sealed_at

**Output on block:**
- `blocked`: true
- `risk_tier`: the tier that triggered the block
- `violations`: array of rule violations
- `message`: human-readable explanation

## GuardGate Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| artifactData | JSON | required | The payload to evaluate |
| artifactType | enum | generic | code, document, spreadsheet, image, generic |
| rubricPack | enum | nomotic-core | Which rubric set to evaluate against |
| blockTier | number | 2 | Risk tier at which to route to Block output (0-4) |
| createBead | boolean | true | Create a Beads work item for tracking |

The gate has two outputs: **Pass** (index 0) and **Block** (index 1).
Wire your happy path from Pass. Wire error handling from Block.

## EvidenceSeal Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| diffHash | string | required | SHA-256 hash from GuardGate evaluation |
| approverId | string | required | Who approved (human ID or system:auto) |
| policyRef | string | required | Policy reference for the audit record |
| previousChainHash | string | "" | Chain to a previous seal (empty for genesis) |
| metadata | JSON | "" | Additional context to include in the bundle |

## Validation

Run the governance validator against any workflow JSON:

```bash
node scripts/validate-governance.js examples/*.json
```

The script checks every HTTP Request and external node:
- Has a GuardGate somewhere upstream in the connection graph
- Has an EvidenceSeal somewhere downstream in the connection graph

Output shows compliance score (0-100%), with PASS/WARN/FAIL status.
The script exits non-zero if any workflow is not fully compliant --
suitable for CI gates.

### External Node Types Checked

The validator recognizes these as external nodes requiring governance:

- httpRequest
- webhook (outbound)
- emailSend
- slack, telegram, discord, microsoftTeams
- awsS3, googleSheets, airtable

## Adding Governance to an Existing Workflow

If you have a workflow with unguarded HTTP requests:

1. Run `node scripts/validate-governance.js your-workflow.json`
2. Note which nodes are unguarded or unsealed
3. For each unguarded node, add a GuardGate upstream in the connection chain
4. For each unsealed node, add an EvidenceSeal downstream
5. Re-run the validator to confirm 100% compliance

The simplest fix: replace raw HTTP Request nodes with calls to the
`guarded-http-request` sub-workflow. One change, full compliance.

## Why This Matters

An unguarded HTTP request in an automated workflow is an unaudited
action taken on behalf of your organization. When something goes wrong
-- and it will -- you need to answer: what was sent, who approved it,
and what policy was it evaluated against.

The guard pattern answers all three by construction. Not by process.
Not by documentation. By the structure of the workflow itself.
