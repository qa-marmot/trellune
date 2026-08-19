import type { CurriculumDay } from '../curriculum';
import type {
	PracticeBlock,
	PracticeFeedback,
	PracticeOutput,
	PracticePrompt,
	PracticeRetrievalTarget,
} from '../../curriculum/model';
import { selectGrammarTargeting } from './grammarTargeting';
import type { LongFormChallengeSeed } from './longForm';
import { AUTHORED_READING_FEEDBACK } from './readingFeedback';

export interface IntegratedLabSeed {
	readonly day: number;
	readonly title: string;
	readonly sourceText: string;
	readonly comprehension: string;
	readonly writing: string;
	readonly guidance: string;
	readonly output: PracticeOutput;
	readonly readingOperation?: PracticePrompt['operation'];
	readonly writingOperation?: PracticePrompt['operation'];
}

function lessonPrefix(day: number): string {
	return `english-os-core-day-${String(day).padStart(3, '0')}-practice`;
}

function freezePrompt(prompt: PracticePrompt): PracticePrompt {
	return Object.freeze({
		...prompt,
		feedback: Object.freeze({
			...prompt.feedback,
			keyPoints: prompt.feedback.keyPoints
				? Object.freeze([...prompt.feedback.keyPoints])
				: undefined,
			commonErrors: prompt.feedback.commonErrors
				? Object.freeze([...prompt.feedback.commonErrors])
				: undefined,
			checklist: Object.freeze([...prompt.feedback.checklist]),
			targetFeatures: prompt.feedback.targetFeatures
				? Object.freeze([...prompt.feedback.targetFeatures])
				: undefined,
		}),
		retrievalTargets: prompt.retrievalTargets
			? Object.freeze(prompt.retrievalTargets.map((target) => Object.freeze({ ...target })))
			: undefined,
	});
}

function grammarChecklist(day: number): readonly string[] {
	if (day <= 90)
		return ['設問の内容に答えた', '主語と動詞がある', '今日の形を使った', '相手に意味が伝わる'];
	if (day <= 180)
		return [
			'設問に直接答えた',
			'考えを順序立てた',
			'target grammarを使った',
			'理由か例を加えた',
			'読み返して意味を明確にした',
		];
	if (day <= 270)
		return [
			'説明を整理した',
			'詳細か言い換えを加えた',
			'文法の時制・形を制御した',
			'文同士を自然につないだ',
		];
	return [
		'課題に答え、立場を明確にした',
		'根拠と限定・反対視点を扱った',
		'段落を組織し、文同士をつないだ',
		'語句とregisterを場面に合わせた',
		'文法を制御し、意味を明確にした',
	];
}

function writingFeedback(day: number, guidance: string): PracticeFeedback {
	return {
		rationale:
			'語数だけではなく、課題達成・伝わりやすさ・target languageを自分の回答で照合します。',
		commonErrors: [
			'語数を増やすために課題と無関係な文を足す',
			'理由・例・限定のうち設問が求める要素を落とす',
		],
		checklist: grammarChecklist(day),
		targetFeatures: [guidance],
	};
}

function grammarTransfer(
	content: CurriculumDay,
	previous: CurriculumDay | undefined,
): PracticeBlock {
	const prefix = lessonPrefix(content.day);
	const earlyFoundation = content.day <= 30;
	const independent = content.day > 90 && content.day <= 180;
	const fluency = content.day > 180 && content.day <= 270;
	const b2Challenge = content.day > 270;
	const targeting = selectGrammarTargeting(content, previous);
	const minimumWords = b2Challenge
		? 60
		: fluency
			? 42
			: independent
				? 28
				: earlyFoundation
					? 5
					: 14;
	const maximumWords = b2Challenge
		? 160
		: fluency
			? 125
			: independent
				? 90
				: earlyFoundation
					? 30
					: 55;
	return Object.freeze({
		id: `${prefix}-grammar-transfer`,
		kind: 'grammar',
		title:
			content.day > 180
				? '文法を長い発話・説明へ統合する'
				: independent
					? '文法を場面へ移す'
					: '今日の形を自分の文にする',
		instructions: '模範解答の完全一致ではなく、意味・形・場面の3点を自分で確認します。',
		estimatedMinutes: b2Challenge ? 9 : fluency ? 8 : independent ? 7 : 5,
		skillTargets: Object.freeze(['grammar', 'writing'] as const),
		prompts: Object.freeze([
			freezePrompt({
				id: `${prefix}-grammar-transfer-prompt`,
				operation: targeting.operation,
				prompt: targeting.prompt,
				guidance: b2Challenge
					? '5〜8文を目安に、主張・根拠・例または限定をつなぎ、正確さと読みやすさを点検します。'
					: fluency
						? '4〜6文を目安に、文法を一文だけで終わらせず、説明・例・結論へつなげます。'
						: independent
							? '2〜4文を目安に、target grammarを最低1回使い、読み返して主語・時制・語順を点検します。'
							: earlyFoundation
								? '短くて構いません。主語と動詞を含む完全な英文にします。'
								: '1〜3文を目安に、今日の形を最低1回使います。',
				feedback: {
					rationale:
						'今日の文法を別の意味・場面へ移せるかを、形だけでなく伝えたい内容と一緒に点検します。',
					commonErrors: targeting.commonErrors,
					checklist: grammarChecklist(content.day),
					targetFeatures: [targeting.category, content.grammar.title, content.grammar.focus],
				},
				grammarCategory: targeting.category,
			}),
		]),
		output: Object.freeze({
			format: b2Challenge
				? 'opinion'
				: fluency
					? 'paragraph'
					: earlyFoundation
						? 'sentence'
						: 'connected-sentences',
			minimumWords,
			maximumWords,
		}),
	});
}

function vocabularyRetrieval(
	content: CurriculumDay,
	history: readonly CurriculumDay[],
): PracticeBlock {
	const prefix = lessonPrefix(content.day);
	const currentTargets = content.vocabulary
		.slice(0, content.day <= 90 ? 2 : 3)
		.map((item) => item.text);
	const longInterval = ([3, 7, 21] as const)[(content.day - 2 + 3) % 3]!;
	const requestedIntervals = content.day === 1 ? [] : ([1, longInterval] as const);
	const retrievalTargets: PracticeRetrievalTarget[] = requestedIntervals.flatMap((intervalDays) => {
		const introducedDay = content.day - intervalDays;
		const source = history[introducedDay - 1];
		if (!source?.vocabulary.length) return [];
		return [
			{
				text: source.vocabulary[(content.day + intervalDays) % source.vocabulary.length]!.text,
				introducedDay,
				intervalDays,
			},
		];
	});
	const targets = [
		...new Set([...currentTargets, ...retrievalTargets.map((target) => target.text)]),
	];
	const independent = content.day > 90;
	const fluency = content.day > 180 && content.day <= 270;
	const b2Challenge = content.day > 270;
	const operation =
		content.day === 1
			? 'controlled-production'
			: longInterval === 3
				? 'contextual-application'
				: longInterval === 7
					? 'cumulative-retrieval'
					: 'paraphrase';
	const intervalInstruction = retrievalTargets
		.map((target) => `D+${target.intervalDays}: ${target.text}`)
		.join(' / ');
	const prompt =
		content.day === 1
			? `${targets.join(' / ')} から1語を選び、その語が自然に入る短い英文を書いてください。`
			: longInterval === 3
				? `${intervalInstruction} を文脈に戻します。自然なcollocationを使い、「${content.theme}」の短い発言と返答を書いてください。`
				: longInterval === 7
					? `${intervalInstruction} を見ずに思い出し、少なくとも1語を具体例へ使ってください。今日の語句も1語つなげます。`
					: `${intervalInstruction} のうち1語を直接使わず簡単な英語で言い換えた後、その語を含む自分の文で確認してください。`;
	return Object.freeze({
		id: `${prefix}-vocabulary-retrieval`,
		kind: 'vocabulary',
		title:
			content.day > 180
				? '語句を説明・言い換え・議論で再利用する'
				: independent
					? '語句を説明・再利用する'
					: '今日の語句を思い出して使う',
		instructions:
			content.day === 1
				? 'カードを見るだけで終わらず、場面のある英文へ変換します。'
				: '今日の語句に短期・長期の既習語句を最大2件混ぜ、負荷を増やしすぎず使い直します。',
		estimatedMinutes: content.day > 180 ? 6 : independent ? 5 : 4,
		skillTargets: Object.freeze(['vocabulary', 'writing'] as const),
		prompts: Object.freeze([
			freezePrompt({
				id: `${prefix}-vocabulary-retrieval-prompt`,
				operation,
				prompt,
				guidance: '語の意味だけでなく、前後の語との組み合わせが自然かも確認します。',
				feedback: {
					rationale:
						'日本語の意味を思い出すだけでなく、場面のある英文でcollocationとして再利用できたかを確認します。',
					commonErrors: [
						'target語を並べるだけで文の意味を作らない',
						'前後の語の組み合わせを確認しない',
					],
					checklist: [
						'設問が指定した語数・個数のtargetを使った',
						'英文の意味が具体的に伝わる',
						'前後の語との組み合わせが自然か確認した',
					],
					targetFeatures: targets,
				},
				retrievalTargets,
			}),
		]),
		output: Object.freeze({
			format: b2Challenge
				? 'opinion'
				: fluency
					? 'paragraph'
					: independent
						? 'connected-sentences'
						: 'sentence',
			minimumWords: b2Challenge ? 30 : fluency ? 24 : independent ? 18 : 5,
			maximumWords: b2Challenge ? 95 : fluency ? 80 : independent ? 65 : 35,
		}),
	});
}

function integratedLab(seed: IntegratedLabSeed): PracticeBlock {
	const prefix = lessonPrefix(seed.day);
	const readingFeedback = AUTHORED_READING_FEEDBACK.get(seed.day);
	if (!readingFeedback) throw new Error(`Day ${seed.day} のReading feedbackがありません。`);
	const comprehensionOutput: PracticeOutput = Object.freeze({
		format: seed.day <= 90 ? 'sentence' : 'connected-sentences',
		minimumWords: seed.day <= 90 ? 5 : seed.day <= 180 ? 12 : seed.day <= 270 ? 18 : 25,
		maximumWords: seed.day <= 90 ? 35 : seed.day <= 180 ? 50 : seed.day <= 270 ? 65 : 80,
	});
	return Object.freeze({
		id: `${prefix}-reading-writing-lab`,
		kind: 'integration',
		title: seed.title,
		instructions: '本文を先に読み、見直さず要点を思い出してから英語で答えます。',
		estimatedMinutes: seed.day <= 90 ? 10 : seed.day <= 180 ? 15 : seed.day <= 270 ? 17 : 20,
		skillTargets: Object.freeze(['reading', 'writing', 'vocabulary'] as const),
		sourceText: seed.sourceText,
		prompts: Object.freeze([
			freezePrompt({
				id: `${prefix}-reading-comprehension`,
				operation: seed.readingOperation ?? (seed.day <= 90 ? 'comprehension' : 'inference'),
				prompt: seed.comprehension,
				output: comprehensionOutput,
				guidance: '本文の語句を全部写さず、答えに必要な部分だけを使います。',
				feedback: {
					keyPoints: readingFeedback.keyPoints,
					rationale: '設問が求める情報を本文の根拠と結び、完全一致ではなく意味の要点で比較します。',
					evidenceClue: readingFeedback.evidenceClue,
					commonErrors: [readingFeedback.commonMisunderstanding],
					checklist: [
						'設問に直接答えた',
						'key pointを含めた',
						'本文の根拠と矛盾していない',
						'本文を丸写しせず自分の英語で答えた',
					],
				},
			}),
			freezePrompt({
				id: `${prefix}-writing-response`,
				operation:
					seed.writingOperation ??
					(seed.output.format === 'summary'
						? 'summary'
						: seed.day > 180
							? 'free-production'
							: 'guided-production'),
				prompt: seed.writing,
				output: Object.freeze(seed.output),
				guidance: seed.guidance,
				feedback: writingFeedback(seed.day, seed.guidance),
			}),
		]),
	});
}

function longFormChallenge(seed: LongFormChallengeSeed): PracticeBlock {
	const prefix = lessonPrefix(seed.day);
	return Object.freeze({
		id: `${prefix}-long-form-challenge`,
		kind: 'integration',
		title: seed.title,
		instructions:
			'最初に全体を止まらず読み、gistを一文で思い出します。その後だけ本文へ戻り、必要なdetailと根拠を探します。',
		estimatedMinutes: seed.day <= 270 ? 26 : 28,
		skillTargets: Object.freeze(['reading', 'writing', 'vocabulary'] as const),
		sourceText: seed.sourceText,
		prompts: Object.freeze([
			...seed.readingQuestions.map((question, index) =>
				freezePrompt({
					id: `${prefix}-long-form-reading-${index + 1}`,
					operation: question.operation,
					prompt: question.prompt,
					output: Object.freeze(question.output),
					guidance:
						index === 0
							? 'まずgist、次に必要なdetailの順で確認します。'
							: '推論の強さを本文以上にしません。',
					feedback: question.feedback,
				}),
			),
			freezePrompt({
				id: `${prefix}-long-form-writing`,
				operation: seed.writingOutput.format === 'summary' ? 'summary' : 'free-production',
				prompt: seed.writing,
				output: Object.freeze(seed.writingOutput),
				guidance: seed.writingGuidance,
				feedback: writingFeedback(seed.day, seed.writingGuidance),
			}),
		]),
	});
}

export function buildPracticeBlocks(
	content: CurriculumDay,
	history: readonly CurriculumDay[],
	labs: ReadonlyMap<number, IntegratedLabSeed>,
	longFormChallenges: ReadonlyMap<number, LongFormChallengeSeed> = new Map(),
): readonly PracticeBlock[] {
	const blocks = [grammarTransfer(content, history.at(-1)), vocabularyRetrieval(content, history)];
	const lab = labs.get(content.day);
	if (lab) blocks.push(integratedLab(lab));
	const challenge = longFormChallenges.get(content.day);
	if (challenge) blocks.push(longFormChallenge(challenge));
	return Object.freeze(blocks);
}
