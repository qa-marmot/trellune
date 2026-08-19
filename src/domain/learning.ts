import type { SessionImport } from '../lib/schemas';

export const DAILY_ACQUISITION_LIMITS = Object.freeze({
	words: 8,
	phrases: 3,
	previewGrammar: 1,
});

export interface AcquisitionCounts {
	words: number;
	phrases: number;
	previewGrammar: number;
}

export interface DailyProgress {
	reviewCompleted: boolean;
	grammarCompleted: boolean;
	coreVoiceImported: boolean;
}

export interface CoreCompletion extends DailyProgress {
	coreCompleted: boolean;
}

export interface AcquisitionLimitResult {
	accepted: boolean;
	remaining: AcquisitionCounts;
	violations: Array<{ item: keyof AcquisitionCounts; limit: number; attemptedTotal: number }>;
}

export function sessionAcquisitionCounts(session: SessionImport): AcquisitionCounts {
	return {
		words: session.newVocabulary.length,
		phrases: session.newPhrases.length,
		previewGrammar: session.sessionType === 'boost' ? session.previewGrammar.length : 0,
	};
}

export function checkDailyAcquisitionLimits(
	existing: AcquisitionCounts,
	incoming: AcquisitionCounts,
): AcquisitionLimitResult {
	const limits: AcquisitionCounts = DAILY_ACQUISITION_LIMITS;
	const violations: AcquisitionLimitResult['violations'] = [];
	const remaining = {} as AcquisitionCounts;

	for (const item of ['words', 'phrases', 'previewGrammar'] as const) {
		const attemptedTotal = existing[item] + incoming[item];
		remaining[item] = Math.max(0, limits[item] - attemptedTotal);
		if (attemptedTotal > limits[item]) {
			violations.push({ item, limit: limits[item], attemptedTotal });
		}
	}

	return { accepted: violations.length === 0, remaining, violations };
}

export function calculateCoreCompletion(progress: DailyProgress): CoreCompletion {
	return {
		...progress,
		coreCompleted:
			progress.reviewCompleted && progress.grammarCompleted && progress.coreVoiceImported,
	};
}

export function applySessionToProgress(
	current: DailyProgress,
	session: SessionImport,
): CoreCompletion {
	if (session.sessionType === 'boost') {
		return calculateCoreCompletion(current);
	}

	return calculateCoreCompletion({
		...current,
		coreVoiceImported: true,
	});
}

export type StudyItemState = 'new' | 'previewed' | 'active' | 'mastered';

export function importedItemState(
	session: SessionImport,
): Extract<StudyItemState, 'new' | 'previewed'> {
	return session.sessionType === 'boost' ? 'previewed' : 'new';
}
