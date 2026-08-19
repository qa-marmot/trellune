import type { IntegratedLabSeed } from './shared';

const LABS = [
	{
		day: 186,
		title: 'Reading & Writing Lab · The detail that explains the result',
		sourceText:
			'When Nao began teaching an online software class, she prepared clear slides but rarely paused. Learners completed the first task, yet several made the same mistake in the second one. After class, Nao watched a recording and noticed that she had explained the difficult step while changing screens. The next week, she stopped sharing, drew the step on a simple diagram, and asked one learner to explain it back. Fewer people needed help. The content had not changed; the timing and check for understanding had.',
		comprehension:
			'What evidence suggests that timing, rather than the slides, caused the original problem?',
		writing:
			'Explain an experience in which one small detail changed the result. Organise cause, action, and evidence.',
		guidance: '背景を短くし、転換点と結果を支えるdetailに焦点を当てます。',
		output: { format: 'paragraph', minimumWords: 105, maximumWords: 180 },
	},
	{
		day: 192,
		title: 'Reading & Writing Lab · Comparing two accounts',
		sourceText:
			'Two colleagues described the same delayed project. Maya said the team had received important customer feedback late, so the original schedule became unrealistic. Theo agreed that the feedback mattered, but he also noted that the team had waited three days before asking which changes were essential. Both accounts identify an external delay. Theo’s version, however, adds a decision the team controlled. In the final review, they agreed to ask for priorities immediately when future requests conflict with a deadline.',
		comprehension: 'How do Maya and Theo differ in where they place responsibility?',
		writing:
			'Summarise both accounts fairly, then state the shared lesson without choosing a person to blame.',
		guidance: '共通点→相違点→shared lessonの順に、自分の評価と報告内容を分けます。',
		output: { format: 'summary', minimumWords: 108, maximumWords: 185 },
	},
	{
		day: 198,
		title: 'Reading & Writing Lab · A summary for a busy reader',
		sourceText:
			'A small library tested three changes to attract more evening visitors. It stayed open two hours later on Thursdays, moved popular language books near the entrance, and offered a quiet study table that people could reserve online. Visitor numbers rose most on Thursdays, but reservation data showed that the table was used on every open day. Staff interviews also revealed that the new book display helped people find material quickly. The library will keep all three changes for now, while measuring whether the longer hours are worth the extra staffing cost.',
		comprehension: 'Which result was strongest, and why does the library still need more evidence?',
		writing: 'Write a three-sentence executive summary: action, main results, and next decision.',
		guidance: '数字がなくても、strongest resultとuncertaintyを区別して要約します。',
		output: { format: 'summary', minimumWords: 105, maximumWords: 175 },
	},
	{
		day: 204,
		title: 'Reading & Writing Lab · Retelling for a different listener',
		sourceText:
			'During a train journey, an announcement said that a signalling problem would delay all northbound services. A tourist beside Emi understood that the train was cancelled and began looking for a hotel. Emi first repeated the announcement, but the tourist still looked confused. She then said, “The train will go, but later than planned,” and showed the updated departure time on the station app. The simpler wording and visual evidence resolved the misunderstanding.',
		comprehension: 'Why did Emi’s second explanation work better than her first attempt?',
		writing:
			'Retell the event first for a friend, then rewrite the essential message for a beginner who may not know the word “delay.”',
		guidance: '同じ事実を保ち、listenerに合わせて語彙とdetail量を変えます。',
		output: { format: 'connected-sentences', minimumWords: 110, maximumWords: 190 },
	},
	{
		day: 210,
		title: 'Reading & Writing Lab · What the speaker leaves unsaid',
		sourceText:
			'After a community event, the organiser wrote, “Attendance was lower than we hoped, but everyone who came stayed for the full programme. Next time, we will work with local groups earlier and make the purpose clearer.” The note does not call the event a failure. It highlights engagement while admitting that promotion and messaging were weak. The organiser appears to want support for another attempt, not an argument about whether the first event should have happened.',
		comprehension:
			'What is the organiser’s likely purpose, and which phrases support your inference?',
		writing:
			'Paraphrase the note in neutral language, then add one follow-up question that would reveal useful missing information.',
		guidance: '明示されたfactと推測したintentionを混同せずに書きます。',
		output: { format: 'summary', minimumWords: 112, maximumWords: 195 },
	},
	{
		day: 216,
		title: 'Reading & Writing Lab · Choosing under uncertainty',
		sourceText:
			'A volunteer group must choose how to deliver food during a week of extreme heat. One option is to keep the usual afternoon schedule, when more volunteers are available. Another is to deliver in the morning, which is safer for drivers but difficult for volunteers with jobs. A third option is to reduce deliveries and prioritise residents who cannot travel. Weather forecasts may change, and the group has limited refrigerated storage. The coordinator proposes a morning schedule for two days, followed by a review of temperatures, staffing, and missed requests.',
		comprehension:
			'Why is the coordinator’s temporary plan more flexible than choosing one option for the whole week?',
		writing:
			'Recommend a decision for the group. Compare two options, explain uncertainty, and name the evidence that should trigger a review.',
		guidance: '断定しすぎず、decision・risk・review conditionをつなげます。',
		output: { format: 'opinion', minimumWords: 115, maximumWords: 200 },
	},
	{
		day: 222,
		title: 'Reading & Writing Lab · A problem behind the visible problem',
		sourceText:
			'Customers complained that a booking website was slow. The development team initially planned to improve server speed, but support messages showed a different pattern: many users were repeatedly returning to the previous page because they could not understand one question. A short usability test confirmed that the wording was unclear. The team simplified the question and added an example. Completion time fell even though the server was unchanged. The visible symptom had been “slow,” but the main cause was hesitation.',
		comprehension: 'Which evidence changed the team’s understanding of the problem?',
		writing:
			'Explain a problem, distinguish its symptom from its likely cause, and propose a low-risk way to test your explanation.',
		guidance: 'observationとassumptionを区別し、testable solutionを示します。',
		output: { format: 'report', minimumWords: 118, maximumWords: 205 },
	},
	{
		day: 228,
		title: 'Reading & Writing Lab · Agreement with a condition',
		sourceText:
			'A school is considering replacing printed notices with an app. Supporters argue that updates would arrive faster and translation would be easier. Some parents point out that not every family checks the same device regularly. One teacher supports the app only if urgent notices are also sent by text and paper copies remain available on request. Her position is not simple opposition: she accepts the efficiency argument but adds an access condition.',
		comprehension:
			'How is the teacher’s position different from complete agreement or complete disagreement?',
		writing:
			'Respond to the proposal with a qualified position. Acknowledge one benefit, add one condition, and explain whom it protects.',
		guidance: 'Yes, but ...だけで終わらず、conditionの理由と対象を具体化します。',
		output: { format: 'opinion', minimumWords: 120, maximumWords: 210 },
	},
	{
		day: 234,
		title: 'Reading & Writing Lab · Evidence and perspective',
		sourceText:
			'A survey found that most employees liked hybrid work. Managers focused on the result that team meetings were easier in person. Employees focused on the result that quiet work was easier at home. Neither group was ignoring the survey; each selected evidence connected to its responsibilities. The report recommended fixed team days plus flexible individual days. It also warned that new employees might need more in-person support than experienced staff.',
		comprehension:
			'Why can both groups use the same survey and still emphasise different conclusions?',
		writing:
			'Present the two perspectives, identify a group whose needs may differ, and propose a balanced arrangement.',
		guidance: 'perspectiveをpersonalityではなくrole・need・evidenceと結びつけます。',
		output: { format: 'report', minimumWords: 122, maximumWords: 215 },
	},
	{
		day: 240,
		title: 'Reading & Writing Lab · A view that develops',
		sourceText:
			'At the start of a discussion, Lena said that public workshops should always be free. She believed fees would exclude people with low incomes. Another participant agreed with the concern but explained that small fees reduced last-minute cancellations and paid for materials. Lena revised her position: basic places should remain free, while optional materials could cost money, and people should be able to cancel without penalty if they gave notice. Her central value stayed the same, but her policy became more practical.',
		comprehension: 'Which part of Lena’s view changed, and which underlying value remained?',
		writing:
			'Explain an initial position, a counterpoint that affects it, and a revised position that preserves your main value.',
		guidance: 'changed my mind entirelyではなく、何をretain / qualifyしたかを示します。',
		output: { format: 'opinion', minimumWords: 125, maximumWords: 220 },
	},
	{
		day: 246,
		title: 'Reading & Writing Lab · Describing an unknown term',
		sourceText:
			'While discussing a kitchen repair, Omar forgot the English word “hinge.” He did not stop the conversation or switch immediately to a dictionary. He said it was the small metal part that connects a door to a cupboard and lets the door open and close. His partner guessed the word and confirmed which cupboard he meant. Omar then repeated “hinge” in a new sentence. The description succeeded because it combined category, location, and function.',
		comprehension: 'Which three kinds of information made Omar’s paraphrase effective?',
		writing:
			'Choose an everyday object without naming it. Describe its category, appearance or location, function, and one example of use.',
		guidance: '単語の同義語を探すだけでなく、listenerが推測できる複数の手がかりを与えます。',
		output: { format: 'paragraph', minimumWords: 125, maximumWords: 220 },
	},
	{
		day: 252,
		title: 'Reading & Writing Lab · Confirming a nuanced message',
		sourceText:
			'A team leader said, “The first version is good enough to test, though I would not show it to every customer yet.” One developer heard approval and wanted to release it publicly. Another heard criticism and wanted to delay all testing. Priya checked the intended meaning: the leader supported a limited test with selected users, but not a full release. She restated both the permission and the restriction, and the leader confirmed them.',
		comprehension: 'What two parts of the message did Priya need to preserve in her confirmation?',
		writing:
			'Paraphrase the leader’s message in two ways: a concise team note and a careful confirmation question.',
		guidance: 'positive/negativeの片方だけを残さず、permissionとlimitを両方保ちます。',
		output: { format: 'message', minimumWords: 128, maximumWords: 225 },
	},
	{
		day: 258,
		title: 'Reading & Writing Lab · An inference with limits',
		sourceText:
			'A café introduced reusable cups with a small deposit. After two months, the number of disposable cups fell sharply, but staff also spent more time washing and tracking returns. Most customers returned cups within a week. Weekend visitors were less likely to return them, perhaps because many lived outside the area. The owner plans to keep the system while testing a return box near the station. The data supports the system’s environmental effect, but it does not yet show whether the extra staff time is affordable long term.',
		comprehension:
			'Which conclusion is supported, and which financial conclusion would be premature?',
		writing:
			'Write a cautious interpretation of the results, including one likely explanation, one limitation, and one next test.',
		guidance: 'fact・reasonable inference・unknownを明示的に分けます。',
		output: { format: 'report', minimumWords: 130, maximumWords: 230 },
	},
	{
		day: 264,
		title: 'Reading & Writing Lab · Repairing your own explanation',
		sourceText:
			'During a presentation, Jun said that a new search feature was “more accurate.” A listener asked whether that meant it found more results or better results. Jun realised that his wording was vague. He corrected himself: the feature removed more irrelevant results while keeping most useful ones. He gave an example and admitted that very short searches still caused problems. The clarification made the claim narrower, but also more credible.',
		comprehension: 'Why did narrowing the claim make Jun’s explanation stronger?',
		writing:
			'Write an initially vague claim, a listener’s clarification question, and a repaired explanation with an example and limitation.',
		guidance: '言い直しを失敗扱いせず、precisionとcredibilityを上げる操作として使います。',
		output: { format: 'connected-sentences', minimumWords: 132, maximumWords: 235 },
	},
	{
		day: 270,
		title: 'Reading & Writing Lab · Fluency Stage evidence review',
		sourceText:
			'By the end of the Fluency Stage, Yui can sustain longer conversations by organising experiences, summarising another person’s point, and asking for clarification before responding. In a recent task, she compared two solutions, explained the risk behind her choice, paraphrased an unfamiliar term, and revised one claim after a follow-up question. Her speech is not always smooth at near-natural speed, and inference becomes harder when a speaker implies rather than states a view. The evidence supports stronger B1 performance and readiness for more demanding B1+–B2-entry challenges; it is not a certification.',
		comprehension:
			'Which evidence supports progress, and which limitations prevent a stronger claim?',
		writing:
			'Write an evidence-based self-review with two demonstrated abilities, one limitation, and a concrete plan for the next stage.',
		guidance: 'level labelだけでなく、task evidenceと条件付きの次目標を示します。',
		output: { format: 'report', minimumWords: 140, maximumWords: 240 },
	},
] as const satisfies readonly IntegratedLabSeed[];

export const FLUENCY_PRACTICE_LABS: ReadonlyMap<number, IntegratedLabSeed> = new Map(
	LABS.map((lab) => [lab.day, lab]),
);
