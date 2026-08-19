import { studyDateAt } from './calendar';

export type CoreEvidence = 'reviews' | 'grammar' | 'core-session';

export interface CoreState {
	reviewsCompleted: boolean;
	grammarCompleted: boolean;
	coreSessionImported: boolean;
	coreCompleted: boolean;
}

export interface CoreSessionContext {
	sessionType: 'core' | 'boost';
	curriculumDay: number;
	occurredAt: string;
	expectedCurriculumDay: number;
	expectedStudyDate: string;
	timeZone: string;
}

export function deriveCoreState(state: Omit<CoreState, 'coreCompleted'> | CoreState): CoreState {
	return {
		reviewsCompleted: state.reviewsCompleted,
		grammarCompleted: state.grammarCompleted,
		coreSessionImported: state.coreSessionImported,
		coreCompleted: state.reviewsCompleted && state.grammarCompleted && state.coreSessionImported,
	};
}

export function applyCoreEvidence(state: CoreState, evidence: CoreEvidence): CoreState {
	return deriveCoreState({
		reviewsCompleted: state.reviewsCompleted || evidence === 'reviews',
		grammarCompleted: state.grammarCompleted || evidence === 'grammar',
		coreSessionImported: state.coreSessionImported || evidence === 'core-session',
	});
}

export function acceptsCoreSession(context: CoreSessionContext): boolean {
	return (
		context.sessionType === 'core' &&
		context.curriculumDay === context.expectedCurriculumDay &&
		studyDateAt(context.occurredAt, context.timeZone) === context.expectedStudyDate
	);
}
