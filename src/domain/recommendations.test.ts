import { describe, expect, it } from 'vitest';
import { recommendBoost } from './recommendations';

describe('Boost recommendations', () => {
	it.each([9, 10, 11, 19, 20, 21])('handles the review backlog boundary at %i', (count) => {
		expect(recommendBoost({ overdueReviewCount: count, repeatedMistakeCount: 0 }).mode).toBe(
			count < 10 ? 'scenario_challenge' : 'review_rescue',
		);
	});

	it.each([2, 3, 4])('handles the repeated-mistake boundary at %i', (count) => {
		expect(recommendBoost({ overdueReviewCount: 0, repeatedMistakeCount: count }).mode).toBe(
			count < 3 ? 'scenario_challenge' : 'weakness_attack',
		);
	});

	it('uses the documented combined priority deterministically', () => {
		expect(
			recommendBoost({
				overdueReviewCount: 12,
				repeatedMistakeCount: 3,
				repeatedMistakeInLatestSession: false,
			}).mode,
		).toBe('review_rescue');
		expect(
			recommendBoost({
				overdueReviewCount: 12,
				repeatedMistakeCount: 3,
				repeatedMistakeInLatestSession: true,
			}).mode,
		).toBe('weakness_attack');
		expect(
			recommendBoost({
				overdueReviewCount: 25,
				repeatedMistakeCount: 3,
				repeatedMistakeInLatestSession: true,
			}).mode,
		).toBe('review_rescue');
	});

	it('uses recent interaction then grammar scores before the default', () => {
		expect(
			recommendBoost({
				overdueReviewCount: 0,
				repeatedMistakeCount: 0,
				recentInteractionScores: [2, 2, 3],
				recentGrammarScores: [1, 1, 1],
			}).mode,
		).toBe('speaking_sprint');
		expect(
			recommendBoost({
				overdueReviewCount: 0,
				repeatedMistakeCount: 0,
				recentInteractionScores: [3, 3, 3],
				recentGrammarScores: [2, 2, 2],
			}).mode,
		).toBe('grammar_deep_dive');
	});
});
