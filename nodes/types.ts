export interface GuardViolation {
	rule: string;
	message: string;
	severity: string;
}

export interface GuardEvaluateResponse {
	risk_tier: number;
	score: number;
	violations: GuardViolation[];
	bead_id: string | null;
	evidence_hash: string;
	evaluated_at: string;
}

export interface CodeGuardFinding {
	type: string;
	message: string;
	severity?: string;
	line_count?: number;
}

export interface CodeGuardResponse {
	risk_tier: number;
	passed: boolean;
	findings: CodeGuardFinding[];
	sigma_level: number;
	dpmo: number;
	evidence_hash: string;
	gate_type: string;
}

export interface CouncilVoteEntry {
	persona_id: string;
	vote: string;
	confidence: number;
	reasoning: string;
}

export interface CouncilVoteResponse {
	consensus_pct: number;
	decision: string;
	voting_mode: string;
	threshold: number;
	votes: CouncilVoteEntry[];
	evidence_hash: string;
}

export interface BeadsCreateResponse {
	id: string;
	title: string;
	status: string;
	priority: string;
	labels: string[];
	created_at: string;
}

export interface BeadsUpdateResponse {
	id: string;
	status: string;
	priority: string;
	labels: string[];
	description: string;
	updated_at: string;
}

export interface BeadsEvidenceResponse {
	id: string;
	status: string;
	evidence: Array<{
		evidence_hash: string;
		evidence_type: string;
		evidence_data: unknown;
	}>;
}

export interface EvidenceSealResponse {
	bundle_hash: string;
	chain_hash: string;
	sealed_at: string;
	offline_verify_cmd: string;
}

export interface ApprovalCreateResponse {
	approval_id: string;
	status: string;
	created_at: string;
}

export interface ApprovalStatusResponse {
	approval_id: string;
	status: string;
	decided_at: string;
}

export interface BundleImportResponse {
	bundle_id: string;
	raw_sha256: string;
	imported_at: string;
	verified: boolean;
	errors: string[];
	version: string;
	item_count: number;
	root_hash: string | null;
}
