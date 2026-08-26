import { describe, expect, it } from 'vitest';
import { reviewRecoveryState } from './reviewRecovery';

describe('review recovery state', () => {
	it('shows humane progress for a large frozen review set', () => {
		expect(reviewRecoveryState(37, 12)).toEqual({
			active: true,
			total: 37,
			completed: 12,
			remaining: 25,
		});
	});

	it('does not classify a normal or completed batch as Recovery', () => {
		expect(reviewRecoveryState(9, 0).active).toBe(false);
		expect(reviewRecoveryState(37, 37)).toEqual({
			active: false,
			total: 37,
			completed: 37,
			remaining: 0,
		});
	});
});
