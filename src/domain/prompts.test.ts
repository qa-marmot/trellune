import { describe, expect, it } from 'vitest';
import {
	buildBoostPrompt,
	buildCorePrompt,
	buildBaselinePrompt,
	buildStudyContext,
	buildWeeklyPrompt,
	type LearnerPromptContext,
} from './prompts';

const context: LearnerPromptContext = {
	learnerName: 'Learner',
	curriculumDay: 4,
	theme: '持ち物',
	objective: '持ち物を説明する',
	grammarTitle: 'have',
	grammarFocus: 'I have / I do not have',
	voiceTask: '短い会話をする',
	dueReviews: [],
	todayVocabulary: [{ text: 'bag', meaning: 'かばん' }],
	todayPhrases: [],
	recentMistakes: [],
	remainingNewWords: 8,
	remainingNewPhrases: 3,
	remainingPreviewGrammar: 1,
	nextGrammar: {
		curriculumDay: 5,
		topicId: 'd5-grammar',
		title: 'there is / are',
		focus: '場所にある物を説明する',
	},
};

describe('learning conversation prompt contracts', () => {
	it('separates request, learner data and output instructions for Core', () => {
		const value = buildCorePrompt(context);
		expect(value).toContain('LEARNING_CONVERSATION_REQUEST');
		expect(value).toContain('contractVersion: 1.0');
		expect(value).toContain('LEARNER_CONTEXT');
		expect(value).toContain('OUTPUT_REQUEST');
		expect(value).toContain('remainingPreviewGrammar: 0');
		expect(value).toContain('SESSION_JSONを出力');
	});

	it('renders legacy provider wording in a bundled Voice task as provider-neutral output', () => {
		const value = buildCorePrompt(
			{
				...context,
				voiceTask: 'ChatGPTと段階的な会話練習を行う。',
			},
			'generic',
		);
		expect(value).toContain('会話AIと段階的な会話練習を行う。');
		expect(value).not.toContain('ChatGPT');
	});

	it.each([
		[1, '短くゆっくり'],
		[31, '短いlistening turn'],
		[91, '1〜2回follow-up'],
		[181, 'near-natural寄りの制御された速度'],
		[271, 'stance・implication・別視点'],
	] as const)('adds bounded Stage Voice coaching at Day %i', (curriculumDay, expected) => {
		const value = buildCorePrompt({ ...context, curriculumDay });
		expect(value).toContain('VOICE_COACHING');
		expect(value).toContain(expected);
		expect(value).toContain('理解不能なら');
	});

	it.each(
		[
			...(['review_rescue', 'speaking_sprint', 'grammar_deep_dive', 'scenario_challenge'] as const),
			...(['weakness_attack', 'next_lesson_preview', 'free_talk'] as const),
		].flatMap((mode) => ([5, 15, 30, 60] as const).map((duration) => [mode, duration] as const)),
	)('preserves Boost mode %s at %i minutes', (mode, duration) => {
		const value = buildBoostPrompt(context, duration, mode);
		expect(value).toContain(`boostDuration: ${duration}`);
		expect(value).toContain(`boostMode: ${mode}`);
	});

	it('pins Next Lesson Preview to the exact next grammar and requires one preview', () => {
		const value = buildBoostPrompt(context, 15, 'next_lesson_preview');
		expect(value).toContain('curriculumDay: 5');
		expect(value).toContain('topicId: d5-grammar');
		expect(value).toContain('previewGrammarは上記topicIdの1件だけ');
	});

	it('requires an empty preview array outside Next Lesson Preview', () => {
		expect(buildBoostPrompt(context, 15, 'free_talk')).toContain('previewGrammarを必ず空配列');
	});

	it('labels Study Mode as a normal non-Project chat with no SESSION_JSON', () => {
		const value = buildStudyContext(context);
		expect(value).toContain('通常のテキスト会話');
		expect(value).toContain('SESSION_JSONを出力しない');
	});

	it('keeps baseline and weekly assessments separate from SESSION_JSON', () => {
		expect(buildBaselinePrompt('Learner')).toContain('SESSION_JSONを生成しません');
		const weekly = buildWeeklyPrompt(1, 7, ['自己紹介'], ['be動詞'], ['Nice to meet you.']);
		expect(weekly).toContain('学習済み文法');
		expect(weekly).toContain('学習済み表現');
		expect(weekly).toContain('SESSION_JSONを生成しません');
	});
});
