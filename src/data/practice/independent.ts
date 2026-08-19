import type { IntegratedLabSeed } from './shared';

const LABS = [
	{
		day: 96,
		title: 'Reading & Writing Lab · What made the project work?',
		sourceText:
			'Last month, Kenta joined a weekend coding workshop. At first, his team could not agree on a simple idea, and they spent too long discussing details. Kenta suggested building a small version first. Once everyone could see it working, they divided the remaining jobs and finished on time. He learned that an early, imperfect result can make teamwork easier.',
		comprehension: 'Why did Kenta’s suggestion help the team succeed?',
		writing:
			'Describe a small success or learning experience. Explain the difficulty, action, and result.',
		guidance: '出来事を順序立て、成功・学びにつながった理由を明示します。',
		output: { format: 'paragraph', minimumWords: 55, maximumWords: 105 },
	},
	{
		day: 102,
		title: 'Reading & Writing Lab · Before and after the photograph',
		sourceText:
			'The photograph shows three friends beside a wet tent. They are smiling, although the ground is covered with water. The night before, strong rain had entered the campsite, so they moved their bags into a small shelter. In the morning, a neighbour lent them a dry blanket and helped them repair the tent. The photo matters because it reminds them of the help they received, not just the bad weather.',
		comprehension: 'What can you infer about why the friends are smiling?',
		writing:
			'Choose a real or imaginary photograph and explain what happened before, during, and after it.',
		guidance: '時制とsequence markersを使い、写真に見えない背景も補います。',
		output: { format: 'paragraph', minimumWords: 60, maximumWords: 115 },
	},
	{
		day: 108,
		title: 'Reading & Writing Lab · A reason behind a preference',
		sourceText:
			'A community class offered both online and in-person lessons. Most participants chose online lessons because they could join after work without travelling. However, several beginners preferred the classroom. They said it was easier to ask quick questions and notice how other learners were practising. The organiser kept both options because convenience and direct support mattered to different people.',
		comprehension: 'Why did the organiser keep both lesson formats?',
		writing:
			'State which format you would choose. Support your view with two different reasons and one relevant example.',
		guidance: 'becauseを繰り返すだけでなく、another reason / for exampleで構成します。',
		output: { format: 'opinion', minimumWords: 65, maximumWords: 120 },
	},
	{
		day: 114,
		title: 'Reading & Writing Lab · Finding the right device',
		sourceText:
			'Mina needs a laptop that she can carry to university every day. A powerful gaming model is fast, but it is heavy and its battery lasts only four hours. A lighter model has a smaller screen and less storage, yet it works for ten hours and costs less. Mina edits documents and joins video classes, but she does not play games. The salesperson recommends the lighter model.',
		comprehension: 'Which requirements make the lighter laptop more suitable for Mina?',
		writing:
			'Describe a product or service that would suit a specific person. Include at least one relative clause.',
		guidance: 'who / that / whichで条件を明確にし、比較の根拠を示します。',
		output: { format: 'paragraph', minimumWords: 68, maximumWords: 125 },
	},
	{
		day: 120,
		title: 'Reading & Writing Lab · A choice with trade-offs',
		sourceText:
			'The town can spend its small transport budget on more evening buses or on safer bicycle lanes. Evening buses would help older residents and workers who finish late. Bicycle lanes would serve more people during the day and might reduce traffic, but construction would take several months. A survey shows support for both ideas, so the council must decide which need is more urgent now.',
		comprehension: 'What competing needs must the council balance?',
		writing:
			'Recommend one option for the town. Give a reason, acknowledge one drawback, and answer a possible objection.',
		guidance: '主張→理由→弱点→短い応答の順で、簡潔にまとめます。',
		output: { format: 'opinion', minimumWords: 72, maximumWords: 135 },
	},
	{
		day: 126,
		title: 'Reading & Writing Lab · A realistic condition',
		sourceText:
			'A local sports club wants to hold an outdoor event on Sunday. If the weather stays dry, the club will use the school field and invite families to watch. If heavy rain is expected, it will move the event to a smaller gym. The gym cannot hold every visitor, so the club will confirm the location by Friday and ask people to register in advance.',
		comprehension: 'Why must the club make a decision by Friday?',
		writing:
			'Explain a real plan with two possible conditions and the action you will take in each case.',
		guidance: '実現可能な条件にfirst conditionalを使い、結果を具体化します。',
		output: { format: 'paragraph', minimumWords: 72, maximumWords: 138 },
	},
	{
		day: 132,
		title: 'Reading & Writing Lab · Confirmed or only possible?',
		sourceText:
			'The office may move to a new building in October, but the final contract has not been signed. The manager has confirmed that staff can continue working from home two days a week. The company might also provide new monitors, although the budget is still under review. A short update will be sent once the move is certain.',
		comprehension: 'Which information is confirmed, and which details remain uncertain?',
		writing:
			'Write a short update that clearly separates one confirmed fact from two possibilities.',
		guidance: 'will / may / mightと、certaintyを示す語を使い分けます。',
		output: { format: 'message', minimumWords: 75, maximumWords: 140 },
	},
	{
		day: 138,
		title: 'Reading & Writing Lab · The turning point',
		sourceText:
			'Luis was preparing an important online presentation when his screen suddenly went dark. He first thought the laptop battery had failed, but the room lights were also off. While he was checking the power, a colleague called and offered a nearby meeting room. Luis moved there, opened a cloud copy of his slides, and started only five minutes late. The interruption was stressful, yet his backup plan prevented a cancellation.',
		comprehension: 'What was the turning point that allowed Luis to continue?',
		writing: 'Tell a short story with background, an interruption, a decision, and an outcome.',
		guidance: 'past continuousとsimple pastを使い、主要事件を明確にします。',
		output: { format: 'paragraph', minimumWords: 78, maximumWords: 145 },
	},
	{
		day: 144,
		title: 'Reading & Writing Lab · Reporting a question accurately',
		sourceText:
			'During a neighbourhood meeting, residents asked whether a noisy delivery service could change its early-morning schedule. They also asked what the company was doing to reduce engine noise. The company representative said that drivers had been given new instructions and that a later route was being tested. She promised to report the results the following month.',
		comprehension: 'What did residents want to know, and what action did the company report?',
		writing: 'Report two questions from an imaginary meeting and the response that was given.',
		guidance: 'asked whether / asked what と reported statementsを区別します。',
		output: { format: 'summary', minimumWords: 80, maximumWords: 150 },
	},
	{
		day: 150,
		title: 'Reading & Writing Lab · Retelling the essential story',
		sourceText:
			'On her first day at a new job, Sara took the wrong train and arrived at an unfamiliar station. Her phone battery was almost empty, so she wrote down the office number before opening a map. A station worker showed her a faster route, and Sara called her manager to explain the delay. She reached the office twenty minutes late. Instead of hiding the mistake, she briefly explained what had happened and described how she would check the route the night before in future.',
		comprehension:
			'Which three details are essential to understanding the problem, response, and result?',
		writing:
			'Retell Sara’s story in fewer words, then add one sentence about the lesson she learned.',
		guidance: '細部を全部写さず、problem → response → resultを保ちます。',
		output: { format: 'summary', minimumWords: 82, maximumWords: 145 },
	},
	{
		day: 156,
		title: 'Reading & Writing Lab · Discussing possible effects',
		sourceText:
			'A company is considering one meeting-free afternoon each week. Supporters say it could help staff complete focused work and may reduce unnecessary messages. Others worry that customers might wait longer for answers or that urgent decisions could be delayed. The company plans a one-month trial before making a permanent change. It will compare response times, completed work, and staff feedback.',
		comprehension: 'Why is a trial useful before the company makes a final decision?',
		writing:
			'Predict two possible benefits and one possible problem of a change at work, school, or home.',
		guidance: 'may / might / couldで断定を避け、根拠も一つ添えます。',
		output: { format: 'opinion', minimumWords: 82, maximumWords: 150 },
	},
	{
		day: 162,
		title: 'Reading & Writing Lab · Revising an opinion',
		sourceText:
			'Haruto originally opposed a shared tool library because he thought people would return equipment late or damaged. At a public meeting, a neighbour explained that members would book tools online, pay a small deposit, and attend a safety lesson. Haruto still believed careful management was necessary, but he changed his view and supported a six-month trial. The practical safeguards answered his main concern.',
		comprehension: 'Which information changed Haruto’s opinion, and which concern remained?',
		writing: 'Describe an opinion you changed or qualified after hearing new information.',
		guidance: '以前の考え、新情報、現在の考えを対比して書きます。',
		output: { format: 'opinion', minimumWords: 85, maximumWords: 155 },
	},
	{
		day: 168,
		title: 'Reading & Writing Lab · Negotiating a change',
		sourceText:
			'Two roommates have different work schedules. Naomi has started early video meetings and needs the kitchen table from seven to nine. Alex usually eats breakfast there and feels that the change was announced too suddenly. Naomi explains that the meetings will last for only three weeks. They agree that Naomi will use headphones and clear the table by nine, while Alex will prepare breakfast the night before and use the smaller desk if needed.',
		comprehension: 'How does the final agreement address both roommates’ needs?',
		writing:
			'Propose a change, acknowledge its impact on another person, and offer a workable compromise.',
		guidance: '要求だけでなく、理由・影響・期限・妥協案を含めます。',
		output: { format: 'message', minimumWords: 88, maximumWords: 160 },
	},
	{
		day: 174,
		title: 'Reading & Writing Lab · Repair without blame',
		sourceText:
			'In a project chat, Mei wrote that the design was “quite simple.” Dan understood this as criticism of his work, but Mei meant that the new version would be easy for customers to use. When Dan asked what she meant, Mei did not repeat the same words. She explained the intended user experience and gave an example of a customer completing the task in two steps. Dan then paraphrased her point to confirm that he had understood it.',
		comprehension: 'Why was Mei’s example more useful than simply repeating her first sentence?',
		writing:
			'Write a short repair exchange that includes clarification, a simpler explanation, an example, and confirmation.',
		guidance: '誤解した人を責めず、意味を別の言葉と具体例で再構成します。',
		output: { format: 'connected-sentences', minimumWords: 90, maximumWords: 165 },
	},
	{
		day: 180,
		title: 'Reading & Writing Lab · Independent Stage reflection',
		sourceText:
			'Over the last stage, Aki has moved from short personal answers to longer explanations. She can compare options, report past events, give advice, discuss possible results, and repair many misunderstandings. In a recent conversation, she explained a travel problem, answered follow-up questions, and summarized her partner’s suggestion. She sometimes loses accuracy when she speaks quickly, and unfamiliar wording can still slow her down. Her next goal is to organise longer answers without losing the listener.',
		comprehension:
			'Which evidence shows progress, and which two needs should guide Aki’s next stage?',
		writing:
			'Write a structured reflection with evidence of progress, one continuing difficulty, and two practical next steps.',
		guidance: '抽象的な感想だけでなく、できたtaskと今後の行動を具体化します。',
		output: { format: 'paragraph', minimumWords: 95, maximumWords: 175 },
	},
] as const satisfies readonly IntegratedLabSeed[];

export const INDEPENDENT_PRACTICE_LABS: ReadonlyMap<number, IntegratedLabSeed> = new Map(
	LABS.map((lab) => [lab.day, lab]),
);
