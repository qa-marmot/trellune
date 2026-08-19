import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createServer } from 'vite';

const server = await createServer({
	appType: 'custom',
	logLevel: 'silent',
	server: { middlewareMode: true },
});
try {
	const prompts = await server.ssrLoadModule('/src/domain/prompts.ts');
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
	};
	const boostModes = [
		'review_rescue',
		'speaking_sprint',
		'grammar_deep_dive',
		'scenario_challenge',
		'weakness_attack',
		'next_lesson_preview',
		'free_talk',
	];
	const artifacts = new Map([
		['DAILY_CORE_PROMPT_TEMPLATE.txt', prompts.buildCorePrompt(context)],
		[
			'BOOST_PROMPT_TEMPLATES.txt',
			[5, 15, 30, 60]
				.flatMap((duration) =>
					boostModes.map((mode) => prompts.buildBoostPrompt(context, duration, mode)),
				)
				.join('\n\n----- NEXT BOOST VARIANT -----\n\n'),
		],
		['STUDY_MODE_INITIAL_PROMPT.txt', prompts.buildStudyContext(context)],
		['BASELINE_ASSESSMENT_PROMPT.txt', prompts.buildBaselinePrompt('{{LEARNER_NAME}}')],
		[
			'WEEKLY_ASSESSMENT_PROMPT.txt',
			prompts.buildWeeklyPrompt(
				'{{START_DAY}}',
				'{{END_DAY}}',
				['{{WEEK_OBJECTIVES}}'],
				['{{GRAMMAR}}'],
				['{{PHRASES}}'],
				['{{REPEATED_MISTAKES}}'],
			),
		],
	]);
	const check = process.argv.includes('--check');
	let drift = false;
	for (const [filename, content] of artifacts) {
		const target = path.resolve('chatgpt-project-sources', filename);
		const expected = `${content.trim()}\n`;
		if (check) {
			const current = await readFile(target, 'utf8');
			if (current.replace(/\r\n/gu, '\n') !== expected) {
				process.stderr.write(`Prompt artifact drift: ${filename}\n`);
				drift = true;
			}
		} else {
			await writeFile(target, expected, 'utf8');
		}
	}
	if (drift) process.exitCode = 1;
} finally {
	await server.close();
}
