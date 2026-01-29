# n8n-nodes-guardspine: OSS / Premium Split

**BEAD GS-R3** | Documents which n8n nodes ship as open-source vs premium.

---

## OSS Nodes (MIT Licensed)

These nodes ship in the `n8n-nodes-guardspine` community package, freely available on npm.

| Node | Trigger? | Description |
|---|---|---|
| **GuardSpineVerify** | No | Verify an evidence bundle hash and seal integrity |
| **GuardSpineSeal** | No | Create a cryptographic seal for a document or bundle |
| **GuardSpineTrigger** | Yes | Webhook trigger on GuardSpine events (seal created, drift detected) |

**Package**: `n8n-nodes-guardspine` (npm public)
**License**: MIT
**Repo**: `github.com/guardspine/n8n-nodes-guardspine`

---

## Premium Nodes (Proprietary)

These nodes require a GuardSpine product license and ship via private npm registry or direct install.

| Node | Trigger? | Description |
|---|---|---|
| **GuardSpineCompress** | No | Run 100:1 evidence compression pipeline |
| **PDFGuard** | No | Extract, validate, and seal PDF documents |
| **SheetGuard** | No | Validate spreadsheet data against policy schemas |
| **ImageGuard** | No | Validate image metadata, EXIF stripping, watermark verification |
| **GuardLane** | No | Route documents through risk-tier lanes (L0-L4) with queue management |

**Package**: `@guardspine/n8n-nodes-premium` (private registry)
**License**: Proprietary (GuardSpine Product License)
**Repo**: `github.com/guardspine/guardspine-product` (private)

---

## Split Rationale

| Criterion | OSS Nodes | Premium Nodes |
|---|---|---|
| **Value** | Verification (read-only) | Compression + transformation (write) |
| **Moat** | None (commodity) | 100:1 compression, format-specific guards |
| **Goal** | Adoption wedge, trust builder | Revenue, differentiation |
| **Dependencies** | guardspine-verify (OSS) | guardspine-product (proprietary) |

---

## Migration Plan

### Phase 1: Extract OSS nodes (Week 1)

1. Create `n8n-nodes-guardspine` repo with MIT LICENSE.
2. Move `GuardSpineVerify`, `GuardSpineSeal`, `GuardSpineTrigger` source.
3. Add n8n community node metadata (`package.json` n8n field).
4. Publish to npm public registry.
5. Add README with install instructions: `npm install n8n-nodes-guardspine`.

### Phase 2: Package premium nodes (Week 2)

1. Create `@guardspine/n8n-nodes-premium` in guardspine-product repo.
2. Keep `GuardSpineCompress`, `PDFGuard`, `SheetGuard`, `ImageGuard`, `GuardLane`.
3. Add license-key validation middleware (check `GUARDSPINE_LICENSE_KEY` env var).
4. Publish to private npm registry (GitHub Packages or Verdaccio).
5. Document install: `npm install @guardspine/n8n-nodes-premium --registry=...`.

### Phase 3: Integration testing (Week 3)

1. Test OSS nodes work standalone without premium package.
2. Test premium nodes degrade gracefully without license key (clear error message).
3. Test mixed workflows using both OSS and premium nodes.
4. Update n8n workflow templates for both tiers.

### Phase 4: Documentation and launch (Week 4)

1. Publish OSS nodes to n8n community catalog.
2. Add premium nodes to GuardSpine product docs.
3. Create blog post: "GuardSpine + n8n: Automate Evidence Governance".
4. Add upgrade CTA in OSS node README pointing to premium.
