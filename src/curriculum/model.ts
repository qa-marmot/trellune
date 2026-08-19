import type { CurriculumDay } from '../data/curriculum';

export type CefrBand = 'A1' | 'A2' | 'B1' | 'B1+' | 'B2';

export type SkillTarget =
	| 'grammar'
	| 'vocabulary'
	| 'speaking'
	| 'fluency'
	| 'interaction'
	| 'listening'
	| 'pronunciation'
	| 'reading'
	| 'writing';

export type PracticeKind =
	'grammar' | 'vocabulary' | 'reading' | 'writing' | 'listening' | 'retrieval' | 'integration';

export type GrammarCategory =
	| 'tense-aspect'
	| 'question-word-order'
	| 'noun-article-quantity'
	| 'comparison'
	| 'modal-condition'
	| 'clause-linking'
	| 'passive-reported'
	| 'discourse-cohesion'
	| 'hedging-stance'
	| 'interaction-repair'
	| 'paraphrase-explanation'
	| 'integrated-grammar';

export interface PracticeRetrievalTarget {
	readonly text: string;
	readonly introducedDay: number;
	readonly intervalDays: 1 | 3 | 7 | 21;
}

export interface PracticePrompt {
	readonly id: string;
	readonly operation:
		| 'recognition'
		| 'controlled-production'
		| 'transformation'
		| 'guided-production'
		| 'free-production'
		| 'error-correction'
		| 'contextual-application'
		| 'cumulative-retrieval'
		| 'comprehension'
		| 'inference'
		| 'summary'
		| 'paraphrase';
	readonly prompt: string;
	/** Per-response range. Used when one block combines comprehension and extended writing. */
	readonly output?: PracticeOutput;
	/** Exact answers are only used for bounded recognition or transformation tasks. */
	readonly expectedAnswer?: string;
	/** Learner-facing criteria for open production and self-checking. */
	readonly guidance?: string;
	/** Bundle-authored comparison material shown only after the learner answers. */
	readonly feedback: PracticeFeedback;
	readonly grammarCategory?: GrammarCategory;
	readonly retrievalTargets?: readonly PracticeRetrievalTarget[];
}

export interface PracticeFeedback {
	/** Meaning-bearing points, not strings used for exact-match grading. */
	readonly keyPoints?: readonly string[];
	readonly rationale: string;
	readonly evidenceClue?: string;
	readonly commonErrors?: readonly string[];
	/** Learner-owned review criteria. Checking them is not an automated correctness claim. */
	readonly checklist: readonly string[];
	readonly modelResponse?: string;
	readonly targetFeatures?: readonly string[];
}

export interface PracticeOutput {
	readonly format:
		'sentence' | 'connected-sentences' | 'paragraph' | 'message' | 'summary' | 'report' | 'opinion';
	readonly minimumWords: number;
	readonly maximumWords: number;
}

/**
 * Bundle-authored, non-Voice practice. Blocks are catalog content only: responses
 * are not persisted and completion continues to use the existing grammar Core flag.
 */
export interface PracticeBlock {
	readonly id: string;
	readonly kind: PracticeKind;
	readonly title: string;
	readonly instructions: string;
	readonly estimatedMinutes: number;
	readonly skillTargets: readonly SkillTarget[];
	readonly sourceText?: string;
	readonly prompts: readonly PracticePrompt[];
	readonly output?: PracticeOutput;
}

export interface CurriculumStage {
	readonly id: string;
	readonly title: string;
	readonly startDay: number;
	readonly endDay: number;
	readonly entryCefr: CefrBand;
	readonly targetCefr: CefrBand;
	readonly timeGuidance: {
		readonly minimumCoreMinutes: readonly [number, number];
		readonly recommendedMinutes: readonly [number, number];
		readonly maximumWithBoostMinutes: number;
		readonly speakingMinutes: readonly [number, number];
	};
	readonly unitIds: readonly string[];
}

export interface CurriculumUnit {
	readonly id: string;
	readonly stageId: string;
	readonly title: string;
	readonly startDay: number;
	readonly endDay: number;
}

export interface CurriculumLesson {
	/** Catalog-only ID. It is never reused as a learning, progress, grammar, or session ID. */
	readonly id: string;
	readonly day: number;
	readonly week: number;
	readonly stageId: string;
	readonly unitId: string;
	readonly skillTargets: readonly SkillTarget[];
	readonly practiceBlocks: readonly PracticeBlock[];
	/** The authored lesson content is retained without transformation. */
	readonly content: CurriculumDay;
}

export interface CurriculumManifest {
	readonly id: string;
	readonly contentVersion: string;
	readonly availableTotalDays: number;
	readonly supportedMaxDay: number;
	readonly stages: readonly CurriculumStage[];
	readonly units: readonly CurriculumUnit[];
	readonly lessons: readonly CurriculumLesson[];
}
