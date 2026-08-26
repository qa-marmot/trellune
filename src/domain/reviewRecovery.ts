export const REVIEW_RECOVERY_THRESHOLD = 10;

export interface ReviewRecoveryState {
	active: boolean;
	total: number;
	completed: number;
	remaining: number;
}

export function reviewRecoveryState(total: number, completed: number): ReviewRecoveryState {
	const safeTotal = Math.max(0, Math.trunc(total));
	const safeCompleted = Math.min(safeTotal, Math.max(0, Math.trunc(completed)));
	return {
		active: safeTotal >= REVIEW_RECOVERY_THRESHOLD && safeCompleted < safeTotal,
		total: safeTotal,
		completed: safeCompleted,
		remaining: safeTotal - safeCompleted,
	};
}
