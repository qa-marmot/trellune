import type {
	CurriculumLesson,
	CurriculumManifest,
	GrammarCategory,
	PracticeBlock,
	PracticeFeedback,
	PracticePrompt,
} from '../curriculum/model';
import { CURRICULUM_MANIFEST } from '../curriculum/manifest';
import { CURRICULUM, type CurriculumDay, type CurriculumItem } from '../data/curriculum';
import { selectGrammarTargeting } from '../data/practice/grammarTargeting';
import type { SupportedLocale } from './types';
import { GENERATED_ENGLISH_GLOSSES } from './generatedEnglishGlosses';

/**
 * Learner support language is deliberately separate from persisted learner data.
 * Stage B follows the UI language, but this alias keeps the boundary explicit so
 * a device-only override can be added later without touching sync or backup.
 */
export type SupportLanguage = SupportedLocale;

export interface LearningSupportCatalog {
	readonly supportLanguage: SupportLanguage;
	readonly curriculum: readonly CurriculumDay[];
	readonly manifest: CurriculumManifest;
}

export const CJK_TEXT_PATTERN = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/u;

const CATEGORY_LABELS: Readonly<Record<GrammarCategory, string>> = Object.freeze({
	'tense-aspect': 'Tense and aspect',
	'question-word-order': 'Questions and word order',
	'noun-article-quantity': 'Nouns, articles, and quantity',
	comparison: 'Comparison',
	'modal-condition': 'Modals and conditions',
	'clause-linking': 'Clauses and linking',
	'passive-reported': 'Passive and reported language',
	'discourse-cohesion': 'Discourse and cohesion',
	'hedging-stance': 'Hedging and stance',
	'interaction-repair': 'Interaction and repair',
	'paraphrase-explanation': 'Paraphrase and explanation',
	'integrated-grammar': 'Integrated grammar',
});

const CATEGORY_NOTES: Readonly<Record<GrammarCategory, string>> = Object.freeze({
	'tense-aspect':
		'Choose the tense that matches the time, sequence, and relationship between events.',
	'question-word-order':
		'Keep the auxiliary, subject, and main verb in the order required by the question.',
	'noun-article-quantity':
		'Choose singular or plural form, then use an article or quantity expression that fits the meaning.',
	comparison:
		'Make the basis of comparison clear and use the comparative or superlative form consistently.',
	'modal-condition':
		'Use the modal or conditional form that matches certainty, obligation, advice, or possibility.',
	'clause-linking':
		'Connect ideas so the relationship—reason, contrast, condition, or description—is easy to follow.',
	'passive-reported':
		'Keep the original meaning while shifting focus or reporting another person’s words accurately.',
	'discourse-cohesion':
		'Organise sentences with clear reference words and connectors instead of listing isolated ideas.',
	'hedging-stance':
		'Match the strength of the claim to the evidence and leave room for reasonable alternatives.',
	'interaction-repair':
		'Use a natural clarification or repair move, then confirm that both speakers share the meaning.',
	'paraphrase-explanation':
		'Preserve the meaning while changing the wording, level of detail, or explanation strategy.',
	'integrated-grammar':
		'Combine familiar grammar accurately in a connected response rather than treating each form alone.',
});

const COMMON_GLOSSES: Readonly<Record<string, string>> = Object.freeze({
	name: 'the word a person is known by',
	from: 'showing the place where someone or something began',
	live: 'to have your home in a place',
	work: 'to do a job or a planned activity',
	friend: 'a person you know and like',
	family: 'people related to one another',
	have: 'to own, hold, or experience something',
	need: 'to require something because it is important',
	want: 'to wish to have or do something',
	like: 'to enjoy or have a positive feeling about something',
	love: 'to like or care about someone or something very much',
	speak: 'to use your voice to communicate',
	listen: 'to give attention to sound or another speaker',
	understand: 'to know the meaning of something',
	repeat: 'to say or do something again',
	help: 'to make it easier for someone to do something',
	start: 'to begin',
	finish: 'to complete or end something',
	before: 'earlier than a time or event',
	after: 'later than a time or event',
	because: 'introducing a reason',
	however: 'introducing a contrast with what came before',
	although: 'introducing a fact that contrasts with the main idea',
	evidence: 'information that supports a conclusion',
	stance: 'a person’s position or attitude toward an issue',
	inference: 'a conclusion reached from clues rather than a direct statement',
	counterpoint: 'an idea that challenges or balances another point',
	qualification: 'a limit or condition added to make a claim more accurate',
	clarification: 'an explanation that makes meaning clearer',
	paraphrase: 'the same meaning expressed in different words',
	city: 'a large town where many people live and work',
	music: 'sounds arranged to create a song or other expressive work',
	this: 'the person or thing that is near or currently being discussed',
	that: 'a person, thing, fact, or idea already identified in the conversation',
	what: 'the question word used to ask for information about a thing or idea',
	where: 'the question word used to ask about a place or position',
	how: 'the question word used to ask about a method, condition, or degree',
	person: 'an individual human being',
	word: 'a single unit of language with a meaning or function',
	else: 'in addition to, or different from, what was already mentioned',
	'fitting room': 'a private space in a shop where customers try on clothes',
	watched: 'the past form of watch: looked at something for a period of time',
	stayed: 'the past form of stay: remained in a place or condition',
	talked: 'the past form of talk: spoke with another person',
	should: 'a modal used for advice, expectation, or the best action',
	could: 'a modal used for past ability, possibility, or a polite request',
	symptom: 'a physical or mental sign that may show an illness or problem',
	since: 'from a stated time in the past until now, or because of a reason',
	medicine: 'a substance used to treat or prevent illness',
	stronger: 'more strong, powerful, convincing, or noticeable',
	weaker: 'less strong, powerful, convincing, or noticeable',
	room: 'a separate area inside a building, or available space',
	character: 'a person in a story, or a quality that makes someone or something distinctive',
	author: 'a person who writes a book, article, or other work',
	actor: 'a person who performs a role in a play, film, or programme',
	singer: 'a person who performs music with their voice',
	lyrics: 'the words of a song',
	sport: 'an organised physical activity or game',
	activity: 'something that a person or group does',
	if: 'a linking word that introduces a condition or possibility',
	condition: 'a requirement, situation, or state that affects what can happen',
	growth: 'the process of developing, improving, or becoming larger',
	period: 'a length or section of time',
	busier: 'having more activity or work than before or than another person',
	device: 'a tool or piece of equipment designed for a particular purpose',
	structure: 'the way parts are organised and connected',
	unless: 'except if; used to state the condition that prevents a result',
	'according to': 'as stated, reported, or shown by a person or source',
	whether: 'used when considering two or more possibilities',
	workaround: 'a practical temporary method for dealing with a problem',
	provided: 'on the condition that something happens or is true',
	criteria: 'standards used to judge or decide something',
	'connected speech':
		'natural spoken language in which neighbouring sounds influence or join each other',
	'plain language': 'clear wording designed to be understood quickly',
	'learning style': 'a person’s preferred way of approaching learning activities',
	'pick up on': 'to notice, understand, or continue a point another person introduced',
	'refer to': 'to mention, describe, or direct attention to something',
	'self-assess': 'to judge your own performance using clear evidence or criteria',
	'apply to': 'to be relevant to a person, case, or situation',
	repairable: 'able to be fixed instead of replaced',
	'human judgment':
		'a decision made by a person who considers context rather than following a rule automatically',
	'represent fairly': 'to describe another view accurately and without making it weaker',
	'lean toward': 'to prefer or support one option slightly, without complete certainty',
	'seasonal pressure': 'extra demand or difficulty caused by a particular time of year',
	'missed opportunity': 'a useful chance that was not taken',
	'at the expense of': 'in a way that harms or reduces another benefit or priority',
	'plain-language explanation':
		'an explanation that makes a complex idea clear without unnecessary specialist terms',
	'automatically applied': 'put into effect by a system without a separate human action',
	'make concrete': 'to make an abstract idea specific through an example or visible detail',
	'visible symptom': 'an observable sign of an underlying problem',
	reframe: 'to present the same issue from a different and useful perspective',
	'comparison group': 'a reference group used to judge differences or effects',
	'hold a thought': 'to pause an idea briefly so another speaker can respond or clarify',
	'role-switch': 'an activity in which speakers exchange positions or responsibilities',
	'underlying value': 'a basic principle or priority behind a visible position',
	'factual dispute': 'a disagreement about what is true or what the evidence shows',
	'fully convinced': 'completely persuaded that a claim or decision is right',
	'cautiously favor': 'to prefer an option while still recognising uncertainty or risk',
	'follow-up chain': 'a connected series of questions that develops one point in greater depth',
	'lose the thread': 'to stop following how the ideas in a conversation connect',
	'conversational recovery':
		'the process of restoring shared understanding after confusion or interruption',
	'review condition': 'a requirement that triggers a later check or reconsideration',
	'co-design': 'to design something collaboratively with the people affected by it',
	'testable policy': 'a rule or plan whose effects can be checked with evidence',
	'public explanation': 'a clear account intended for the people affected by a decision',
	reprioritize: 'to change the order of importance among tasks, goals, or needs',
	'observable performance':
		'a skill demonstrated through behaviour or work that others can examine',
	'content completion':
		'finishing the assigned learning material, separate from proving a proficiency level',
});

const IRREGULAR_GLOSSES: Readonly<Record<string, string>> = Object.freeze({
	bought: 'the past form of buy: paid money to obtain something',
	came: 'the past form of come: moved toward a place or person',
	did: 'the past form of do: performed an action',
	drank: 'the past form of drink: took liquid into the body',
	gave: 'the past form of give: passed something to another person',
	had: 'the past form of have: owned, held, or experienced something',
	met: 'the past form of meet: came together with another person',
	took: 'the past form of take: carried, used, or accepted something',
	went: 'the past form of go: moved to another place',
});

function hasCjk(value: string | undefined): boolean {
	return value !== undefined && CJK_TEXT_PATTERN.test(value);
}

function englishTopic(day: CurriculumDay): string {
	const phrase = day.phrases[0]?.text;
	if (phrase) return phrase.replace(/[.!?]+$/u, '').toLocaleLowerCase('en-US');
	const words = day.vocabulary.slice(0, 3).map((item) => item.text);
	return words.length ? words.join(', ') : `the Day ${day.day} topic`;
}

function conversationFocus(day: CurriculumDay): string {
	if (day.day <= 90) return 'an everyday exchange';
	if (day.day <= 180) return 'experiences, reasons, plans, and comparisons';
	if (day.day <= 270) return 'a connected explanation, summary, or problem-solving exchange';
	return 'a sustained discussion with evidence, qualification, and alternative views';
}

function stageObjective(day: CurriculumDay, title: string): string {
	const topic = englishTopic(day);
	if (day.day <= 90)
		return `Use ${title.toLocaleLowerCase('en-US')} and today’s key words in a short, clear exchange about ${topic}.`;
	if (day.day <= 180)
		return `Discuss ${topic}, give a clear reason or example, and respond to a follow-up question.`;
	if (day.day <= 270)
		return `Explain ${topic} in connected detail, paraphrase when needed, and repair a misunderstanding naturally.`;
	return `Develop a clear position on ${topic} with support, a qualified counterpoint, and a concise summary.`;
}

function candidateLemmas(word: string): readonly string[] {
	const candidates = new Set([word]);
	if (word.endsWith('ies') && word.length > 3) candidates.add(`${word.slice(0, -3)}y`);
	if (word.endsWith('es') && word.length > 3) {
		candidates.add(word.slice(0, -2));
		candidates.add(word.slice(0, -1));
	}
	if (word.endsWith('s') && word.length > 2) candidates.add(word.slice(0, -1));
	if (word.endsWith('ied') && word.length > 3) candidates.add(`${word.slice(0, -3)}y`);
	if (word.endsWith('ed') && word.length > 3) {
		candidates.add(word.slice(0, -2));
		candidates.add(`${word.slice(0, -1)}`);
	}
	if (word.endsWith('ing') && word.length > 4) {
		candidates.add(word.slice(0, -3));
		candidates.add(`${word.slice(0, -3)}e`);
	}
	if (word.endsWith('er') && word.length > 3) candidates.add(word.slice(0, -2));
	if (word.endsWith('est') && word.length > 4) candidates.add(word.slice(0, -3));
	return [...candidates];
}

function resolveWordGloss(word: string): string | undefined {
	const normalized = word
		.trim()
		.toLocaleLowerCase('en-US')
		.replace(/^[^a-z]+|[^a-z]+$/gu, '');
	if (!normalized) return undefined;
	const irregular = IRREGULAR_GLOSSES[normalized];
	if (irregular) return irregular;
	for (const candidate of candidateLemmas(normalized)) {
		const gloss = COMMON_GLOSSES[candidate] ?? GENERATED_ENGLISH_GLOSSES[candidate];
		if (gloss) return gloss;
	}
	return undefined;
}

function englishMeaning(item: CurriculumItem, day: CurriculumDay): string {
	const normalized = item.text.trim().toLocaleLowerCase('en-US');
	const gloss = COMMON_GLOSSES[normalized] ?? GENERATED_ENGLISH_GLOSSES[normalized];
	if (gloss) return gloss;
	const componentGlosses = item.text
		.split(/[\s/–—-]+/u)
		.map(resolveWordGloss)
		.filter((value): value is string => value !== undefined);
	if (componentGlosses.length > 0) {
		return `A collocation combining ${componentGlosses.slice(0, 3).join('; ')}.`;
	}
	return `A curriculum term used when discussing ${conversationFocus(day)}; infer its precise sense from the two lesson examples before producing it.`;
}

function phraseMeaning(item: CurriculumItem, day: CurriculumDay): string {
	const text = item.text.trim().toLocaleLowerCase('en-US');
	const focus = conversationFocus(day);
	if (
		/\?$|^(?:what|when|where|who|why|how|do|does|did|is|are|was|were|have|has|can|could|would|should|will)\b/u.test(
			text,
		)
	)
		return `A question for inviting specific information or confirmation during ${focus}.`;
	if (
		/\b(?:do not understand|did not catch|mean|clarif|repeat|say that again|speak slowly|not exactly|recap)\b/u.test(
			text,
		)
	)
		return 'A repair expression for identifying unclear meaning and asking the other speaker to make it accessible.';
	if (/\b(?:please|could|would|can i|can we|may i)\b/u.test(text))
		return `A polite request for moving ${focus} forward without sounding too direct.`;
	if (
		/\b(?:agree|point,? but|differ|another perspective|on one hand|on the other hand)\b/u.test(text)
	)
		return 'A discussion move for showing agreement, contrast, or a different perspective respectfully.';
	if (
		/\b(?:summary|summarize|in brief|main point|bring these points together|to conclude)\b/u.test(
			text,
		)
	)
		return 'A summarising expression for keeping the central message while leaving out non-essential detail.';
	if (/\b(?:example|evidence|reason|because|as a result|therefore|this suggests)\b/u.test(text))
		return 'A support move for connecting a claim with a reason, example, result, or piece of evidence.';
	if (/\b(?:if|provided that|depend on|condition|otherwise|might|could)\b/u.test(text))
		return 'A qualifying expression for describing a condition, possibility, or limit instead of making an absolute claim.';
	if (/\b(?:compared|similar|difference|more than|less than|both)\b/u.test(text))
		return 'A comparison expression for making a similarity, difference, or basis of comparison explicit.';
	return `A model expression for making a clear, relevant contribution during ${focus}.`;
}

function voiceTask(day: CurriculumDay, objective: string): string {
	if (day.day <= 30)
		return `Have a short guided conversation about the Day ${day.day} topic. Use today’s grammar, answer one question at a time, and ask for repetition when needed.`;
	if (day.day <= 90)
		return `Continue a familiar-topic conversation for several minutes. ${objective} Ask at least one follow-up question and use a repair phrase if meaning is unclear.`;
	if (day.day <= 180)
		return `Hold an 8–12 minute conversation. ${objective} Include reasons, examples, follow-up questions, clarification, and a short closing summary.`;
	if (day.day <= 270)
		return `Hold a 12–18 minute conversation at controlled near-natural speed. ${objective} Retell or summarise one point and paraphrase unfamiliar wording.`;
	return `Hold a 15–25 minute sustained discussion at near-natural speed. ${objective} Respond spontaneously, clarify implications, and repair communication without abandoning the topic.`;
}

function boundedGrammarExercise(expectedAnswer: string): string {
	const cues = expectedAnswer
		.replace(/[.!?]+$/u, '')
		.split(/\s+/u)
		.filter(Boolean);
	if (cues.length < 2) {
		return 'Complete the one-word check from today’s pattern, then continue to the transfer practice.';
	}
	const scrambled = [...cues].reverse();
	if (scrambled.join(' ') === cues.join(' ')) {
		scrambled.push(scrambled.shift()!);
	}
	return `Put these cues in a natural sentence using today’s pattern: ${scrambled.join(' / ')}. Add normal end punctuation, then continue to the transfer practice.`;
}

function localizeDay(day: CurriculumDay): CurriculumDay {
	const previous = CURRICULUM[day.day - 2];
	const category = selectGrammarTargeting(day, previous).category;
	const grammarTitle = CATEGORY_LABELS[category];
	const objective = stageObjective(day, grammarTitle);
	return Object.freeze({
		...day,
		theme: `${grammarTitle} — ${englishTopic(day)}`,
		objective,
		grammar: Object.freeze({
			...day.grammar,
			title: grammarTitle,
			focus: CATEGORY_NOTES[category],
			explanation: `${CATEGORY_NOTES[category]} Study the two model sentences, then apply the same choice to your own meaning.`,
			exercise: boundedGrammarExercise(day.grammar.expectedAnswer),
		}),
		vocabulary: Object.freeze(
			day.vocabulary.map((item) => Object.freeze({ ...item, meaning: englishMeaning(item, day) })),
		),
		phrases: Object.freeze(
			day.phrases.map((item) => Object.freeze({ ...item, meaning: phraseMeaning(item, day) })),
		),
		voiceTask: voiceTask(day, objective),
	});
}

function operationLabel(operation: PracticePrompt['operation']): string {
	return operation.replaceAll('-', ' ');
}

function englishChecklist(day: number, operation: PracticePrompt['operation']): readonly string[] {
	if (operation === 'comprehension' || operation === 'inference')
		return Object.freeze([
			'I answered the exact question.',
			'I used a relevant clue from the text.',
			'I did not make the claim stronger than the evidence.',
		]);
	if (day <= 90)
		return Object.freeze([
			'I completed the task.',
			'My sentence has a subject and a verb.',
			'I used today’s target form.',
			'My meaning is understandable.',
		]);
	if (day <= 180)
		return Object.freeze([
			'I answered the task directly.',
			'I organised the response clearly.',
			'I used the target language.',
			'I added a reason or example.',
		]);
	if (day <= 270)
		return Object.freeze([
			'I organised the explanation.',
			'I added useful detail or a paraphrase.',
			'I controlled tense and sentence form.',
			'I linked the ideas naturally.',
		]);
	return Object.freeze([
		'I answered the task and made my position clear.',
		'I supported the position and qualified it where needed.',
		'I organised and linked the response.',
		'I used language appropriate to the situation.',
		'I checked grammar without weakening the meaning.',
	]);
}

function promptFallback(prompt: PracticePrompt, day: CurriculumDay): string {
	const targets = prompt.retrievalTargets?.map((target) => target.text).join(' / ');
	if (targets)
		return `Reuse ${targets} in a new response about the Day ${day.day} topic. Keep the meaning natural and specific.`;
	const label = operationLabel(prompt.operation);
	if (prompt.operation === 'error-correction')
		return `Correct the learner error for today’s grammar, explain the change briefly, and use the corrected form in a new context.`;
	if (prompt.operation === 'paraphrase')
		return `Paraphrase one key idea from today’s lesson without changing its meaning, then apply it to your own example.`;
	if (prompt.operation === 'summary')
		return `Summarise the essential idea in your own English. Keep the main point and omit non-essential detail.`;
	return `Complete a ${label} response for the Day ${day.day} topic. Use today’s target language and make the meaning specific.`;
}

function englishFeedback(
	feedback: PracticeFeedback,
	prompt: PracticePrompt,
	day: CurriculumDay,
): PracticeFeedback {
	const keyPoints = feedback.keyPoints?.map((point) =>
		hasCjk(point) ? 'The response includes the task’s essential meaning.' : point,
	);
	const commonErrors = feedback.commonErrors?.map((error) =>
		hasCjk(error) ? 'Avoid adding unrelated language just to reach the word count.' : error,
	);
	const targetFeatures = feedback.targetFeatures?.map((feature) =>
		hasCjk(feature) ? CATEGORY_LABELS[prompt.grammarCategory ?? 'integrated-grammar'] : feature,
	);
	return Object.freeze({
		...feedback,
		keyPoints: keyPoints ? Object.freeze(keyPoints) : undefined,
		rationale: hasCjk(feedback.rationale)
			? `Compare meaning, evidence, and language choice. Exact wording is not required for this ${operationLabel(prompt.operation)} task.`
			: feedback.rationale,
		evidenceClue: hasCjk(feedback.evidenceClue)
			? 'Return to the sentence that most directly supports your answer.'
			: feedback.evidenceClue,
		commonErrors: commonErrors ? Object.freeze(commonErrors) : undefined,
		checklist: englishChecklist(day.day, prompt.operation),
		modelResponse: hasCjk(feedback.modelResponse) ? undefined : feedback.modelResponse,
		targetFeatures: targetFeatures ? Object.freeze(targetFeatures) : undefined,
	});
}

function localizePrompt(prompt: PracticePrompt, day: CurriculumDay): PracticePrompt {
	return Object.freeze({
		...prompt,
		prompt: hasCjk(prompt.prompt) ? promptFallback(prompt, day) : prompt.prompt,
		guidance: hasCjk(prompt.guidance)
			? 'Answer in your own English, then compare meaning and target language before revising.'
			: prompt.guidance,
		feedback: englishFeedback(prompt.feedback, prompt, day),
	});
}

const BLOCK_TITLES: Readonly<Record<PracticeBlock['kind'], string>> = Object.freeze({
	grammar: 'Grammar transfer',
	vocabulary: 'Vocabulary retrieval and reuse',
	reading: 'Reading practice',
	writing: 'Writing practice',
	listening: 'Listening preparation',
	retrieval: 'Cumulative retrieval',
	integration: 'Reading and writing lab',
});

const BLOCK_INSTRUCTIONS: Readonly<Record<PracticeBlock['kind'], string>> = Object.freeze({
	grammar: 'Use the target grammar for a new meaning. Review accuracy and clarity, not just form.',
	vocabulary:
		'Retrieve current and earlier vocabulary, then use it in a meaningful sentence or short response.',
	reading: 'Read for the main idea first, then return to the text for the evidence you need.',
	writing: 'Respond to the communicative task, review the checklist, and revise once if useful.',
	listening:
		'Prepare to identify key points, ask for clarification, and summarise what you understood.',
	retrieval: 'Recall the target before checking it, then use it in a new context.',
	integration:
		'Read the text first, answer from memory, and return only for the detail or evidence you need.',
});

function localizeBlock(block: PracticeBlock, day: CurriculumDay): PracticeBlock {
	return Object.freeze({
		...block,
		title: hasCjk(block.title) ? BLOCK_TITLES[block.kind] : block.title,
		instructions: hasCjk(block.instructions) ? BLOCK_INSTRUCTIONS[block.kind] : block.instructions,
		prompts: Object.freeze(block.prompts.map((prompt) => localizePrompt(prompt, day))),
	});
}

const englishCurriculum = Object.freeze(CURRICULUM.map(localizeDay));
const englishManifest: CurriculumManifest = Object.freeze({
	...CURRICULUM_MANIFEST,
	lessons: Object.freeze(
		CURRICULUM_MANIFEST.lessons.map((lesson, index): CurriculumLesson => {
			const content = englishCurriculum[index]!;
			return Object.freeze({
				...lesson,
				content,
				practiceBlocks: Object.freeze(
					lesson.practiceBlocks.map((block) => localizeBlock(block, content)),
				),
			});
		}),
	),
});

const japaneseCatalog: LearningSupportCatalog = Object.freeze({
	supportLanguage: 'ja',
	curriculum: CURRICULUM,
	manifest: CURRICULUM_MANIFEST,
});
const englishCatalog: LearningSupportCatalog = Object.freeze({
	supportLanguage: 'en',
	curriculum: englishCurriculum,
	manifest: englishManifest,
});

export function getLearningSupportCatalog(
	supportLanguage: SupportLanguage,
): LearningSupportCatalog {
	return supportLanguage === 'en' ? englishCatalog : japaneseCatalog;
}
