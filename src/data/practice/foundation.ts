import type { IntegratedLabSeed } from './shared';

const LABS = [
	{
		day: 6,
		title: 'Reading & Writing Lab · A short classroom request',
		sourceText:
			'Mika has a new English book. She cannot hear the teacher. She says, “Sorry, please say that again.”',
		comprehension: 'What does Mika ask the teacher to do?',
		writing: 'Write one polite sentence you can use when you cannot hear someone.',
		guidance: 'I / please を使い、実際に言える一文にします。',
		output: { format: 'sentence', minimumWords: 4, maximumWords: 14 },
	},
	{
		day: 12,
		title: 'Reading & Writing Lab · A room note',
		sourceText:
			'My room is small but bright. There is a desk by the window. Two books are on the desk, and my bag is under the chair.',
		comprehension: 'Where are the books and the bag?',
		writing: 'Describe two things in your room in two short sentences.',
		guidance: 'there is / are と位置の語を使います。',
		output: { format: 'connected-sentences', minimumWords: 8, maximumWords: 28 },
	},
	{
		day: 18,
		title: 'Reading & Writing Lab · Choosing lunch',
		sourceText:
			'Ken does not eat meat. The soup has chicken, but the vegetable curry has no meat. The server recommends the curry with rice.',
		comprehension: 'Which dish is suitable for Ken, and why?',
		writing: 'Write a polite question about an ingredient in a dish.',
		guidance: 'which / what または Does it have ...? を使えます。',
		output: { format: 'sentence', minimumWords: 4, maximumWords: 16 },
	},
	{
		day: 24,
		title: 'Reading & Writing Lab · Following directions',
		sourceText:
			'Go straight for one block and turn left at the bank. The library is next to the park. It is across from a small café.',
		comprehension: 'What should you do at the bank, and where is the library?',
		writing: 'Give two steps from your home or station to a familiar place.',
		guidance: '命令文を順番に並べ、場所の語を一つ入れます。',
		output: { format: 'connected-sentences', minimumWords: 8, maximumWords: 24 },
	},
	{
		day: 30,
		title: 'Reading & Writing Lab · A shopping message',
		sourceText:
			'Aya needs a jacket for a trip. The blue jacket is warm, but it is too large. The black jacket is her size and costs less, so she tries it on.',
		comprehension: 'Why does Aya try on the black jacket?',
		writing: 'Write two sentences about the color and size you want when shopping.',
		guidance: '形容詞の語順と because / so のどちらかを使います。',
		output: { format: 'connected-sentences', minimumWords: 10, maximumWords: 30 },
	},
	{
		day: 36,
		title: 'Reading & Writing Lab · Yesterday in order',
		sourceText:
			'Yesterday, Leo finished work at six. First, he bought food. Then he cooked pasta at home. After dinner, he called his sister and watched a short film.',
		comprehension: 'What did Leo do before he called his sister?',
		writing: 'Write three connected sentences about yesterday in time order.',
		guidance: 'First / Then / After that のうち二つを使います。',
		output: { format: 'connected-sentences', minimumWords: 18, maximumWords: 45 },
	},
	{
		day: 42,
		title: 'Reading & Writing Lab · A changed weekend plan',
		sourceText:
			'Nora planned to play tennis on Saturday, but it rained all morning. She met a friend at a museum instead. They saw old photographs and talked about their town over coffee.',
		comprehension: 'How did Nora’s plan change, and what did she do?',
		writing: 'Tell a short weekend story with one planned event and one unexpected change.',
		guidance: '過去形を使い、but / instead で変化を示します。',
		output: { format: 'connected-sentences', minimumWords: 24, maximumWords: 60 },
	},
	{
		day: 48,
		title: 'Reading & Writing Lab · Comparing two plans',
		sourceText:
			'Our group can meet at the station café or in the community room. The café is convenient, but it is noisy. The community room is quieter and has a large table, although it closes at eight.',
		comprehension: 'What is one advantage and one disadvantage of the community room?',
		writing: 'Choose one place and explain your choice in two or three sentences.',
		guidance: '比較表現と because / but を組み合わせます。',
		output: { format: 'connected-sentences', minimumWords: 18, maximumWords: 50 },
	},
	{
		day: 54,
		title: 'Reading & Writing Lab · Giving essential information',
		sourceText:
			'A cyclist fell near the north entrance of Green Park. He is awake, but his arm hurts and he cannot stand. Emi calls for help and stays with him. She gives the location and describes his condition clearly.',
		comprehension: 'Which details should Emi give first when she asks for help?',
		writing: 'Write a short, clear message asking for help in a safe imaginary situation.',
		guidance: '場所・状態・必要な助けを分けて書きます。実在の緊急連絡には使いません。',
		output: { format: 'message', minimumWords: 18, maximumWords: 45 },
	},
	{
		day: 60,
		title: 'Reading & Writing Lab · Choosing an attraction',
		sourceText:
			'The river walk is the most popular place in town at sunset. It is free and easy to reach. The history museum is quieter and has useful English signs, but it closes earlier. Omar has only two hours and wants to take photos outside.',
		comprehension: 'Which place is probably better for Omar? Give two details from the text.',
		writing: 'Recommend a place in your area and explain who would enjoy it.',
		guidance: '最上級または比較級と、具体的な理由を一つ使います。',
		output: { format: 'connected-sentences', minimumWords: 24, maximumWords: 60 },
	},
	{
		day: 66,
		title: 'Reading & Writing Lab · Different music habits',
		sourceText:
			'Mai listens to quiet music while she studies because lyrics distract her. Her brother prefers energetic songs when he works. They both enjoy live music, but Mai chooses small venues and her brother likes large festivals.',
		comprehension:
			'What do Mai and her brother have in common, and how are their habits different?',
		writing: 'Compare your preference with another person’s preference in three sentences.',
		guidance: 'both / different / 比較級から二つ以上を使います。',
		output: { format: 'connected-sentences', minimumWords: 24, maximumWords: 65 },
	},
	{
		day: 72,
		title: 'Reading & Writing Lab · Partial agreement',
		sourceText:
			'The neighborhood group wants to close the small park at night. Yuki agrees that noise is a problem. However, she thinks an earlier closing time would affect people who exercise after work. She suggests better lighting and a quiet-hours sign first.',
		comprehension: 'Which part does Yuki agree with, and what alternative does she suggest?',
		writing: 'Respond to Yuki with agreement, partial agreement, or respectful disagreement.',
		guidance: '相手のpointを一度受けてから、自分の理由を加えます。',
		output: { format: 'opinion', minimumWords: 28, maximumWords: 70 },
	},
	{
		day: 78,
		title: 'Reading & Writing Lab · Starting a conversation',
		sourceText:
			'At a local sports event, Sora notices that another visitor is wearing a team cap. Instead of asking a very personal question, she comments on the close game and asks whether the visitor often comes to matches. The question leads to a friendly conversation.',
		comprehension: 'Why is Sora’s opening suitable for the situation?',
		writing: 'Write a natural opening comment and follow-up question for a public place.',
		guidance: '状況に見える情報から始め、答えやすい質問へつなげます。',
		output: { format: 'connected-sentences', minimumWords: 16, maximumWords: 45 },
	},
	{
		day: 84,
		title: 'Reading & Writing Lab · Repairing a misunderstanding',
		sourceText:
			'Ben says he will “drop by” after lunch. Hana thinks he means that he will bring something, so she asks for clarification. Ben explains that “drop by” means visit for a short time. Hana confirms the time, and the conversation continues without blame.',
		comprehension: 'What caused the misunderstanding, and how did Hana repair it?',
		writing:
			'Write a three-part repair: identify confusion, ask for clarification, and confirm the meaning.',
		guidance: 'Sorry, do you mean ...? / So you mean ...? などを自然に使えます。',
		output: { format: 'connected-sentences', minimumWords: 24, maximumWords: 65 },
	},
	{
		day: 90,
		title: 'Reading & Writing Lab · A 90-day reflection',
		sourceText:
			'When Rina started learning English, she could introduce herself but often stopped after one answer. During the next three months, she practised short questions, past stories, comparisons, and repair phrases. She still needs time to find words, but now she can keep a familiar conversation moving by asking follow-up questions and explaining an unknown word in another way.',
		comprehension: 'What changed in Rina’s communication, and what difficulty remains?',
		writing:
			'Write a short reflection on one improvement and one next goal in your English learning.',
		guidance: '過去と現在を対比し、具体例と次の行動を一つずつ入れます。',
		output: { format: 'paragraph', minimumWords: 45, maximumWords: 100 },
	},
] as const satisfies readonly IntegratedLabSeed[];

export const FOUNDATION_PRACTICE_LABS: ReadonlyMap<number, IntegratedLabSeed> = new Map(
	LABS.map((lab) => [lab.day, lab]),
);
