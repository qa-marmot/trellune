import { z } from 'zod';
import type { StageAssessment } from './assessment';
import type { CurriculumEntryDay } from './startingPoint';

export type CoreStep = 'reviews' | 'grammar';

export interface ImportedSession {
	sessionId: string;
	kind: 'core' | 'boost';
	completedAt: string;
	durationMinutes: number;
	summary: string;
	score: number;
	mistakes: string[];
	payload?: unknown;
}

export interface MistakeItem {
	id: string;
	category: string;
	original: string;
	correction: string;
	repetitions: number;
	sessionId?: string;
}

export interface ReviewCardItem {
	id: string;
	front: string;
	back: string;
	dueAt: string;
	state: 'new' | 'learning' | 'review' | 'relearning' | 'previewed' | 'suspended';
	stabilityLevel: number;
	lapses: number;
	lastReviewedAt?: string;
	version: number;
}

export interface LearningItemView {
	id: string;
	kind: 'vocabulary' | 'phrase';
	displayText: string;
	meaning: string;
	supportLanguage: 'ja' | 'en';
	status: 'new' | 'learning' | 'learned' | 'previewed';
}

export interface AppData {
	onboarded: boolean;
	learnerName: string;
	goal: string;
	dailyMinutes: number;
	timeZone: string;
	startDate: string | null;
	entryDay: CurriculumEntryDay;
	studyStatus: 'before-start' | 'active' | 'graduated';
	currentDay: number;
	streak: number;
	core: { reviews: boolean; grammar: boolean; import: boolean };
	completedDays: number[];
	completedStudyDates: string[];
	previewedDays: number[];
	reviewCount: number;
	reviewBatchTotal: number;
	reviewBatchCompleted: number;
	reviewCards: ReviewCardItem[];
	learningItems: LearningItemView[];
	remainingAcquisition: { words: number; phrases: number; previewGrammar: number };
	activity: {
		coreSessions: number;
		boostSessions: number;
		reviewEvents: number;
		acquiredWords: number;
		acquiredPhrases: number;
		grammarProgress: number;
	};
	baselineCompleted: boolean;
	stageAssessments: StageAssessment[];
	sessions: ImportedSession[];
	mistakes: MistakeItem[];
	syncEnabled: boolean;
	reduceMotion: boolean;
}

export const DEFAULT_DATA: AppData = {
	onboarded: false,
	learnerName: '',
	goal: '身近な話題で10分話す',
	dailyMinutes: 20,
	timeZone: 'Asia/Tokyo',
	startDate: null,
	entryDay: 1,
	studyStatus: 'active',
	currentDay: 1,
	streak: 0,
	core: { reviews: false, grammar: false, import: false },
	completedDays: [],
	completedStudyDates: [],
	previewedDays: [],
	reviewCount: 0,
	reviewBatchTotal: 0,
	reviewBatchCompleted: 0,
	reviewCards: [],
	learningItems: [],
	remainingAcquisition: { words: 8, phrases: 3, previewGrammar: 1 },
	activity: {
		coreSessions: 0,
		boostSessions: 0,
		reviewEvents: 0,
		acquiredWords: 0,
		acquiredPhrases: 0,
		grammarProgress: 0,
	},
	baselineCompleted: false,
	stageAssessments: [],
	sessions: [],
	mistakes: [],
	syncEnabled: false,
	reduceMotion: false,
};

const LegacyCoreSchema = z
	.object({
		reviews: z.boolean(),
		grammar: z.boolean(),
		voice: z.boolean(),
		import: z.boolean(),
	})
	.strict();

const ImportedSessionSchema = z
	.object({
		sessionId: z.string().min(1).max(128),
		kind: z.enum(['core', 'boost']),
		completedAt: z.string().min(1).max(64),
		durationMinutes: z.number().int().min(1).max(120),
		summary: z.string().min(1).max(1_000),
		score: z.number().min(0).max(100),
		mistakes: z.array(z.string().max(1_000)).max(20),
		sourceText: z.string().optional(),
		payload: z.unknown().optional(),
	})
	.strict();

const MistakeItemSchema = z
	.object({
		id: z.string().min(1).max(128),
		category: z.string().min(1).max(128),
		original: z.string().max(1_000),
		correction: z.string().max(1_000),
		repetitions: z.number().int().nonnegative().max(10_000),
	})
	.strict();

export const LegacyAppDataSchema = z
	.object({
		onboarded: z.boolean(),
		learnerName: z.string().max(200),
		goal: z.string().max(500),
		dailyMinutes: z.number().int().min(1).max(240),
		currentDay: z.number().int().min(1).max(90),
		streak: z.number().int().nonnegative().max(10_000),
		core: LegacyCoreSchema,
		completedDays: z.array(z.number().int().min(1).max(90)).max(90),
		previewedDays: z.array(z.number().int().min(1).max(90)).max(90),
		reviewCount: z.number().int().nonnegative().max(100_000),
		sessions: z.array(ImportedSessionSchema).max(10_000),
		mistakes: z.array(MistakeItemSchema).max(100_000),
		syncEnabled: z.boolean(),
		reduceMotion: z.boolean(),
	})
	.strict();

export function sanitizeImportedSession(session: ImportedSession): ImportedSession {
	return {
		sessionId: session.sessionId,
		kind: session.kind,
		completedAt: session.completedAt,
		durationMinutes: session.durationMinutes,
		summary: session.summary,
		score: session.score,
		mistakes: [...session.mistakes],
		payload: session.payload,
	};
}

export function sanitizeLegacyData(data: z.infer<typeof LegacyAppDataSchema>): AppData {
	return {
		onboarded: data.onboarded,
		learnerName: data.learnerName,
		goal: data.goal,
		dailyMinutes: data.dailyMinutes,
		timeZone: 'Asia/Tokyo',
		startDate: null,
		entryDay: 1,
		studyStatus: 'active',
		currentDay: data.currentDay,
		streak: data.streak,
		core: { reviews: data.core.reviews, grammar: data.core.grammar, import: data.core.import },
		completedDays: Array.from(new Set(data.completedDays)).sort((a, b) => a - b),
		completedStudyDates: [],
		previewedDays: Array.from(new Set(data.previewedDays)).sort((a, b) => a - b),
		reviewCount: data.reviewCount,
		reviewBatchTotal: data.reviewCount,
		reviewBatchCompleted: 0,
		reviewCards: [],
		learningItems: [],
		remainingAcquisition: { words: 8, phrases: 3, previewGrammar: 1 },
		activity: {
			coreSessions: data.sessions.filter((item) => item.kind === 'core').length,
			boostSessions: data.sessions.filter((item) => item.kind === 'boost').length,
			reviewEvents: 0,
			acquiredWords: 0,
			acquiredPhrases: 0,
			grammarProgress: data.previewedDays.length,
		},
		baselineCompleted: false,
		stageAssessments: [],
		sessions: data.sessions.map(sanitizeImportedSession),
		mistakes: data.mistakes.map((mistake) => ({ ...mistake })),
		syncEnabled: data.syncEnabled,
		reduceMotion: data.reduceMotion,
	};
}
