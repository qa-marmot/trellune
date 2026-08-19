import type { IntegratedLabSeed } from './shared';

const LABS = [
	{
		day: 275,
		title: 'Reading & Writing Lab · Supporting a position with relevant evidence',
		sourceText:
			'A town is considering turning an unused cinema into rehearsal and performance space for community groups. Supporters say local musicians, theatre groups, and young filmmakers have few affordable places to work, while restoring the cinema could keep part of the town’s cultural history visible. Critics argue that renovation costs may rise and that evening events could disturb nearby residents. A two-week summer trial filled most rehearsal slots and attracted large audiences, but it coincided with the annual arts festival. The result suggests genuine interest, yet it does not show whether demand will remain equally high in an ordinary month. A reasonable decision should address both cultural value and the continuing cost of running the building.',
		comprehension:
			'Which evidence supports restoring the cinema, and what limitation prevents that evidence from settling the issue?',
		writing:
			'Take a position on the change. Use the evidence, acknowledge one counterpoint, and propose a condition or safeguard.',
		guidance: 'stance→evidence→counterpoint→conditionの順で、evidenceの限界も隠しません。',
		output: { format: 'opinion', minimumWords: 140, maximumWords: 210 },
	},
	{
		day: 280,
		title: 'Reading & Writing Lab · A recommendation for different users',
		sourceText:
			'A museum is testing two ways to explore a new photography exhibition. The first is a guided tour at fixed times. It creates a clear story and lets visitors ask questions, but people who need breaks or arrive late may miss important sections. The second is a self-guided audio route that visitors can pause and follow in any order. Early surveys show higher satisfaction with the audio route, although some first-time visitors say the exhibition feels disconnected without a guide. Interviews suggest that visitors who know little about photography value a stable sequence, while experienced visitors value control. The museum could choose one format, or offer a short guided introduction followed by optional audio chapters.',
		comprehension:
			'What different needs explain why one exhibition format may not suit every visitor?',
		writing:
			'Recommend an exhibition format for the museum. Compare trade-offs and explain how visitors could move between levels of support.',
		guidance: 'one-size-fits-allを避け、user group・benefit・cost・transitionを結びます。',
		output: { format: 'report', minimumWords: 145, maximumWords: 215 },
	},
	{
		day: 285,
		title: 'Reading & Writing Lab · Counterpoint without losing your stance',
		sourceText:
			'A company plans to publish salary ranges in every job advertisement. Advocates argue that clear ranges save applicants time and reduce unequal negotiation. Some managers worry that a fixed range may discourage unusually skilled candidates or create tension among current employees whose pay developed under older systems. Those concerns do not necessarily defeat transparency, but they show that publication alone is incomplete. The company may also need a process for reviewing existing pay, explaining how experience affects an offer, and allowing justified exceptions without making the range meaningless. The debate is therefore not simply transparency versus secrecy; it is about how transparent information connects to fair decisions.',
		comprehension: 'How does the final sentence reframe the disagreement?',
		writing:
			'Argue for or against publishing ranges. Present the strongest opposing point fairly before responding to it.',
		guidance: '弱い反対意見を作らず、相手のbest pointを認めてから自分のstanceを限定・補強します。',
		output: { format: 'opinion', minimumWords: 150, maximumWords: 220 },
	},
	{
		day: 290,
		title: 'Reading & Writing Lab · A hypothetical policy test',
		sourceText:
			'Imagine that a town makes its central shopping street car-free every Saturday. Air quality and pedestrian safety might improve, and cafés could use more outdoor space. On the other hand, customers with limited mobility might find some shops harder to reach, while deliveries could become more expensive. A permanent decision would be risky without local evidence. The town could first run the scheme for three Saturdays, provide a small accessible shuttle, and collect data on visitor numbers, delivery delays, noise, and complaints. Even a successful trial would need careful interpretation because good weather or a special event might temporarily increase attendance.',
		comprehension:
			'Why would positive visitor numbers alone be insufficient evidence for a permanent policy?',
		writing:
			'Evaluate the hypothetical policy. State expected benefits, risks, a fair trial design, and the evidence you would use.',
		guidance: 'second conditionalを自然に使い、predictionとmeasurementを区別します。',
		output: { format: 'report', minimumWords: 150, maximumWords: 225 },
	},
	{
		day: 295,
		title: 'Reading & Writing Lab · Trade-offs hidden by a simple metric',
		sourceText:
			'A customer support team is judged mainly by average response time. The number improved after the team introduced short standard replies. However, customers began reopening more cases because some replies did not solve the original problem. Managers initially celebrated the faster metric, while experienced staff warned that the measure rewarded speed without resolution. The team now proposes tracking first-response time, successful resolution, and customer effort together. No single measure is perfect: resolution can take longer for difficult cases, and satisfaction can be influenced by factors outside the team’s control. A useful system should reveal trade-offs rather than turn one convenient number into the whole goal.',
		comprehension: 'What unintended behaviour did the original metric encourage?',
		writing:
			'Explain a case in which one metric could mislead a decision. Propose a small set of measures and discuss their limits.',
		guidance:
			'metricを善悪で扱わず、incentive・missing information・balanced evidenceを説明します。',
		output: { format: 'report', minimumWords: 155, maximumWords: 230 },
	},
	{
		day: 300,
		title: 'Reading & Writing Lab · Separating values from predictions',
		sourceText:
			'Two residents disagree about building apartments near a station. One values affordable housing and believes greater supply will reduce pressure on rents. The other values the same goal but predicts that the project will increase traffic and replace useful local shops. Their argument sounds like a conflict of values, yet much of it concerns uncertain effects. They could make progress by identifying which outcomes they both care about, then examining transport plans, expected rents, shop protections, and examples from comparable areas. Evidence may not remove every disagreement, but it can show whether people oppose the goal or doubt the proposed method.',
		comprehension:
			'Why might describing this as a simple conflict of values block useful discussion?',
		writing:
			'Summarise both positions, identify shared values, and write three questions whose answers would clarify the disagreement.',
		guidance: 'personへの評価を避け、value・prediction・evidence questionを分けます。',
		output: { format: 'summary', minimumWords: 155, maximumWords: 230 },
	},
	{
		day: 305,
		title: 'Reading & Writing Lab · Explaining a technical idea simply',
		sourceText:
			'A backup is not the same as synchronization. Synchronization keeps copies on different devices aligned, which is useful when a person changes something and wants the update everywhere. That same strength can also copy an accidental deletion. A backup records a recoverable state from an earlier time. It may be less current, but it provides a route back when synchronized data is damaged or removed. A reliable system often uses both: synchronization for continuity and backups for recovery. The distinction becomes clear if we compare them to two shared notebooks and a dated photocopy. The notebooks stay alike; the photocopy does not change when a page is erased.',
		comprehension:
			'Which analogy explains the different purpose of a backup, and where might the analogy be incomplete?',
		writing:
			'Explain a technical or general process to a non-specialist using a definition, analogy, example, and one limitation.',
		guidance: '専門語を別の専門語で置き換えず、正確さを保ちながら段階的に説明します。',
		output: { format: 'report', minimumWords: 160, maximumWords: 235 },
	},
	{
		day: 310,
		title: 'Reading & Writing Lab · Cause, correlation, and a cautious claim',
		sourceText:
			'A health centre noticed that residents who joined its optional weekend walking group often reported lower stress after three months. It would be tempting to conclude that the group caused the improvement. However, people who already enjoyed exercise or had more free time may have been more likely to join, and seasonal weather may also have affected mood. The group could still be valuable: participants described discovering safer routes and meeting neighbours they had not known before. To make a stronger causal claim, the centre would need evidence such as changes over time, comparable residents, or a trial that reduces selection differences. Until then, the safest conclusion is that participation and lower reported stress are associated, while the group’s exact contribution remains uncertain.',
		comprehension:
			'Which alternative explanations weaken the simple claim that the walking group reduced stress?',
		writing:
			'Report the finding accurately for residents. Explain what is known, what is not known, and what evidence would strengthen the conclusion.',
		guidance: 'may / suggests / is associated withを使い、causationを過剰に主張しません。',
		output: { format: 'report', minimumWords: 160, maximumWords: 240 },
	},
	{
		day: 315,
		title: 'Reading & Writing Lab · A layered explanation',
		sourceText:
			'People sometimes describe a failed online meeting as a “technology problem,” but that label may hide several layers. The immediate failure could be weak audio. The contributing cause might be that nobody tested the room microphone. The organisational cause might be that responsibility for the test was never assigned. Each layer suggests a different response: reconnecting the audio solves the moment, a checklist reduces repetition, and clear ownership changes the process. A good explanation does not make every event complicated. It selects the depth needed for the decision. If the meeting failed once, a quick fix may be enough. If it fails weekly, the deeper process matters.',
		comprehension:
			'How does the appropriate depth of explanation depend on the decision being made?',
		writing:
			'Explain a recurring problem at three levels: immediate symptom, contributing cause, and system or habit. Match each level with an action.',
		guidance: 'complexityを見せるためではなく、decisionに必要な因果の深さを選びます。',
		output: { format: 'report', minimumWords: 165, maximumWords: 240 },
	},
	{
		day: 320,
		title: 'Reading & Writing Lab · Respectful disagreement in a team',
		sourceText:
			'A product team wants to remove an old feature because few people use it. Ravi agrees that maintenance takes time, but he questions whether usage data tells the whole story. The feature is mainly used by a small group of customers with accessibility needs, and those customers may depend on it. He does not insist that the feature remain unchanged. Instead, he asks the team to contact affected users, test an accessible replacement, and publish a transition period. His response combines agreement about the cost with disagreement about the evidence and timing. That structure keeps the discussion focused on the decision rather than on personal loyalty to the feature.',
		comprehension: 'Which parts of the proposal does Ravi accept, question, and replace?',
		writing:
			'Write a response to a team proposal that includes partial agreement, an evidence gap, an alternative, and a respectful next step.',
		guidance: 'counterpointをpersonへのattackにせず、claim・evidence・processへ向けます。',
		output: { format: 'message', minimumWords: 165, maximumWords: 245 },
	},
	{
		day: 325,
		title: 'Reading & Writing Lab · The strongest counterargument',
		sourceText:
			'Supporters of a four-day workweek often emphasise focus, recovery, and reduced commuting. A serious counterargument is not simply that change feels unusual. Some services require continuous coverage, and compressing the same workload into fewer days could increase stress. Small organisations may struggle to create overlapping schedules. These problems do not prove that shorter weeks always fail; they identify conditions under which the policy needs redesign. A fair evaluation would distinguish reduced hours from compressed hours, compare different roles, and track workload as well as output. The strongest argument for a policy becomes more credible when it explains where the policy may not fit.',
		comprehension:
			'Why does the passage treat the counterargument as a design condition rather than a complete rejection?',
		writing:
			'Present a policy you generally support, steelman its strongest counterargument, and explain where your support should be limited or adapted.',
		guidance: 'straw manを避け、反対側が納得できる形でriskを述べてから応答します。',
		output: { format: 'opinion', minimumWords: 170, maximumWords: 245 },
	},
	{
		day: 330,
		title: 'Reading & Writing Lab · A discussion synthesis',
		sourceText:
			'In a discussion about cameras in public parks, one group prioritised safety and evidence after incidents. Another worried about privacy, unequal monitoring, and data being kept longer than necessary. A third participant suggested better lighting and staff presence before adding cameras. The groups did not reach complete agreement, but they identified common ground: the park should feel safe, any measure should be proportionate, and results should be reviewed. Their remaining disagreement concerned whether cameras were necessary and what evidence would prove that less intrusive measures had failed.',
		comprehension: 'What common ground emerged, and which question remained unresolved?',
		writing:
			'Write a neutral synthesis of the three positions, common ground, unresolved issue, and a reasonable next step.',
		guidance: 'speakerごとのsummaryを並べるだけでなく、relationship between positionsを示します。',
		output: { format: 'summary', minimumWords: 170, maximumWords: 250 },
	},
	{
		day: 335,
		title: 'Reading & Writing Lab · Inferring stance from qualification',
		sourceText:
			'A reviewer writes, “The restored concert hall has warm sound, helpful staff, and clear views from the main floor. Whether it works equally well for a sold-out event is less clear. At a small jazz show, entry was relaxed, but after a popular band finished, one narrow exit became crowded and signs to the second exit were hard to see. I would return for a quieter performance, though I would check the venue’s crowd plan before a major show.” The reviewer never says that the hall is simply good or bad. Positive language describes the artistic experience, while qualification narrows confidence when the building is full. The recommendation is conditional rather than neutral.',
		comprehension:
			'What is the reviewer’s stance, and which contrastive phrases reveal its limits?',
		writing:
			'Summarise the review’s stance, then write your own conditional recommendation for a tool or service.',
		guidance: 'toneを一語で決めず、praise・reservation・conditionの組み合わせから推論します。',
		output: { format: 'opinion', minimumWords: 170, maximumWords: 250 },
	},
	{
		day: 340,
		title: 'Reading & Writing Lab · Implication and missing context',
		sourceText:
			'At the end of a budget meeting, the chair says, “We have approved the essential repairs. The training proposal has many strengths, but we may want to see how the first quarter develops before committing the remaining funds.” The sentence does not formally reject training. However, placing it after essential repairs, referring to remaining funds, and delaying commitment imply that budget uncertainty has lowered its priority. A listener should not report that training was cancelled. A more accurate report would say that the proposal was deferred and may return if financial conditions become clearer.',
		comprehension: 'Which details imply lower priority without proving final rejection?',
		writing:
			'Write a careful meeting update that reports the decision, its implied reason, and the condition for reconsideration.',
		guidance: 'stated factとimplicationをlanguageで区別し、certaintyを捏造しません。',
		output: { format: 'message', minimumWords: 175, maximumWords: 250 },
	},
	{
		day: 345,
		title: 'Reading & Writing Lab · Nuance under time pressure',
		sourceText:
			'A manager asks whether a pilot programme was successful. The easy answer is yes: participation reached the target and most users finished. The fuller answer is more qualified. Completion was high among people who joined in the first week, while later participants received less support and left more often. The programme appears effective when onboarding is strong, but the team does not yet know whether it can provide that support at a larger scale. A concise but responsible answer should preserve both the positive result and the scaling risk instead of choosing whichever sounds more confident.',
		comprehension: 'How would a simple “yes” distort the evidence?',
		writing:
			'Give a concise decision update followed by a fuller explanation that preserves one positive result, one condition, and one unresolved risk.',
		guidance: 'short answerでもqualificationを失わず、必要なら二段階でdetailを加えます。',
		output: { format: 'report', minimumWords: 175, maximumWords: 250 },
	},
	{
		day: 350,
		title: 'Reading & Writing Lab · An accessible recommendation report',
		sourceText:
			'A sports centre tested booking-only access to its busiest gym area. Waiting lines became shorter, and staff could control crowding. However, people who made spontaneous visits or had limited digital access found it harder to enter. The centre is considering three options: keep full booking, return to walk-in access, or reserve most places while keeping several walk-in spaces. Data from the trial covers peak evening hours but not weekends. Before choosing, the centre must decide whether predictability, flexibility, or equal access deserves the greatest weight, and whether a mixed system can protect all three well enough.',
		comprehension: 'Why might the mixed system be attractive, and what evidence is still missing?',
		writing:
			'Write a short recommendation report with context, findings, options, recommendation, safeguards, and a review measure.',
		guidance: 'headingなしでも論理的なreport順序を保ち、recommendationをevidenceへ接続します。',
		output: { format: 'report', minimumWords: 180, maximumWords: 250 },
	},
	{
		day: 355,
		title: 'Reading & Writing Lab · Responding to a critical email',
		sourceText:
			'A traveller writes that a guesthouse booking was confusing. The room description mentioned breakfast, but the additional breakfast charge appeared only near the end of the confirmation page. The traveller does not claim that the fee was illegal; they say the information was technically present but not prominent enough for an informed choice. A defensive reply might quote the booking terms and close the case. A more useful reply would acknowledge the communication problem, explain what can be reviewed now, state what cannot be promised, and describe how future booking pages will show the total optional cost earlier.',
		comprehension:
			'What distinction does the customer make between available information and clear communication?',
		writing:
			'Write a professional response that acknowledges the concern, offers a proportionate action, sets a boundary, and states a preventive improvement.',
		guidance: '謝罪だけ・規約引用だけにせず、understanding・action・limit・preventionを含めます。',
		output: { format: 'message', minimumWords: 180, maximumWords: 250 },
	},
	{
		day: 360,
		title: 'Reading & Writing Lab · Integrated B2-entry challenge',
		sourceText:
			'A regional employer is deciding whether to make remote work the default for roles that do not require a physical site. The change could widen recruitment, reduce commuting, and give employees more control. It may also weaken informal learning, make early-career support harder, and shift office costs onto workers. Evidence from the current hybrid policy is mixed: individual focus has improved, but some teams report slower decisions. A strong recommendation should not treat “remote” and “office” as complete opposites. It should consider role, experience, task type, accessibility, home conditions, and the purpose of meeting in person. The question is not where everyone should work every day, but which arrangement supports good work fairly and how the organisation will notice when it is failing.',
		comprehension: 'How does the passage redefine the decision beyond remote versus office?',
		writing:
			'Write a structured recommendation with stance, evidence, trade-offs, alternative perspective, safeguards, and success/failure indicators.',
		guidance: '一般論を並べず、条件付きpolicyと測定可能なreview planへまとめます。',
		output: { format: 'report', minimumWords: 190, maximumWords: 250 },
	},
	{
		day: 365,
		title: 'Reading & Writing Lab · Graduation evidence task',
		sourceText:
			'After one year, an English learner can measure progress in several ways. Finishing 365 days shows persistence and exposure, but it does not by itself prove a CEFR level. A stronger judgement asks what the learner can do with unfamiliar input and under less support. Can they identify a writer’s stance, distinguish evidence from inference, and summarise a text without copying it? Can they write a clear response that develops a position, acknowledges another perspective, and stays accurate enough to follow? Can they sustain spoken interaction, repair misunderstanding, and understand key points at near-natural speed? Evidence across these tasks may support an estimate such as B1+, B2-entry, or B2. The estimate remains a profile of demonstrated performance, not a formal certificate, and weaker skills should remain visible rather than being hidden by a single average.',
		comprehension:
			'Why are course completion and one overall score insufficient evidence for a full CEFR estimate?',
		writing:
			'Write a 180–250 word graduation response: summarise the passage’s position, evaluate your own evidence across reading, writing, listening, and speaking, acknowledge a limitation, and set two next actions.',
		guidance: '自己評価を願望ではなく具体的task evidenceへ結び、full B2を自動的に名乗りません。',
		output: { format: 'report', minimumWords: 180, maximumWords: 250 },
		readingOperation: 'inference',
		writingOperation: 'summary',
	},
] as const satisfies readonly IntegratedLabSeed[];

const FOLLOW_UP_PARAGRAPHS = new Map<number, string>([
	[
		275,
		'Before committing to a permanent renovation, the town could repeat the trial outside festival season and measure rehearsal use, ordinary audience demand, noise, and operating cost. Interviews should include nearby residents as well as performers and visitors. If cultural participation remains broad while the building stays affordable and disruption is controlled, the proposal becomes stronger. If attendance falls sharply or running costs depend on one exceptional event, the same festival total would hide an important risk.',
	],
	[
		280,
		'A useful trial would follow first-time and experienced museum visitors separately. The museum should record not only satisfaction but also whether visitors can explain the exhibition’s main idea, where they stop, and whether they use the chance to ask questions. Control may feel attractive because it is convenient, while a guide may appear stronger because a confident speaker is memorable. A lasting format needs evidence about understanding, access, and enjoyment rather than one overall rating.',
	],
	[
		285,
		'Transparency would also affect people already employed by the company. Publishing a range without reviewing unexplained differences could reveal unfairness while offering no route to correct it. On the other hand, delaying publication until every historic case is solved could preserve the current problem indefinitely. A phased policy could publish ranges, explain the factors behind placement, and set a dated process for reviewing current pay rather than presenting transparency as a complete solution.',
	],
	[
		290,
		'The trial should include people whose journeys are easiest to overlook. Shop owners could record delivery time and weekend sales, while residents with mobility needs could test the shuttle and report where access still fails. Air and safety data matter, but so does the distribution of costs. A scheme that raises total visitor numbers while excluding a smaller group would need redesign before the town could call it successful.',
	],
	[
		295,
		'The team could review a balanced set of measures each week and examine difficult cases separately. A slower reply may be appropriate when a problem is complex, so targets should not punish staff for necessary investigation. Reopened cases can also have causes outside the first reply. Combining numbers with a small sample of case reviews would make the system less convenient, but it would give managers a more faithful picture of customer effort and real resolution.',
	],
	[
		300,
		'The residents could also examine what happened in comparable station areas, while checking whether those examples share the same transport capacity and local businesses. Forecasts should state their assumptions instead of appearing certain. If both sides agree in advance on measures such as rent levels, traffic, and shop survival, later evidence can change the decision. It may not settle how much risk each person accepts, but it can prevent factual predictions from being treated as personal values.',
	],
	[
		305,
		'The distinction also changes how a system should be tested. A synchronization test checks whether a new change reaches every device. A recovery test deliberately starts from a damaged or deleted state and checks whether an earlier copy can be restored. Passing the first test says little about the second. Teams sometimes discover this only after an incident, when a backup exists but nobody has practised using it or confirmed what information it actually contains.',
	],
	[
		310,
		'The centre could compare stress changes for residents with similar starting levels and invite some neighbourhood groups to join a structured walking programme for a limited period. It should also track attendance, other exercise, weather, and whether any effect continues after the programme ends. Even then, one local trial would not prove that every walking group improves wellbeing. It could support a narrower claim about this programme, these residents, and the conditions under which change occurred.',
	],
	[
		315,
		'Consider a team that repeatedly misses handover details. Reminding one person may repair the latest omission, but a shared template could reduce future memory failures, and a clear owner could ensure that the template is used. The deeper response costs more time and may be unnecessary after one mistake. Repetition changes the evidence: it suggests that the organisation should stop treating each failure as an isolated event and examine the process connecting them.',
	],
	[
		320,
		'The team could first identify how the feature supports those customers and which alternatives they already use. A replacement should be tested with the affected group, not only with the majority who rarely notice the feature. If the new path provides equal access, a gradual removal may be reasonable. If it introduces extra steps or depends on equipment some users lack, low usage is not evidence that the need is unimportant.',
	],
	[
		325,
		'A careful trial would define reduced hours, protect pay, and compare roles rather than announcing one model for the entire organisation. It should measure stress, service coverage, staff retention, and output over enough time for teams to adjust. If performance improves only because people complete five days of work in four longer days, the policy has changed the schedule without delivering its main benefit. That result would support redesign rather than a simple success label.',
	],
	[
		330,
		'A limited pilot might test improved lighting and staff presence first, with clear incident measures and a public review date. If those changes reduce harm, cameras may be unnecessary. If serious problems continue, the groups would still need to decide where cameras could be proportionate, who may access recordings, and when data must be deleted. The process does not guarantee agreement, but it turns general fears into questions that evidence and safeguards can address.',
	],
	[
		335,
		'To strengthen the review, the writer could attend several full events and compare entry, exit, accessibility, and staff response from different seating areas. One crowded evening may be unusual, while repeated problems would reveal a building or management pattern. The conditional recommendation is useful because it connects confidence to a situation: the artistic experience has positive evidence, but crowd handling does not. A reader can value the venue without assuming that every event will work equally well.',
	],
	[
		340,
		'A follow-up report should give a decision date or explain what information the first-quarter review will use. Without that detail, “wait and see” may become an indefinite delay. The training team could prepare a smaller option or identify costs that can be postponed. This response respects the implied budget concern while keeping the proposal available. It also avoids claiming that the chair promised reconsideration when the original words only left that possibility open.',
	],
	[
		345,
		'The next phase could compare groups receiving different levels of onboarding and record why participants leave. If stronger support consistently improves completion, the programme may work but require more resources than expected. If later participants still leave after receiving equal support, the original explanation becomes weaker. Reporting both possibilities helps decision-makers distinguish a promising result from evidence that the same result can be maintained at a larger scale.',
	],
	[
		350,
		'Weekend data may reveal a different pattern because visits are less predictable and more families arrive together. The centre could reserve a core group of bookable places, protect several walk-in spaces, and adjust the ratio after a four-week review. Staff should record unused reservations, refused entry, waiting time, and accessibility problems. A mixed system is only balanced if those measures show that flexibility is real, not merely promised in the policy description.',
	],
	[
		355,
		'The reply should not decide the traveller’s legal position or promise a refund that staff cannot authorise. It can explain the available review process and give a clear time for the next response. Internally, the guesthouse should test whether people notice optional costs before payment and whether the redesigned page changes questions or complaints. A polite email repairs one relationship; evidence from future bookings shows whether the underlying communication problem was repaired.',
	],
	[
		360,
		'One possible policy is to begin with team-defined remote ranges rather than a universal rule. New employees might receive scheduled in-person support, while established teams could choose fewer shared days when outcomes remain strong. The organisation should monitor decision time, mentoring access, staff costs, and inclusion across home situations. If those measures worsen, it should adjust the arrangement rather than defending remote work as an identity or returning everyone to the office without examining the cause.',
	],
	[
		365,
		'A responsible estimate should therefore preserve an uneven profile. A learner may discuss familiar issues confidently but miss an implied contrast in a report, or write a well-organised opinion while struggling to follow connected speech. The label is useful only when the evidence and limits remain visible. Continued study should target the weaker mode instead of repeating the strongest task simply to obtain a higher average or treating a pass as proof that every CEFR activity has been demonstrated.',
	],
]);

const ENRICHED_LABS = LABS.map((lab) => {
	const followUp = FOLLOW_UP_PARAGRAPHS.get(lab.day);
	if (!followUp) throw new Error(`Missing B2 Challenge reading continuation for Day ${lab.day}.`);
	return { ...lab, sourceText: `${lab.sourceText}\n\n${followUp}` } satisfies IntegratedLabSeed;
});

export const B2_CHALLENGE_PRACTICE_LABS: ReadonlyMap<number, IntegratedLabSeed> = new Map(
	ENRICHED_LABS.map((lab) => [lab.day, lab]),
);
