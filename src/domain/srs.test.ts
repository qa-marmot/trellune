import { describe, expect, it } from 'vitest';
import {
	reconstructReviewHistory,
	scheduleReview,
	type ReviewGrade,
	type ReviewState,
	type SrsCardState,
} from './srs';

const base: SrsCardState = {
	state: 'new',
	dueAt: '2026-03-07T14:30:00.000Z',
	stabilityLevel: 0,
	lapses: 0,
};

describe('deterministic review scheduling', () => {
	it('produces distinct schedules for all four grades', () => {
		const grades: ReviewGrade[] = ['again', 'hard', 'good', 'easy'];
		const results = grades.map((grade) =>
			scheduleReview(base, grade, '2026-03-07T14:30:00.000Z', 'Asia/Tokyo'),
		);
		expect(new Set(results.map((item) => item.dueAt))).toHaveLength(4);
		expect(results.map((item) => item.intervalDays)).toEqual([0, 1, 2, 4]);
	});

	it('moves a failed review card to relearning and increments lapses once', () => {
		const result = scheduleReview(
			{
				...base,
				state: 'review',
				lastReviewedAt: '2026-03-01T14:30:00.000Z',
				stabilityLevel: 4,
				lapses: 2,
			},
			'again',
			'2026-03-07T14:30:00.000Z',
			'Asia/Tokyo',
		);
		expect(result).toMatchObject({ state: 'relearning', lapses: 3, stabilityLevel: 3 });
		expect(Date.parse(result.dueAt) - Date.parse(result.lastReviewedAt!)).toBe(600_000);
	});

	it('preserves the local wall-clock time across a DST transition', () => {
		const result = scheduleReview(base, 'hard', '2026-03-07T14:30:00.000Z', 'America/New_York');
		expect(result.dueAt).toBe('2026-03-08T13:30:00.000Z');
	});

	it('covers the complete 4 state by 4 grade transition matrix', () => {
		const states: ReviewState[] = ['new', 'learning', 'review', 'relearning'];
		const grades: ReviewGrade[] = ['again', 'hard', 'good', 'easy'];
		for (const state of states) {
			for (const grade of grades) {
				const result = scheduleReview(
					{
						...base,
						state,
						lastReviewedAt: state === 'review' ? '2026-03-01T14:30:00.000Z' : undefined,
						stabilityLevel: state === 'review' ? 3 : 0,
					},
					grade,
					'2026-03-07T14:30:00.000Z',
					'Asia/Tokyo',
				);
				expect(result.lastReviewedAt).toBe('2026-03-07T14:30:00.000Z');
				expect(result.intervalDays).toBeGreaterThanOrEqual(0);
			}
		}
	});

	it('chooses compatible instants for DST gaps and the earlier overlap', () => {
		const gap = scheduleReview(base, 'hard', '2026-03-07T07:30:00.000Z', 'America/New_York');
		expect(gap.dueAt).toBe('2026-03-08T07:00:00.000Z');
		const overlap = scheduleReview(base, 'hard', '2026-10-31T05:30:00.000Z', 'America/New_York');
		expect(overlap.dueAt).toBe('2026-11-01T05:30:00.000Z');
	});

	it('reconstructs deterministic history and rejects a tampered transition', () => {
		const before = { ...base, version: 1 };
		const first = scheduleReview(before, 'good', '2026-03-07T14:30:00.000Z', 'Asia/Tokyo');
		const after = { ...first, version: 2 };
		const events = [
			{
				eventId: '11111111-1111-4111-8111-111111111111',
				grade: 'good' as const,
				occurredAt: '2026-03-07T14:30:00.000Z',
				before,
				after,
			},
		];
		expect(reconstructReviewHistory(events, 'Asia/Tokyo')).toEqual(after);
		expect(() =>
			reconstructReviewHistory(
				[{ ...events[0], after: { ...after, dueAt: '2026-03-08T00:00:00.000Z' } }],
				'Asia/Tokyo',
			),
		).toThrow(/diverges after/u);
	});
});
