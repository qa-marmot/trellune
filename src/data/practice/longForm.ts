import type { PracticeFeedback, PracticeOutput, PracticePrompt } from '../../curriculum/model';

export interface LongFormQuestionSeed {
	readonly prompt: string;
	readonly operation: PracticePrompt['operation'];
	readonly feedback: PracticeFeedback;
	readonly output: PracticeOutput;
}

export interface LongFormChallengeSeed {
	readonly day: number;
	readonly title: string;
	readonly sourceText: string;
	readonly readingQuestions: readonly LongFormQuestionSeed[];
	readonly writing: string;
	readonly writingGuidance: string;
	readonly writingOutput: PracticeOutput;
}

const readingOutput = Object.freeze({
	format: 'connected-sentences',
	minimumWords: 25,
	maximumWords: 90,
} as const satisfies PracticeOutput);

const sourceFeedback = (
	keyPoints: readonly string[],
	evidenceClue: string,
	commonMisunderstanding: string,
): PracticeFeedback => ({
	keyPoints,
	rationale:
		'長い本文では一文の一致ではなく、離れた箇所の情報を結び、結論の強さを本文の根拠に合わせます。',
	evidenceClue,
	commonErrors: [commonMisunderstanding],
	checklist: [
		'設問に直接答えた',
		'本文の複数箇所を必要に応じて結びつけた',
		'事実・推論・自分の意見を区別した',
		'本文を丸写しせず要点を自分の英語で示した',
	],
});

const CHALLENGES = [
	{
		day: 179,
		title: 'Long-form Challenge · The journey that changed its purpose',
		sourceText: `Mika had planned her first solo trip around a list. She would take the early train to a coastal town, visit a famous garden before the crowds arrived, eat lunch at a restaurant she had saved on her phone, and photograph the sunset from a hill. The plan made her feel safe because every hour had a purpose. When a signal problem stopped her train halfway, however, the list became impossible. The next train would not arrive for three hours, and the small station had no tourist information desk.

At first, Mika treated the delay as lost time. She refreshed the train app, calculated which reservations she would miss, and considered returning home. An older passenger noticed her frustration and suggested a walk to a nearby fishing village. He explained that the path was easy to follow and that the harbour café served whatever the boats had brought in that morning. Mika hesitated. The village was not in her guidebook, and she was worried about missing the replacement train. Still, she set an alarm and followed the path.

The harbour was quieter than the town she had intended to visit. At the café, the owner showed her how storms had changed the coastline and pointed to photographs taken before a new sea wall was built. Mika spoke with two local students who were helping to record older residents’ memories. They asked why she had come, and she admitted that she had not chosen the village at all. One student laughed and said that visitors often arrived by accident but remembered the place because they had time to talk.

		Mika eventually reached the coastal town after the garden had closed. She missed the planned photograph, and the restaurant charged a cancellation fee. In practical terms, the day was less efficient than the one on her list. Yet on the train home, she realised that the delay had required her to ask for help, judge a small risk, and pay attention to a place rather than to a schedule. She did not decide that planning was useless. Instead, she changed how she planned: on later trips she kept one important reservation, left part of the day open, and wrote down one question she hoped to ask a local person. The failed itinerary became evidence that a good journey could be structured without being completely controlled.

Months later, she noticed another change. When a friend’s train was delayed, Mika did not immediately say that the problem would become a wonderful adventure. She first helped her friend protect the important reservation and check the last train home. Flexibility, she had learned, was not cheerful denial. It was the ability to preserve what mattered while noticing possibilities the original plan had excluded.`,
		readingQuestions: [
			{
				prompt:
					'How does Mika’s definition of a successful trip change, and which events cause that change?',
				operation: 'summary',
				feedback: sourceFeedback(
					[
						'She moves from measuring success by completing a schedule to valuing attention, conversation, and flexible structure.',
						'The delay, local advice, harbour conversations, and missed reservations all contribute to the change.',
					],
					'Compare the opening list, the harbour encounter, and the final planning rule.',
					'The passage does not say that planning is bad or that the practical losses did not matter.',
				),
				output: readingOutput,
			},
			{
				prompt:
					'Why is the cancellation fee important to the writer’s point, even though it is a small detail?',
				operation: 'inference',
				feedback: sourceFeedback(
					[
						'It prevents the reflection from becoming a simple claim that unexpected change has no cost.',
						'Mika’s positive conclusion is qualified: flexibility was valuable, but the disrupted plan still had consequences.',
					],
					'Notice the contrast between “In practical terms” and “Yet”.',
					'The fee is not presented as proof that Mika made the wrong choice.',
				),
				output: readingOutput,
			},
		],
		writing:
			'Write a 100–160 word reflection about a plan that changed. Explain the original goal, the adjustment, one real cost, and what you would keep or change next time.',
		writingGuidance: '出来事を美化せず、sequence→cost→learning→future choiceをつなぎます。',
		writingOutput: { format: 'report', minimumWords: 100, maximumWords: 160 },
	},
	{
		day: 224,
		title: 'Long-form Challenge · Two views of a neighbourhood garden',
		sourceText: `Text A — A public-health volunteer

The empty lot beside our clinic has been unused for seven years. Our volunteer group proposes turning it into a small neighbourhood garden with raised beds, shade, and a table where people can meet. This is not a claim that gardening will solve every health problem. We expect a more modest benefit: older residents could do light activity close to home, children could learn where food comes from, and people who live alone would have a reason to speak to neighbours. Similar gardens in two nearby districts report regular participation, although their success depended on one paid coordinator. We therefore propose a one-year trial, an accessible path, and a small budget for coordination rather than relying entirely on volunteers.

The clinic should not judge the project only by the number of vegetables produced. Useful measures would include repeat attendance, participation by people with limited mobility, and whether residents report new social contact. If few people return after the opening month, the design should change. If participation remains broad, the council could consider making the garden permanent.

Text B — A resident next to the lot

I support using the lot, but the current proposal treats nearby homes as if they have no stake in the decision. The drawings place the shared table beside three bedroom windows, and the suggested closing time is 9 p.m. A garden that improves some residents’ wellbeing could reduce others’ sleep and privacy. The plan also mentions compost without explaining how smells, insects, or rubbish will be managed. These are practical concerns, not an argument for leaving the lot empty forever.

		A different layout could move the table toward the clinic, limit evening events, and assign responsibility for maintenance. The trial should record noise complaints and the condition of the site as well as attendance. I would also like residents from the surrounding buildings to join the project group before the design is fixed. Consultation should not mean presenting a finished plan and asking whether people like it. It should allow the people most affected to change the proposal. With those safeguards, I could support a garden; without them, a high attendance number would not show that the project was fair.

Both writers also leave questions unanswered. Neither explains how places would be allocated if demand exceeded the number of beds, or what would happen when the paid coordinator’s funding ended. Those gaps do not cancel the proposal. They show why a trial needs a review date and a decision about who can change the rules. A temporary garden can still create expectations that deserve honest management.`,
		readingQuestions: [
			{
				prompt:
					'What goal do both writers share, and where do their priorities or evidence differ?',
				operation: 'summary',
				feedback: sourceFeedback(
					[
						'Both support productive use of the lot and accept a garden in principle.',
						'Text A emphasises accessible activity and social contact; Text B emphasises privacy, maintenance, and genuine participation in design.',
					],
					'Compare what each writer wants the trial to measure.',
					'Text B does not reject the garden, and Text A does not claim gardening solves all health problems.',
				),
				output: readingOutput,
			},
			{
				prompt:
					'Create one trial condition and two measures that respond fairly to both texts. Explain why they fit the evidence.',
				operation: 'inference',
				feedback: sourceFeedback(
					[
						'A fair condition should protect access/social benefit and reduce noise, privacy, or maintenance risk.',
						'Measures should include both participation/social contact and an impact such as complaints, accessibility, or site condition.',
					],
					'Use the proposed trial, layout change, coordinator, and different measurement lists.',
					'Choosing only attendance repeats the exact weakness both texts identify.',
				),
				output: readingOutput,
			},
		],
		writing:
			'Write a 120–180 word recommendation to the council that synthesises both views, proposes safeguards, and states how the trial should be reviewed.',
		writingGuidance:
			'二つのtextを別々に要約するだけでなく、shared goal→tension→combined proposalへ進めます。',
		writingOutput: { format: 'report', minimumWords: 120, maximumWords: 180 },
	},
	{
		day: 269,
		title: 'Long-form Challenge · Sleep, memory, and the limit of a headline',
		sourceText: `A headline saying “Sleep makes you learn faster” sounds useful, but it compresses several different processes. During the day, attention affects what reaches memory in the first place. A tired learner may read the same paragraph repeatedly without forming a clear record of it. After learning, sleep appears to support consolidation—the process through which a new memory becomes more stable. This does not mean the brain stores every detail perfectly overnight. Important, repeated, or connected information is more likely to remain available than material that was barely understood.

Researchers often study this by teaching participants a list, a route, or a movement, then comparing performance after sleep or an equal period awake. Many studies find an advantage after sleep, but the size of the effect varies. Participants who sleep may also differ in stress, caffeine use, or time of day. Laboratory tasks are easier to control than real courses, yet they may not represent the complicated knowledge a learner uses in conversation. A result about remembering pairs of words should not automatically become a promise about mastering a language.

The practical message is therefore narrower than the headline. Sleep is one condition that can support learning; it cannot replace meaningful practice. A learner who studies late could benefit from a brief retrieval the next morning, because retrieval tests whether the memory is accessible and strengthens the route back to it. Spacing the next retrieval several days later gives different evidence: the answer is no longer supported by the immediate lesson. Errors in either attempt can guide review.

		There is also a risk in turning sleep advice into another source of anxiety. People have different work, health, and family conditions, and one poor night does not erase previous study. A sustainable routine might protect a realistic sleep window, avoid placing every difficult task at the end of the day, and use short retrieval rather than guilt when energy is low. The strongest conclusion is not that sleep guarantees memory. It is that attention, consolidation, retrieval, and spacing work together, while each is limited by the learner’s context.

This conclusion changes what a learner should measure. A study diary could record when a topic was first understood, whether it could be retrieved the next morning, and what remained after a week. It should not turn every difference into a medical conclusion. The diary offers personal evidence for adjusting a routine; it cannot isolate sleep from motivation, difficulty, or prior knowledge as a laboratory study attempts to do.`,
		readingQuestions: [
			{
				prompt:
					'What claim does the article support, and which stronger headline claim does it reject?',
				operation: 'summary',
				feedback: sourceFeedback(
					[
						'Sleep can support consolidation as one part of learning.',
						'It does not guarantee faster language mastery or replace attention, meaningful practice, retrieval, and spacing.',
					],
					'Follow the repeated narrowing from the headline to the final paragraph.',
					'The article does not say that sleep has no measurable effect.',
				),
				output: readingOutput,
			},
			{
				prompt:
					'Why are laboratory memory tasks useful but incomplete evidence for language learning?',
				operation: 'inference',
				feedback: sourceFeedback(
					[
						'Controlled tasks isolate factors and allow comparison after sleep or wakefulness.',
						'Word pairs, routes, or movements do not capture complex knowledge, interaction, or uncontrolled learner conditions.',
					],
					'Compare the second paragraph’s strengths and limitations of laboratory tasks.',
					'An imperfect match does not make controlled research useless.',
				),
				output: readingOutput,
			},
		],
		writing:
			'Write a 130–190 word practical note for a busy learner. Give a cautious conclusion, explain the role of retrieval, and avoid advice that creates unnecessary guilt.',
		writingGuidance:
			'popular-science claimを断定へ変えず、evidence→limit→practical actionを保ちます。',
		writingOutput: { format: 'report', minimumWords: 130, maximumWords: 190 },
	},
	{
		day: 299,
		title: 'Long-form Challenge · Two reviews, two kinds of travel value',
		sourceText: `Review A — A guided night walk

The old district is crowded during the day, so the night walk promised a quieter way to understand it. Our guide, Lena, did not simply list dates. She used three buildings to tell a story about trade, migration, and changes in family life. At one stop she played a short recording from a resident who had worked in the market forty years earlier. The group was small enough to ask questions, and Lena admitted when a popular local story had little historical evidence. The pace, however, was demanding. We stood for long periods, two streets had uneven surfaces, and the website had not made those access conditions clear. I recommend the walk to visitors who enjoy detailed stories and can manage the route, but the company should offer a shorter accessible version.

Review B — A self-guided audio route

This route covers the same district through an app. Its main strength is control: listeners can start at any time, repeat a section, or skip a stop. The map worked offline, and each recording lasted under five minutes. The speakers included an architect, a shop owner, and two teenagers, so the district did not sound as if it belonged only to the past. Yet the route sometimes confused variety with connection. One stop discussed roof design and the next described a music venue, but the app did not explain how the subjects formed a larger story. I learned several facts without always understanding why they mattered together. It is a good low-cost option for independent visitors, especially those who need breaks, but a stronger final summary would make the experience more memorable.

		Both reviews value more than the number of attractions. The guided walk creates a coherent interpretation and live interaction, while the audio route offers access, flexibility, and several voices. Neither is best for every visitor. A useful recommendation must connect the traveller’s needs—mobility, cost, independence, desire for questions, and interest in a connected story—to the strengths and limitations described.

A family travelling with a child might combine the formats: use two short audio stops, take a break, and join a shorter guided section. A visitor researching local history might prefer the full walk and prepare questions. These examples are not present in the reviews as tested outcomes, so they should be framed as reasonable recommendations rather than facts. Good synthesis uses the evidence without pretending it answers every new case.`,
		readingQuestions: [
			{
				prompt:
					'Compare how each experience creates value and where each one limits access or understanding.',
				operation: 'summary',
				feedback: sourceFeedback(
					[
						'The guided walk offers coherence and questions but has physical/access demands.',
						'The app offers control, lower cost, breaks, and varied voices but weakens connection between ideas.',
					],
					'Use the recommendation and reservation in each review, not just the feature list.',
					'Flexibility is not automatically deeper learning, and guided detail is not automatically accessible.',
				),
				output: readingOutput,
			},
			{
				prompt:
					'Which option would you recommend to two different travellers? Give conditions rather than one universal winner.',
				operation: 'inference',
				feedback: sourceFeedback(
					[
						'Recommendations should map traveller needs to the evidence in each review.',
						'A strong answer states a condition or limitation for both choices.',
					],
					'Use mobility, cost, independence, questions, and desire for a connected story.',
					'Personal preference without textual evidence does not answer the comparison task.',
				),
				output: readingOutput,
			},
		],
		writing:
			'Write a 150–220 word travel recommendation for two named visitor profiles. Synthesise both reviews and include one improvement for each experience.',
		writingGuidance:
			'profile A / Bを単純な勝敗にせず、need→evidence→conditional recommendationへ結びます。',
		writingOutput: { format: 'opinion', minimumWords: 150, maximumWords: 220 },
	},
	{
		day: 329,
		title: 'Long-form Challenge · Participation beyond the final score',
		sourceText: `Report — Community sports trial

A community centre offered a twelve-week evening sports programme for teenagers who were not already members of a team. Participants could try basketball, badminton, dance, and non-competitive fitness. Of the sixty people who registered, forty-two attended at least six sessions and twenty-eight attended ten or more. A short survey found that most regular participants felt more confident joining group activities. Staff also reported fewer arguments as the weeks continued, although there was no comparison group and school schedules may have affected attendance.

The headline result—forty-two regular participants—hides uneven access. Attendance was lower among teenagers who lived beyond the main bus route, and two wheelchair users stopped coming after the dance sessions moved upstairs while a lift was being repaired. Girls attended the mixed basketball sessions less often after week four. Interviews suggested that some enjoyed the activity but disliked being chosen for teams in public. The centre responded by adding skill stations before full games, but the change came late in the trial.

Comment — A volunteer coach

The numbers matter, but I would not call the programme successful only because people arrived. At the beginning, several participants stayed close to friends and avoided unfamiliar activities. By the final weeks, I saw some of them explain rules to new members, recover after mistakes, and ask to try again. Those changes are difficult to capture in attendance totals. At the same time, positive stories can hide the people who left. We need to ask them directly whether transport, physical access, team selection, cost, or something else made participation harder.

		For a second trial, I would keep the range of activities but publish an accessibility check before each session, provide transport support on two routes, and let participants choose between competitive games and skill-based practice. We should record return rates for different groups, not to label anyone, but to notice whether the programme works mainly for people who already feel comfortable. A fair programme should increase both participation and the ability to take part without avoidable barriers.

The centre must also decide what it can learn from a twelve-week trial. Improved confidence reported immediately after the programme may be meaningful without lasting for a full year. A follow-up conversation three months later could show whether participants joined other activities or kept contact with people they met. It would still rely on self-report, so the final evaluation should state that limitation instead of turning a promising local result into a universal claim.`,
		readingQuestions: [
			{
				prompt:
					'Which evidence suggests genuine benefit, and which evidence prevents a simple success claim?',
				operation: 'summary',
				feedback: sourceFeedback(
					[
						'Repeat attendance, confidence, improved interaction, and willingness to retry suggest benefit.',
						'Transport, physical access, gendered participation, dropouts, and lack of a comparison group limit the claim.',
					],
					'Combine the report’s statistics with the coach’s observations and cautions.',
					'Neither attendance alone nor one positive story represents every participant.',
				),
				output: readingOutput,
			},
			{
				prompt:
					'How does the coach redefine “participation,” and why does that matter for the next trial?',
				operation: 'inference',
				feedback: sourceFeedback(
					[
						'Participation includes confidence, recovery, helping others, choice, and access—not just presence.',
						'This definition leads to different design choices and subgroup measures in the next trial.',
					],
					'Connect the observed behaviour to the proposed accessibility, transport, and activity options.',
					'The coach does not say attendance data should be ignored.',
				),
				output: readingOutput,
			},
		],
		writing:
			'Write a 150–230 word recommendation for the second trial. Prioritise two changes, justify them with both texts, and define success with balanced measures.',
		writingGuidance:
			'statisticとlived experienceを競わせず、design choiceとreview measureへ統合します。',
		writingOutput: { format: 'report', minimumWords: 150, maximumWords: 230 },
	},
	{
		day: 344,
		title: 'Long-form Challenge · The editor who learned to leave silence',
		sourceText: `When Noor began producing a weekly community radio programme, she believed a good interview was a fast interview. She prepared twenty questions, removed pauses during editing, and filled uncertain moments with her own explanations. The final programme sounded energetic, but several guests said they had not finished their thoughts. Listeners remembered Noor’s voice more clearly than the people she was interviewing.

Her approach changed during a conversation with Kenji, a retired mechanic who had helped rebuild the town after a flood. He answered the first questions briefly. When Noor asked what he remembered most, he looked at the table and remained silent. She nearly moved to the next question, but the sound engineer signalled for her to wait. After twelve seconds, Kenji described the ordinary noises that had disappeared after the flood: delivery bicycles, a school bell, and neighbours opening metal shutters. The detail led to a story about how residents knew recovery had begun—not when officials announced it, but when those sounds returned.

Noor kept the pause in the broadcast. Some listeners initially thought their radio had stopped, yet many wrote that the silence made them pay attention. The moment did not prove that every pause is meaningful. Long hesitation can also show confusion, an unclear question, or a guest who needs support. Noor learned to distinguish between abandoning a guest and giving a thought room to develop. She began using shorter question lists, asking follow-ups based on the answer, and checking after the interview whether a sensitive detail should remain.

The programme also changed how it represented the community. Earlier episodes had invited people with formal titles because they seemed easier to introduce. Later episodes included carers, teenagers, recent arrivals, and shop workers. Noor did not treat every personal memory as reliable history; the team checked dates and added context when accounts differed. But she understood that factual checking and human perspective served different purposes. The strongest episodes made both visible.

		Five years later, Noor trained new producers with one rule: prepare enough to recognise an important answer, but not so much that your plan prevents you from hearing it. The advice applies beyond radio. Natural interaction requires structure, evidence, and responsibility, but it also requires the willingness to let another person change the direction of the conversation.

She demonstrated the rule by asking trainees to edit the same interview twice. The first version removed every silence; the second kept only pauses that changed how a following sentence was understood. Comparing them made the choice concrete. Silence was not automatically authentic, and editing was not automatically dishonest. The producer’s responsibility was to make a deliberate choice that served the guest, the listener, and the factual record together.`,
		readingQuestions: [
			{
				prompt:
					'How does Noor’s idea of a skilled interviewer develop, and what does she keep from her earlier approach?',
				operation: 'summary',
				feedback: sourceFeedback(
					[
						'She moves from speed/control toward listening, responsive follow-up, silence, and diverse perspectives.',
						'She still values preparation, factual checking, context, consent, and responsibility.',
					],
					'Compare the first paragraph, the Kenji interview, and the final training rule.',
					'The lesson is not to abandon preparation or assume every pause is meaningful.',
				),
				output: readingOutput,
			},
			{
				prompt:
					'What is implied by “prepare enough to recognise an important answer”? Explain how the story supports your inference.',
				operation: 'inference',
				feedback: sourceFeedback(
					[
						'Preparation provides knowledge and direction, but its purpose is to notice and develop unexpected meaning rather than control every answer.',
						'Noor recognises the importance of Kenji’s pause and changes follow-ups while continuing to verify facts and protect guests.',
					],
					'Use both the failed twenty-question style and the later editorial safeguards.',
					'The phrase does not recommend passive listening without judgement.',
				),
				output: readingOutput,
			},
		],
		writing:
			'Write a 160–240 word profile of someone who changed how they work or communicate. Use one revealing scene, explain the change, and qualify the lesson.',
		writingGuidance:
			'biographyをachievement listにせず、scene→change→limit→transferable lessonで構成します。',
		writingOutput: { format: 'report', minimumWords: 160, maximumWords: 240 },
	},
	{
		day: 359,
		title: 'Long-form Challenge · What should a news feed optimise?',
		sourceText: `Text A — A personalisation researcher

Most readers do not want to search through hundreds of stories every morning. A personalised feed can reduce that effort by learning which subjects, formats, and locations a reader usually chooses. Used carefully, it can also increase variety: someone who reads national technology news might receive a local science event, an interview with a designer, or a report from another country. The important question is what the system is asked to optimise. If the only target is immediate clicks, dramatic or familiar stories may dominate. A broader target could include whether people finish an article, save it, return to a subject later, or deliberately choose a different perspective.

Personalisation should be visible and adjustable. Readers need a way to see why a story appeared, change interests, and request more variety. No interface will remove every bias, but control makes the system open to correction instead of pretending that its selections are neutral.

Text B — A local-news editor

Choice is useful, but a news service is not only a collection of private interests. Some information matters because people share a place: a water restriction, a school-board decision, a change to a bus route, or the closure of a health clinic. A reader may never click those subjects voluntarily, yet missing them can reduce their ability to participate in community decisions. Editors therefore make a public-interest judgement as well as a prediction about preference.

That judgement can also become narrow. Editors may overestimate which institutions matter and underestimate stories from communities they know less well. Human selection is not automatically fairer than an algorithm. Local newsrooms need listening channels, transparent corrections, and evidence about who is absent from coverage.

		The two positions are not exact opposites. Both reject a single invisible authority deciding what everyone should see. One emphasises individual control over prediction; the other emphasises shared information and editorial responsibility. A credible feed could protect a small public-interest section, explain personal recommendations, let readers adjust them, and audit both the algorithm’s suggestions and the newsroom’s coverage. The trade-off is attention: every protected story reduces space for another choice, so the service should test whether the design informs readers without making the feed feel irrelevant.

Testing should examine behaviour over time, not only reactions on launch day. Readers might initially open the public-interest section because it is new, then ignore it. Others may read fewer stories but remember more useful information. Interviews can reveal why a recommendation felt irrelevant, while coverage audits can show which places or groups rarely appear. None of these measures is neutral, but together they make the design’s assumptions easier to challenge.`,
		readingQuestions: [
			{
				prompt:
					'Synthesise the strongest concern in each text and the shared principle behind both positions.',
				operation: 'summary',
				feedback: sourceFeedback(
					[
						'Text A warns that opaque click optimisation narrows choice; Text B warns that pure preference can omit shared public information.',
						'Both want selection to be visible, correctable, and accountable rather than controlled by one hidden authority.',
					],
					'Compare individual adjustment in Text A with editorial correction/listening in Text B and the final synthesis.',
					'The texts are not simply technology versus human editors.',
				),
				output: readingOutput,
			},
			{
				prompt:
					'What does the final paragraph imply should be measured before calling the combined design successful?',
				operation: 'inference',
				feedback: sourceFeedback(
					[
						'The service must examine informed exposure, relevance, user control, missing perspectives, and the attention cost of protected stories.',
						'Clicks alone cannot show whether the design serves personal and public needs.',
					],
					'Use “audit”, “trade-off is attention”, and “informs ... without ... irrelevant”.',
					'A public-interest section is a proposal to test, not proof of balance.',
				),
				output: readingOutput,
			},
		],
		writing:
			'Write a 170–250 word design recommendation that integrates both texts. Include a principle, concrete controls, one protected public-interest feature, and success/failure measures.',
		writingGuidance:
			'二つのsourceを並べず、shared principle→design→trade-off→measurementへ統合します。',
		writingOutput: { format: 'report', minimumWords: 170, maximumWords: 250 },
	},
] as const satisfies readonly LongFormChallengeSeed[];

export const LONG_FORM_CHALLENGES: ReadonlyMap<number, LongFormChallengeSeed> = new Map(
	CHALLENGES.map((challenge) => [challenge.day, challenge]),
);
