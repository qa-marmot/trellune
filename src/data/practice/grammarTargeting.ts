import type { CurriculumDay } from '../curriculum';
import type { GrammarCategory, PracticePrompt } from '../../curriculum/model';

type GrammarOperation = PracticePrompt['operation'];

export interface GrammarTargeting {
	readonly category: GrammarCategory;
	readonly operation: GrammarOperation;
	readonly prompt: string;
	readonly commonErrors: readonly string[];
}

const CATEGORY_OPERATIONS = {
	'tense-aspect': ['transformation', 'error-correction', 'contextual-application'],
	'question-word-order': ['error-correction', 'controlled-production', 'contextual-application'],
	'noun-article-quantity': ['error-correction', 'controlled-production', 'contextual-application'],
	comparison: ['transformation', 'contextual-application', 'guided-production'],
	'modal-condition': ['contextual-application', 'error-correction', 'transformation'],
	'clause-linking': ['contextual-application', 'paraphrase', 'guided-production'],
	'passive-reported': ['transformation', 'error-correction', 'contextual-application'],
	'discourse-cohesion': ['contextual-application', 'paraphrase', 'cumulative-retrieval'],
	'hedging-stance': ['paraphrase', 'error-correction', 'contextual-application'],
	'interaction-repair': ['contextual-application', 'paraphrase', 'guided-production'],
	'paraphrase-explanation': ['paraphrase', 'contextual-application', 'guided-production'],
	'integrated-grammar': ['cumulative-retrieval', 'contextual-application', 'free-production'],
} as const satisfies Record<GrammarCategory, readonly GrammarOperation[]>;

const EARLY_FOUNDATION_OPERATION = {
	'tense-aspect': 'guided-production',
	'question-word-order': 'controlled-production',
	'noun-article-quantity': 'controlled-production',
	comparison: 'guided-production',
	'modal-condition': 'contextual-application',
	'clause-linking': 'guided-production',
	'passive-reported': 'guided-production',
	'discourse-cohesion': 'guided-production',
	'hedging-stance': 'guided-production',
	'interaction-repair': 'guided-production',
	'paraphrase-explanation': 'guided-production',
	'integrated-grammar': 'guided-production',
} as const satisfies Record<GrammarCategory, GrammarOperation>;

function includesAny(value: string, needles: readonly string[]): boolean {
	return needles.some((needle) => value.includes(needle));
}

export function classifyGrammar(content: CurriculumDay): GrammarCategory {
	const target = `${content.grammar.title} ${content.grammar.focus}`.toLocaleLowerCase('en-US');
	if (
		includesAny(target, [
			'graduation challenge integration',
			'b2 challenge integration',
			'fluency stage integration',
			'independent stage integration',
			'integrated extended interaction',
			'全項目の統合',
		])
	)
		return 'integrated-grammar';
	if (target.includes('need + 名詞 / to')) return 'clause-linking';
	if (includesAny(target, ['頻度副詞', 'frequency adverb', 'always / usually']))
		return 'tense-aspect';
	if (target.includes('comparison question')) return 'comparison';
	if (includesAny(target, ['condition', 'conditional', '仮定', 'if-clause']))
		return 'modal-condition';
	if (
		includesAny(target, [
			'聞き返',
			'依頼',
			'命令文',
			'request',
			'clarif',
			'repair',
			'follow-up',
			'応答',
			'相づち',
			'turn-taking',
		])
	)
		return 'interaction-repair';
	if (
		includesAny(target, [
			'hedg',
			'stance',
			'部分同意',
			'i see your point',
			'certainty',
			'qualification',
			'慎重',
			'断定',
			'推測の強さ',
		])
	)
		return 'hedging-stance';
	if (includesAny(target, ['paraphr', 'rephras', '言い換', '要約', 'summary', 'analogy']))
		return 'paraphrase-explanation';
	if (includesAny(target, ['受動', 'passive', 'reported', '間接話法', '伝聞']))
		return 'passive-reported';
	if (
		includesAny(target, [
			'冠詞',
			'article',
			'可算',
			'不可算',
			'名詞',
			'形容詞の語順',
			'quantity',
			'数量',
			'some / any',
			'much',
			'many',
		])
	)
		return 'noun-article-quantity';
	if (includesAny(target, ['疑問', 'question', 'word order', '語順'])) return 'question-word-order';
	if (includesAny(target, ['比較', '最上級', 'compar', 'superlative', 'trade-off']))
		return 'comparison';
	if (
		includesAny(target, [
			'if',
			'condition',
			'仮定',
			'should',
			'must',
			'have to',
			'may',
			'might',
			'could',
			'modal',
			'義務',
			'助言',
		])
	)
		return 'modal-condition';
	if (
		includesAny(target, [
			'relative',
			'関係詞',
			'clause',
			'節',
			'infinitive',
			'gerund',
			'不定詞',
			'動名詞',
		])
	)
		return 'clause-linking';
	if (
		includesAny(target, [
			'because',
			' so',
			'therefore',
			'recommendation bridge',
			'although',
			'however',
			'contrast',
			'concession',
			'cause',
			'effect',
			'接続',
			'順序',
			'cohesion',
			'discourse',
		])
	)
		return 'discourse-cohesion';
	if (
		includesAny(target, [
			'現在',
			'過去',
			'未来',
			'完了',
			'進行',
			'present',
			'past',
			'future',
			'perfect',
			'continuous',
			'will',
			'going to',
			'時制',
		])
	)
		return 'tense-aspect';
	return 'integrated-grammar';
}

function curatedError(content: CurriculumDay, category: GrammarCategory) {
	const target = `${content.grammar.title} ${content.grammar.focus}`.toLocaleLowerCase('en-US');
	if (includesAny(target, ['頻度副詞', 'frequency adverb']))
		return [
			'I go always to the gym.',
			'I always go to the gym.',
			'a frequency adverb normally comes before a main verb',
		] as const;
	if (target.includes('a table for'))
		return [
			'We could a table for three?',
			'Could we have a table for three?',
			'a polite request needs a modal, subject, and base-form verb',
		] as const;
	if (includesAny(target, ['命令文・依頼', '聞き返し']))
		return [
			'Repeat.',
			'Could you repeat that, please?',
			'a complete, polite request is easier to respond to than an abrupt command',
		] as const;
	if (target.includes('need + 名詞 / to'))
		return [
			'I need make an appointment.',
			'I need to make an appointment.',
			'need takes a noun for a thing and to plus the base form for an action',
		] as const;
	if (includesAny(target, ['want to / need to', '目的を表す不定詞']))
		return [
			'I want buy a shirt for work.',
			'I want to buy a shirt for work.',
			'want and need take to plus the base form before an intended action',
		] as const;
	if (target.includes('形容詞の語順'))
		return [
			'I need a blue large bag.',
			'I need a large blue bag.',
			'size normally comes before colour in this adjective sequence',
		] as const;
	if (includesAny(target, ['部分同意', 'i see your point']))
		return [
			'I agree you, but the cost is high.',
			'I agree with you, but the cost is high.',
			'agree with introduces the person whose point you accept',
		] as const;
	if (includesAny(target, ['過去形の疑問', 'did ...?']))
		return [
			'Did you went there yesterday?',
			'Did you go there yesterday?',
			'did carries past tense, so the main verb stays in the base form',
		] as const;
	if (target.includes('time clauses in narratives'))
		return [
			'Before we left, we check the weather.',
			'Before we left, we checked the weather.',
			'the linked events are both completed in this past narrative',
		] as const;
	if (includesAny(target, ['indirect', 'embedded question']))
		return [
			'Do you know where is the station?',
			'Do you know where the station is?',
			'an embedded question uses statement word order',
		] as const;
	if (category === 'integrated-grammar' && includesAny(target, ['integration', '統合']))
		return [
			'Although the evidence is limited. I am definitely B2.',
			'Although the evidence is limited, the assessment suggests B2-entry.',
			'integrate the dependent clause and match certainty to the evidence',
		] as const;
	if (category === 'hedging-stance')
		return [
			'This small survey proves the policy always works.',
			'This small survey suggests the policy may work in similar conditions.',
			'the evidence supports a limited claim, not certainty',
		] as const;
	if (category === 'tense-aspect' && includesAny(target, ['現在完了', 'present perfect']))
		return [
			'I have went there last year.',
			'I went there last year.',
			'finished past time takes the simple past; the participle of go is gone',
		] as const;
	if (category === 'noun-article-quantity' && includesAny(target, ['冠詞', 'article', '可算']))
		return [
			'I bought book yesterday.',
			'I bought a book yesterday.',
			'a singular countable noun needs a determiner',
		] as const;
	if (category === 'modal-condition' && includesAny(target, ['if', 'condition', '仮定']))
		return [
			'If it will rain, we will stay home.',
			'If it rains, we will stay home.',
			'the first-conditional if-clause normally uses the present form',
		] as const;
	if (category === 'passive-reported' && includesAny(target, ['reported', '間接話法']))
		return [
			'She said me that she was busy.',
			'She told me that she was busy.',
			'tell takes a person; say does not take this direct-object pattern',
		] as const;
	if (category === 'passive-reported' && includesAny(target, ['受動', 'passive']))
		return [
			'The bridge was build in 1990.',
			'The bridge was built in 1990.',
			'the passive needs be plus the past participle',
		] as const;
	const examples = {
		'tense-aspect': [
			'Yesterday I go to the office.',
			'Yesterday I went to the office.',
			'a finished past-time marker needs a past form',
		],
		'question-word-order': [
			'Where you work?',
			'Where do you work?',
			'a present simple question needs an auxiliary before the subject',
		],
		'noun-article-quantity': [
			'I need an information.',
			'I need some information.',
			'information is uncountable in this use',
		],
		comparison: [
			'This route is more faster.',
			'This route is faster.',
			'do not use more with an -er comparative',
		],
		'modal-condition': [
			'You should to ask first.',
			'You should ask first.',
			'a modal is followed by the base form',
		],
		'clause-linking': [
			'The person which helped me was kind.',
			'The person who helped me was kind.',
			'who is the usual relative pronoun for a person',
		],
		'passive-reported': [
			'They said the plan is changed.',
			'They said that the plan had changed.',
			'reported time and the intended meaning need to stay clear',
		],
		'discourse-cohesion': [
			'The plan is cheaper. Although, it is slower.',
			'Although the plan is cheaper, it is slower.',
			'although introduces a clause; however links separate statements',
		],
		'hedging-stance': [
			'This small survey proves the policy always works.',
			'This small survey suggests the policy may work in similar conditions.',
			'the evidence supports a limited claim, not certainty',
		],
		'interaction-repair': [
			'What?',
			'Sorry, do you mean the first option or the second one?',
			'a specific clarification question is easier to answer and less abrupt',
		],
		'paraphrase-explanation': [
			'It is a thing for things.',
			'It is a small tool that opens bottles.',
			'an effective paraphrase gives category and function',
		],
		'integrated-grammar': [
			'Because it was late. We left.',
			'Because it was late, we left.',
			'connect the dependent reason clause to a complete main clause',
		],
	} as const satisfies Record<GrammarCategory, readonly [string, string, string]>;
	return examples[category];
}

function promptFor(
	content: CurriculumDay,
	previous: CurriculumDay | undefined,
	category: GrammarCategory,
	operation: GrammarOperation,
): string {
	const [incorrect, correction, reason] = curatedError(content, category);
	if (operation === 'error-correction')
		return `日本人学習者に多い例「${incorrect}」を「${correction}」へ直す理由（${reason}）を確認し、同じ種類の誤りを避けて「${content.theme}」の自分の英文を書いてください。`;
	const target = `${content.grammar.title} ${content.grammar.focus}`.toLocaleLowerCase('en-US');
	if (includesAny(target, ['頻度副詞', 'frequency adverb']))
		return `「${content.theme}」についてalways / usually / sometimes / neverから意味の合う三つを選び、頻度を比べられる短い英文を書いてください。`;
	if (target.includes('a table for'))
		return `「${content.theme}」で人数を伝えるrequestと、席について追加で尋ねる丁寧なquestionを一つずつ書いてください。`;
	if (includesAny(target, ['命令文・依頼', '聞き返し']))
		return `「${content.theme}」で相手を止める丁寧な依頼、相手の短い返答、理解できた後の一言を順に書いてください。`;
	if (target.includes('need + 名詞 / to'))
		return `「${content.theme}」で必要な物をneed + noun、必要な行動をneed to + verbで一つずつ書き、意味の違いを確認してください。`;
	if (includesAny(target, ['want to / need to', '目的を表す不定詞']))
		return `「${content.theme}」でwant toとneed toを一度ずつ使い、希望と必要な行動の違いが伝わる二文を書いてください。`;
	if (includesAny(target, ['部分同意', 'i see your point']))
		return `相手のpointを公平に一文で受けてから、「${content.theme}」について同意できる点と残る懸念をbutでつないでください。`;
	const prompts: Record<GrammarCategory, string> = {
		'tense-aspect': `時間軸を明確にし、「${content.theme}」の出来事をbefore / now / resultのうち必要な二点で対比してください。今日の「${content.grammar.title}」を使います。`,
		'question-word-order': `「${content.theme}」で本当に知りたいことを一つ決め、自然な質問と相手の短い回答を書いてください。auxiliaryと語順を確認します。`,
		'noun-article-quantity': `「${content.theme}」の具体的な物・量を表す英文を書き、単数・複数、冠詞またはquantity wordを点検してください。`,
		comparison: `「${content.theme}」の二つの選択肢を同じ基準で比較し、差と自分の選択を説明してください。`,
		'modal-condition': `「${content.theme}」の状況で、可能性・義務・助言・条件の強さが意図に合う英文を書いてください。`,
		'clause-linking': `短い二つの情報を「${content.grammar.title}」で一つの読みやすい文へ結び、その文を使う場面をもう一文で示してください。`,
		'passive-reported': `「${content.theme}」の情報を、誰の発言／行為かと事実の焦点を保ったまま別の視点で伝えてください。`,
		'discourse-cohesion': `「${content.theme}」について、主張・理由・対比または結果を接続し、linkerの役割が重複しない2〜4文を書いてください。`,
		'hedging-stance': `「${content.theme}」について強すぎる断定を一つ考え、evidenceに合う慎重なclaimへ調整し、限定の理由を加えてください。`,
		'interaction-repair': `「${content.theme}」の会話で誤解が起きた想定で、具体的なclarification、簡単な言い換え、理解確認の順に書いてください。`,
		'paraphrase-explanation': `「${content.grammar.expectedAnswer}」の意味を保ち、より簡単または別の語句で説明して、意味が変わっていない点を確認してください。`,
		'integrated-grammar': `今日の「${content.grammar.title}」と以前の「${previous?.grammar.title ?? content.grammar.title}」を使い、「${content.objective}」へ答えるつながった文を書いてください。`,
	};
	return prompts[category];
}

export function selectGrammarTargeting(
	content: CurriculumDay,
	previous: CurriculumDay | undefined,
): GrammarTargeting {
	const category = classifyGrammar(content);
	const operations = CATEGORY_OPERATIONS[category];
	const operation =
		content.day <= 30
			? EARLY_FOUNDATION_OPERATION[category]
			: operations[(content.day - 1) % operations.length]!;
	const [incorrect, correction, reason] = curatedError(content, category);
	return {
		category,
		operation,
		prompt: promptFor(content, previous, category, operation),
		commonErrors: [`${incorrect} → ${correction}（${reason}）`],
	};
}

export function grammarOperationsFor(
	category: GrammarCategory,
	day?: number,
): readonly GrammarOperation[] {
	return day !== undefined && day <= 30
		? [EARLY_FOUNDATION_OPERATION[category]]
		: CATEGORY_OPERATIONS[category];
}
