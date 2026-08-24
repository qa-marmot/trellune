import { describe, expect, it } from 'vitest';
import baselineArtifact from '../../chatgpt-project-sources/BASELINE_ASSESSMENT_PROMPT.txt?raw';
import boostArtifact from '../../chatgpt-project-sources/BOOST_PROMPT_TEMPLATES.txt?raw';
import coreArtifact from '../../chatgpt-project-sources/DAILY_CORE_PROMPT_TEMPLATE.txt?raw';
import studyArtifact from '../../chatgpt-project-sources/STUDY_MODE_INITIAL_PROMPT.txt?raw';
import weeklyArtifact from '../../chatgpt-project-sources/WEEKLY_ASSESSMENT_PROMPT.txt?raw';
import baselineArtifactEn from '../../chatgpt-project-sources/BASELINE_ASSESSMENT_PROMPT_EN.txt?raw';
import boostArtifactEn from '../../chatgpt-project-sources/BOOST_PROMPT_TEMPLATES_EN.txt?raw';
import coreArtifactEn from '../../chatgpt-project-sources/DAILY_CORE_PROMPT_TEMPLATE_EN.txt?raw';
import studyArtifactEn from '../../chatgpt-project-sources/STUDY_MODE_INITIAL_PROMPT_EN.txt?raw';
import weeklyArtifactEn from '../../chatgpt-project-sources/WEEKLY_ASSESSMENT_PROMPT_EN.txt?raw';
import {
	buildBaselinePrompt,
	buildBoostPrompt,
	buildCorePrompt,
	buildStudyContext,
	buildWeeklyPrompt,
	type LearnerPromptContext,
} from './prompts';

const context = {
	learnerName: '{{LEARNER_NAME}}',
	curriculumDay: '{{CURRICULUM_DAY}}',
	theme: '{{THEME}}',
	objective: '{{OBJECTIVE}}',
	grammarTitle: '{{GRAMMAR_TITLE}}',
	grammarFocus: '{{GRAMMAR_FOCUS}}',
	voiceTask: '{{VOICE_TASK}}',
	dueReviews: ['{{DUE_REVIEWS}}'],
	todayVocabulary: ['{{TODAY_VOCABULARY}}'],
	todayPhrases: ['{{TODAY_PHRASES}}'],
	recentMistakes: ['{{RECENT_MISTAKES}}'],
	remainingNewWords: '{{REMAINING_NEW_WORDS}}',
	remainingNewPhrases: '{{REMAINING_NEW_PHRASES}}',
	remainingPreviewGrammar: '{{REMAINING_PREVIEW_GRAMMAR}}',
	nextGrammar: {
		curriculumDay: '{{NEXT_CURRICULUM_DAY}}',
		topicId: '{{NEXT_GRAMMAR_TOPIC_ID}}',
		title: '{{NEXT_GRAMMAR_TITLE}}',
		focus: '{{NEXT_GRAMMAR_FOCUS}}',
	},
} as unknown as LearnerPromptContext;

const boostModes = [
	'review_rescue',
	'speaking_sprint',
	'grammar_deep_dive',
	'scenario_challenge',
	'weakness_attack',
	'next_lesson_preview',
	'free_talk',
] as const;

const artifact = (value: string) => value.replace(/\r\n/gu, '\n').trim();

describe('generated prompt artifacts', () => {
	it('matches every checked-in prompt to the TypeScript source of truth', () => {
		expect(artifact(coreArtifact)).toBe(buildCorePrompt(context));
		expect(artifact(boostArtifact)).toBe(
			([5, 15, 30, 60] as const)
				.flatMap((duration) => boostModes.map((mode) => buildBoostPrompt(context, duration, mode)))
				.join('\n\n----- NEXT BOOST VARIANT -----\n\n'),
		);
		expect(artifact(studyArtifact)).toBe(buildStudyContext(context));
		expect(artifact(baselineArtifact)).toBe(buildBaselinePrompt('{{LEARNER_NAME}}'));
		expect(artifact(weeklyArtifact)).toBe(
			buildWeeklyPrompt(
				'{{START_DAY}}' as never,
				'{{END_DAY}}' as never,
				['{{WEEK_OBJECTIVES}}'],
				['{{GRAMMAR}}'],
				['{{PHRASES}}'],
				['{{REPEATED_MISTAKES}}'] as never,
			),
		);
	});

	it('matches English checked-in prompts and contains no Japanese fallback', () => {
		const englishContext = { ...context, supportLanguage: 'en' as const };
		const expected = [
			buildCorePrompt(englishContext),
			([5, 15, 30, 60] as const)
				.flatMap((duration) =>
					boostModes.map((mode) => buildBoostPrompt(englishContext, duration, mode)),
				)
				.join('\n\n----- NEXT BOOST VARIANT -----\n\n'),
			buildStudyContext(englishContext),
			buildBaselinePrompt('{{LEARNER_NAME}}', 'en'),
			buildWeeklyPrompt(
				'{{START_DAY}}' as never,
				'{{END_DAY}}' as never,
				['{{WEEK_OBJECTIVES}}'],
				['{{GRAMMAR}}'],
				['{{PHRASES}}'],
				['{{REPEATED_MISTAKES}}'] as never,
				'en',
			),
		];
		const artifacts = [
			coreArtifactEn,
			boostArtifactEn,
			studyArtifactEn,
			baselineArtifactEn,
			weeklyArtifactEn,
		];
		for (const [index, value] of artifacts.entries()) {
			expect(artifact(value)).toBe(expected[index]);
			expect(value).not.toMatch(/[ぁ-んァ-ン一-龯]/u);
		}
	});
});
