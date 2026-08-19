import { buildB2ChallengeUnit, type B2ChallengeLessonSeed } from './shared';

const seeds = [
	{
		day: 361,
		theme: 'Graduation evidenceを整理する',
		objective: '会話能力のclaimを実際のsummary、repair、interaction evidenceへ結び付ける',
		grammar: [
			'evidence portfolio language',
			'evidence for / demonstrates / still developingを使う',
			'Day完了数や自己印象でlevelを決めず、観察できる発話と理解のevidenceを選びます。',
			'Evidence for sustained interaction is that I asked follow-up questions and repaired two misunderstandings.',
			'Listening inference is still developing because I missed a cautious change in stance.',
			'ability claimをevidenceで支える。',
			'My summary skill is supported by a concise retelling that kept the speaker’s condition and uncertainty.',
		],
		vocabulary:
			'evidence portfolio|evidenceの記録;observable performance|観察可能なperformance;developing skill|発達途中のskill',
		phrases:
			'Evidence for this is...|このevidenceは…。;This skill is still developing because...|このskillは…のため発達途中です。',
		voiceTask:
			'過去のlearningからevidence三つを説明し、強みとdeveloping skillを15分のreflectionで整理する。',
		skillTargets: ['speaking', 'fluency', 'grammar', 'interaction'],
	},
	{
		day: 362,
		theme: 'Graduation listening rehearsal',
		objective: 'near-natural inputからstance、detail、implicationを抽出して確認する',
		grammar: [
			'integrated listening response',
			'the main claim / a supporting detail / the implication seemsを使う',
			'要点、detail、inferenceを区別し、inferenceだけはcertaintyを限定します。',
			'The main claim is that the trial should continue for another month.',
			'The implication seems to be that current evidence is not yet sufficient for expansion.',
			'inputを三層でresponseする。',
			'State the claim, cite one detail, give a cautious inference, and ask one question that could confirm it.',
		],
		vocabulary:
			'supporting detail|補足detail;implication|含意;listening evidence|listeningのevidence',
		phrases:
			'The main claim is...|主なclaimは…。;The implication seems to be...|含意は…のようです。',
		voiceTask:
			'3分のnear-natural inputを二題聞き、summary、detail、stance、inference、clarificationを各題で行う。',
		skillTargets: ['listening', 'speaking', 'interaction', 'fluency'],
	},
	{
		day: 363,
		theme: 'Graduation discussion rehearsal',
		objective: 'positionを発展させ、counterpointで修正し、自然にturnを共同構築する',
		grammar: [
			'assessment discussion rehearsal',
			'qualified stance / counterpoint / synthesisを統合する',
			'暗記scriptでなく、相手のunexpected exampleに応じてevidenceとwordingを調整します。',
			'I support the proposal in principle, although the access evidence remains limited.',
			'Your counterexample suggests that the support plan should begin before the wider trial.',
			'positionをmulti-turnでrefineする。',
			'Give a reasoned stance, invite a challenge, respond with a revised condition, and identify shared ground.',
		],
		vocabulary:
			'reasoned stance|根拠あるstance;spontaneous response|自発的response;shared ground|共通の基盤',
		phrases:
			'In principle, I support..., although...|原則…を支持しますが…。;That example makes me reconsider...|その例で…を再考します。',
		voiceTask:
			'20分のmock discussion。opinion、reasons、evidence、alternative perspective、counterpoint、repair、summaryを扱う。',
		skillTargets: ['listening', 'speaking', 'interaction', 'fluency', 'grammar'],
	},
	{
		day: 364,
		theme: 'Graduation full rehearsal',
		objective: 'listening、explanation、discussion、paraphrase、reflectionを一続きで練習する',
		grammar: [
			'full performance rehearsal',
			'既習grammarをmeaningとinteractionのために選択する',
			'正確さを監視しながらも、pause後にrepairしてconversationを再開することを優先します。',
			'If I had understood the condition earlier, I would have asked a different follow-up question.',
			'The proposal seems useful, provided that the results are reviewed with the affected users.',
			'full taskでlanguage choicesを統合する。',
			'Summarize the input, explain one complex point, develop and revise a stance, paraphrase an unknown term, and reflect on evidence.',
		],
		vocabulary:
			'full rehearsal|通しrehearsal;performance evidence|performance evidence;self-repair|自己repair',
		phrases:
			'Let me repair that sentence.|その文を言い直します。;To summarize my evidence,...|evidenceを要約すると…。',
		voiceTask:
			'23～25分のfull rehearsal。input summary、complex explanation、discussion、counterpoint、inference、paraphrase、repair、reflectionを行う。',
		skillTargets: [
			'listening',
			'speaking',
			'interaction',
			'fluency',
			'grammar',
			'vocabulary',
			'pronunciation',
		],
	},
	{
		day: 365,
		theme: 'Trellune Graduation Challenge',
		objective: '365日のcontent completionとCEFR estimateを分離し、25分の会話evidenceを示す',
		grammar: [
			'Graduation Challenge integration',
			'tense / conditionals / clauses / hedging / discourse controlを自然に統合する',
			'Day 365完了はcontent progressionの完了です。CEFRはこの会話のskill evidenceから推定し、certificationとは扱いません。',
			'Completing the curriculum shows consistent study, but the level estimate must come from observed performance.',
			'My evidence includes sustained discussion, accurate summary, clarification, and repair across unfamiliar wording.',
			'最終conversationのevidenceとnext targetを述べる。',
			'Use a structured stance, respond to counterarguments, infer cautiously, paraphrase, repair, summarize, and identify the next learning target.',
		],
		vocabulary:
			'evidence-based estimate|evidenceに基づく推定;content completion|contentの完了;next horizon|次の学習段階',
		phrases:
			'Completion is not the same as certification.|完了はcertificationと同じではありません。;The evidence suggests an estimate of...|evidenceは…という推定を示します。',
		voiceTask:
			'25分のGraduation Challenge。sustained discussion、stance、reasons、examples、alternative view、counterpoint、summary、paraphrase、repair、listening inference、next targetsを示す。結果はB1+ / B2-entry / B2のevidence-based estimateでありcertificationではない。',
		skillTargets: [
			'listening',
			'speaking',
			'interaction',
			'fluency',
			'grammar',
			'vocabulary',
			'pronunciation',
		],
	},
] as const satisfies readonly B2ChallengeLessonSeed[];

export const UNIT_23_LESSONS = buildB2ChallengeUnit(361, 365, seeds);
