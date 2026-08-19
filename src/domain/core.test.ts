import { describe, expect, it } from 'vitest';
import { acceptsCoreSession, applyCoreEvidence, deriveCoreState, type CoreEvidence } from './core';

const EMPTY = deriveCoreState({
	reviewsCompleted: false,
	grammarCompleted: false,
	coreSessionImported: false,
});

function permutations<T>(items: T[]): T[][] {
	if (items.length <= 1) return [items];
	return items.flatMap((item, index) =>
		permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((tail) => [
			item,
			...tail,
		]),
	);
}

describe('canonical Core state machine', () => {
	it('matches the complete 2³ truth table', () => {
		for (const reviewsCompleted of [false, true]) {
			for (const grammarCompleted of [false, true]) {
				for (const coreSessionImported of [false, true]) {
					const state = deriveCoreState({
						reviewsCompleted,
						grammarCompleted,
						coreSessionImported,
					});
					expect(state.coreCompleted).toBe(
						reviewsCompleted && grammarCompleted && coreSessionImported,
					);
				}
			}
		}
	});

	it('completes exactly once in all six evidence orders and is idempotent', () => {
		const evidence: CoreEvidence[] = ['reviews', 'grammar', 'core-session'];
		for (const order of permutations(evidence)) {
			let state = EMPTY;
			let completionTransitions = 0;
			for (const item of [...order, ...order]) {
				const next = applyCoreEvidence(state, item);
				if (!state.coreCompleted && next.coreCompleted) completionTransitions += 1;
				state = next;
			}
			expect(state.coreCompleted).toBe(true);
			expect(completionTransitions).toBe(1);
		}
	});

	it('accepts only a Core session for the same curriculum day and local study date', () => {
		const valid = {
			sessionType: 'core' as const,
			curriculumDay: 8,
			occurredAt: '2026-08-10T12:00:00.000Z',
			expectedCurriculumDay: 8,
			expectedStudyDate: '2026-08-10',
			timeZone: 'Asia/Tokyo',
		};
		expect(acceptsCoreSession(valid)).toBe(true);
		expect(acceptsCoreSession({ ...valid, sessionType: 'boost' })).toBe(false);
		expect(acceptsCoreSession({ ...valid, curriculumDay: 9 })).toBe(false);
		expect(acceptsCoreSession({ ...valid, occurredAt: '2026-08-09T12:00:00.000Z' })).toBe(false);
	});
});
