import { CURRICULUM_MANIFEST } from '../src/curriculum/manifest';

const rows = CURRICULUM_MANIFEST.lessons.map((lesson) => ({
	day: lesson.day,
	stageId: lesson.stageId,
	grammar: lesson.content.grammar.title,
	practice: lesson.practiceBlocks.map((block) => ({
		kind: block.kind,
		title: block.title,
		sourceWords: block.sourceText?.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/gu)?.length ?? 0,
		prompts: block.prompts.map((prompt) => ({
			operation: prompt.operation,
			prompt: prompt.prompt,
			grammarCategory: prompt.grammarCategory,
			retrievalIntervals: prompt.retrievalTargets?.map((target) => target.intervalDays),
		})),
	})),
	practiceMinutes: lesson.practiceBlocks.reduce(
		(total, block) => total + block.estimatedMinutes,
		0,
	),
}));

const masterySampleDays = [
	1, 6, 18, 30, 54, 72, 90, 91, 120, 150, 180, 181, 210, 240, 270, 271, 285, 300, 315, 330, 345,
	350, 360, 365,
] as const;

const sampleArgument = process.argv.find((argument) => argument.startsWith('--samples='));

if (sampleArgument) {
	const requestedDays = new Set(sampleArgument.slice('--samples='.length).split(',').map(Number));
	console.log(
		JSON.stringify(
			CURRICULUM_MANIFEST.lessons
				.filter((lesson) => requestedDays.has(lesson.day))
				.map((lesson) => ({
					day: lesson.day,
					theme: lesson.content.theme,
					objective: lesson.content.objective,
					grammar: lesson.content.grammar,
					vocabulary: lesson.content.vocabulary.map((item) => item.text),
					phrases: lesson.content.phrases.map((item) => item.text),
					voiceTask: lesson.content.voiceTask,
					practice: lesson.practiceBlocks.map((block) => ({
						kind: block.kind,
						title: block.title,
						instructions: block.instructions,
						sourceText: block.sourceText,
						prompts: block.prompts.map((prompt) => ({
							operation: prompt.operation,
							prompt: prompt.prompt,
							guidance: prompt.guidance,
							feedback: prompt.feedback,
						})),
					})),
				})),
			null,
			2,
		),
	);
} else if (process.argv.includes('--mastery')) {
	const stageMetrics = CURRICULUM_MANIFEST.stages.map((stage) => {
		const lessons = rows.filter((row) => row.stageId === stage.id);
		const readingBlocks = lessons
			.flatMap((lesson) => lesson.practice)
			.filter((block) => block.sourceWords > 0);
		const minutes = lessons.map((lesson) => lesson.practiceMinutes);
		return {
			stage: stage.title,
			lessons: lessons.length,
			readingBlocks: readingBlocks.length,
			longFormBlocks: readingBlocks.filter((block) => block.sourceWords >= 400).length,
			averagePracticeMinutes: Number(
				(minutes.reduce((total, value) => total + value, 0) / minutes.length).toFixed(1),
			),
			maximumPracticeMinutes: Math.max(...minutes),
		};
	});
	const retrievalIntervals = rows
		.flatMap((row) => row.practice)
		.flatMap((block) => block.prompts)
		.flatMap((prompt) => prompt.retrievalIntervals ?? [])
		.reduce<Record<string, number>>((counts, interval) => {
			counts[`D+${interval}`] = (counts[`D+${interval}`] ?? 0) + 1;
			return counts;
		}, {});
	const grammarCategorySamples = Object.fromEntries(
		Object.entries(
			rows.reduce<Record<string, number[]>>((samples, row) => {
				const category = row.practice
					.flatMap((block) => block.prompts)
					.find((prompt) => prompt.grammarCategory)?.grammarCategory;
				if (category) (samples[category] ??= []).push(row.day);
				return samples;
			}, {}),
		).map(([category, days]) => [
			category,
			[days[0], days[Math.floor(days.length / 2)], days.at(-1)],
		]),
	);
	const grammarOperations = rows
		.flatMap((row) => row.practice)
		.flatMap((block) => block.prompts)
		.filter((prompt) => prompt.grammarCategory)
		.reduce<Record<string, number>>((counts, prompt) => {
			counts[prompt.operation] = (counts[prompt.operation] ?? 0) + 1;
			return counts;
		}, {});
	console.log(
		JSON.stringify(
			{
				lessons: rows.length,
				practicePrompts: rows
					.flatMap((row) => row.practice)
					.reduce((total, block) => total + block.prompts.length, 0),
				readingBlocks: rows.flatMap((row) => row.practice).filter((block) => block.sourceWords > 0)
					.length,
				longFormBlocks: rows
					.flatMap((row) => row.practice)
					.filter((block) => block.sourceWords >= 400).length,
				totalPracticeMinutes: rows.reduce((total, row) => total + row.practiceMinutes, 0),
				retrievalIntervals,
				grammarOperations,
				grammarCategorySamples,
				stageMetrics,
				samples: masterySampleDays.map((day) => {
					const row = rows[day - 1]!;
					const grammarPrompt = row.practice
						.flatMap((block) => block.prompts)
						.find((prompt) => prompt.grammarCategory);
					return {
						day,
						grammar: row.grammar,
						grammarCategory: grammarPrompt?.grammarCategory,
						grammarOperation: grammarPrompt?.operation,
						practiceMinutes: row.practiceMinutes,
						readingWords: Math.max(...row.practice.map((block) => block.sourceWords), 0),
						retrievalIntervals: row.practice
							.flatMap((block) => block.prompts)
							.flatMap((prompt) => prompt.retrievalIntervals ?? []),
					};
				}),
			},
			null,
			2,
		),
	);
} else if (process.argv.includes('--grammar')) {
	console.log(
		JSON.stringify(
			rows.map((row) => ({
				day: row.day,
				stage: row.stageId,
				title: row.grammar,
				focus: CURRICULUM_MANIFEST.lessons[row.day - 1]?.content.grammar.focus,
			})),
			null,
			2,
		),
	);
} else if (process.argv.includes('--labs')) {
	const fromArg = process.argv.find((argument) => argument.startsWith('--from='));
	const toArg = process.argv.find((argument) => argument.startsWith('--to='));
	const from = Number(fromArg?.split('=')[1] ?? 1);
	const to = Number(toArg?.split('=')[1] ?? 365);
	console.log(
		JSON.stringify(
			rows
				.filter((lesson) => from <= lesson.day && lesson.day <= to)
				.flatMap((lesson) =>
					lesson.practice
						.filter((block) => block.sourceWords > 0)
						.map((block) => ({
							day: lesson.day,
							title: block.title,
							sourceText: CURRICULUM_MANIFEST.lessons[lesson.day - 1]?.practiceBlocks.find(
								(candidate) => candidate.id === block.title || candidate.title === block.title,
							)?.sourceText,
							questions: block.prompts.map((prompt) => prompt.prompt),
						})),
				),
			null,
			2,
		),
	);
} else if (process.argv.includes('--json')) {
	console.log(JSON.stringify(rows, null, 2));
} else {
	const stages = CURRICULUM_MANIFEST.stages.map((stage) => {
		const lessons = rows.filter((row) => row.stageId === stage.id);
		const prompts = lessons.flatMap((lesson) => lesson.practice).flatMap((block) => block.prompts);
		const operations = prompts.reduce<Record<string, number>>((counts, prompt) => {
			counts[prompt.operation] = (counts[prompt.operation] ?? 0) + 1;
			return counts;
		}, {});
		const grammarCategories = prompts.reduce<Record<string, number>>((counts, prompt) => {
			if (prompt.grammarCategory)
				counts[prompt.grammarCategory] = (counts[prompt.grammarCategory] ?? 0) + 1;
			return counts;
		}, {});
		return {
			stage: stage.title,
			lessons: lessons.length,
			readingLabs: lessons.filter((lesson) =>
				lesson.practice.some((block) => block.sourceWords > 0),
			).length,
			operations,
			grammarCategories,
		};
	});
	console.table(stages);
}
