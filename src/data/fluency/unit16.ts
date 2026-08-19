import { buildFluencyUnit, type FluencyLessonSeed } from './shared';

const seeds = [
	{
		day: 256,
		theme: '経験を選び、詳細を組み立てる',
		objective: '長い経験談を背景、転機、結果、学びの順で伝える',
		grammar: [
			'extended narrative structure',
			'background / turning point / outcome / reflectionを統合する',
			'出来事をすべて列挙せず、中心となる変化を選び、異なる時制で前後関係を示します。',
			'I had been learning alone until a colleague invited me to a weekly group.',
			'That experience changed how I practise because I began asking for feedback.',
			'学び方が変わった経験を四段階で話す。',
			'I used to study only from books, but after I joined a speaking group, I started reviewing the phrases I had needed in conversation.',
		],
		vocabulary: 'turning point|転機;reflection|振り返り;shape|形作る;outcome|結果',
		phrases: 'The turning point came when...|転機は…の時でした。;Looking back,...|振り返ると…。',
		voiceTask:
			'学習、仕事、趣味の転機から一つ選び4分話し、相手のfollow-up三回へ新しいdetailで答える。',
		skillTargets: ['speaking', 'interaction', 'fluency', 'grammar'],
	},
	{
		day: 257,
		theme: '要約から意見へ発展させる',
		objective: '聞いた要点と自分の評価を混ぜずに順序立てて述べる',
		grammar: [
			'summary-to-opinion bridge',
			'the main point is / based on that / my view isを使う',
			'まず話者の内容を中立に要約し、その後で根拠を示して自分の意見へ移ります。',
			'The main point is that flexible hours reduced delays.',
			'Based on that result, my view is that the trial should continue.',
			'地域イベントの提案を要約して意見を加える。',
			'The proposal is to hold smaller events throughout the year. Based on that, I think it could reach more people.',
		],
		vocabulary: 'neutral|中立的な;evaluation|評価;distinguish|区別する;respond|応答する',
		phrases: 'The main point is that...|要点は…。;Based on that,...|それを踏まえると…。',
		voiceTask: '90秒の説明を聞き、二文で要約してから一分の意見と具体例を述べる課題を三回行う。',
		skillTargets: ['listening', 'speaking', 'fluency', 'interaction'],
	},
	{
		day: 258,
		theme: '自然速度の問題説明に対応する',
		objective: '要点と制約を聞き分け、確認後に現実的な解決案を出す',
		grammar: [
			'rapid problem-solving exchange',
			'given that / unless / the most practical optionを使う',
			'すぐ提案せず、問題、制約、優先事項を一度言い換えてから案を比較します。',
			'Given that the budget is fixed, the most practical option is to shorten the event.',
			'Unless the supplier confirms today, we should prepare a local alternative.',
			'時間と人員が限られた問題への案を示す。',
			'Given that only two people are available, we should reduce the first version and test the key feature.',
		],
		vocabulary: 'constraint|制約;practical|現実的な;priority|優先事項;contingency|代替策',
		phrases: 'Given that...|…を考えると…。;The most practical option is...|最も現実的な案は…。',
		voiceTask:
			'near-natural speedの運営トラブルを聞き、確認質問、二案比較、条件付き提案を8分で行う。',
		skillTargets: ['listening', 'interaction', 'speaking', 'grammar', 'fluency'],
	},
	{
		day: 259,
		theme: '複数の視点を比較して判断する',
		objective: '二人の優先事項を公平に要約し、自分の判断基準を示す',
		grammar: [
			'perspective comparison',
			'whereas / from X perspective / what both views shareを使う',
			'単なる賛否ではなく、各立場が何を重視しているかと共通点を説明します。',
			'From the manager’s perspective, speed matters, whereas the users value clarity.',
			'What both views share is a concern about a difficult transition.',
			'観光客と住民の交通案を比較する。',
			'Visitors may value frequent service, whereas residents may care more about routes to schools and clinics.',
		],
		vocabulary: 'stakeholder|関係者;perspective|視点;shared concern|共通の懸念;criterion|判断基準',
		phrases:
			'From their perspective,...|その立場からは…。;What both views share is...|両方に共通するのは…。',
		voiceTask:
			'同じ地域計画について二人の短い発言を聞き、視点を比較し、基準二つで自分の判断を説明する。',
		skillTargets: ['listening', 'speaking', 'vocabulary', 'fluency'],
	},
	{
		day: 260,
		theme: '時制を切り替えて変化を語る',
		objective: '過去の背景、出来事、現在の結果、将来の予定を混同せず話す',
		grammar: [
			'mixed-tense narrative control',
			'past simple / past continuous / present perfect / futureを統合する',
			'時間を示す語と結果の関係を使い、時制変更の理由が聞き手に分かるようにします。',
			'While we were testing the route, a bridge closed, so we changed the plan.',
			'Since then, we have used a backup route, and next month we will test another option.',
			'趣味のイベント計画が変わった経緯を四つの時間軸で話す。',
			'We were preparing an outdoor event when the forecast changed; since then, we have booked an indoor space, and we are meeting there next week.',
		],
		vocabulary: 'timeline|時間の流れ;ongoing|進行中の;since then|それ以来;upcoming|今後の',
		phrases: 'At that point,...|その時点で…。;Since then,...|それ以来…。',
		voiceTask: '最近変化した計画を3分で語り、相手に時点を二回確認してもらい、表現を修復する。',
		skillTargets: ['speaking', 'grammar', 'interaction', 'fluency'],
	},
	{
		day: 261,
		theme: '意図を推測して適切に応じる',
		objective: '言葉だけでなく理由、tone、状況から話者の目的を推測する',
		grammar: [
			'intention inference',
			'seems to be / may be suggesting / probably wantsを使う',
			'推測を事実として断定せず、根拠を一つ述べ、確認できる応答を選びます。',
			'She may be suggesting a delay because she mentioned two unresolved risks.',
			'He seems to want reassurance rather than another technical explanation.',
			'遠回しな依頼の意図を推測する。',
			'He may be asking for help, since he has mentioned the deadline twice without proposing a solution.',
		],
		vocabulary: 'intention|意図;imply|ほのめかす;tone|口調;reassurance|安心させること',
		phrases:
			'It sounds as though...|…のように聞こえます。;Are you suggesting that...?|…という提案ですか？',
		voiceTask:
			'toneの異なる短い発言5つを聞き、意図を根拠付きで推測し、確認または支援の返答を選ぶ。',
		skillTargets: ['listening', 'interaction', 'speaking'],
	},
	{
		day: 262,
		theme: '複雑な手順を簡単な英語で説明する',
		objective: '専門語を避け、目的、主要手順、注意点を聞き手に合わせて伝える',
		grammar: [
			'audience-friendly explanation',
			'in simple terms / the purpose is / the key thing to rememberを使う',
			'すべてのdetailではなく、初めての人が行動するために必要な順序を選びます。',
			'In simple terms, the app keeps a copy on your device and sends changes when you are online.',
			'The key thing to remember is not to close the page during the import.',
			'オンライン予約の仕組みを初めての人へ説明する。',
			'The purpose is to reserve a time before you arrive. First choose a service, then select an open time and confirm your details.',
		],
		vocabulary:
			'plain language|平易な言葉;essential|不可欠な;step-by-step|順を追った;audience|聞き手',
		phrases:
			'In simple terms,...|簡単に言うと…。;The key thing to remember is...|覚えておく要点は…。',
		voiceTask:
			'software機能、料理手順、公共サービスから一つ選び、初心者向けに3分説明しclarificationへ答える。',
		skillTargets: ['speaking', 'interaction', 'vocabulary', 'fluency'],
	},
	{
		day: 263,
		theme: '即興で言い換えを選ぶ',
		objective: '使えない語を避けてcategory、function、contrastから説明を続ける',
		grammar: [
			'spontaneous paraphrase strategies',
			'what it does / what it is like / what it is notを組み合わせる',
			'一つの説明で伝わらなければ、同義語の反復ではなく説明方法を切り替えます。',
			'It is a place where people borrow equipment; it is like a library, but for tools.',
			'It does not repair the file; it returns it to an earlier version.',
			'「乗り換え」「返金」「通知」を対象語なしで説明する。',
			'It is when you leave one train and take another one to continue the same journey.',
		],
		vocabulary: 'strategy|方法;contrast|対比;approximate|おおよそ表す;convey|伝える',
		phrases:
			'It is similar to..., except...|…に似ていますが…が違います。;Another way to explain it is...|別の説明をすると…。',
		voiceTask:
			'ランダムな日常語8語を説明し、伝わらない合図が出たらcategory→function→exampleの順を変えて再説明する。',
		skillTargets: ['speaking', 'interaction', 'vocabulary', 'fluency'],
	},
	{
		day: 264,
		theme: '条件を調整して合意を作る',
		objective: '異なる優先事項を確認し、条件付きの妥協案を交渉する',
		grammar: [
			'negotiating a decision',
			'would you be willing to / provided that / if we agreed toを使う',
			'最初の案を押し通さず、譲れる条件と守る必要がある条件を区別します。',
			'Would you be willing to start earlier if we finished before lunch?',
			'I could support the trial, provided that we review it after two weeks.',
			'イベントの費用と時間を調整する提案を作る。',
			'If we reduced the venue cost, would you agree to keep the full programme?',
		],
		vocabulary: 'negotiate|交渉する;compromise|妥協案;non-negotiable|譲れない;trade-off|交換条件',
		phrases:
			'Would you be willing to...?|…してもらえますか？;I could agree, provided that...|…という条件なら賛成できます。',
		voiceTask:
			'旅行または地域イベントの予算・時間・質について10分交渉し、条件付き合意と未解決点を要約する。',
		skillTargets: ['listening', 'interaction', 'speaking', 'grammar', 'fluency'],
	},
	{
		day: 265,
		theme: 'B1+ Integration Rehearsal',
		objective: '要約、意見、例、別視点、repairを12～15分の会話で統合する',
		grammar: [
			'integrated extended interaction',
			'narrative / conditionals / hedging / discourse markersを統合する',
			'正確さだけでなく、相手の発言に応じて説明の長さや言い方を調整します。',
			'From what I understood, the main concern is access; my experience suggests a small trial could help.',
			'I might support the plan if the results were reviewed with local users.',
			'情報を要約し、立場、根拠、例、条件、別視点を会話で展開する。',
			'The proposal could improve access, although cost remains a concern; I would begin with a limited trial and review the evidence.',
		],
		vocabulary: 'integrate|統合する;adapt|適応させる;sustain|維持する;coherent|一貫した',
		phrases:
			'Building on that point,...|その点を発展させると…。;Before we move on, let me summarize...|次へ進む前に要約します。',
		voiceTask:
			'technology、work、地域から一題選び12～15分会話する。短いinputを要約し、意見、例、alternative perspective、follow-up、paraphrase、repairを含める。',
		skillTargets: ['listening', 'speaking', 'interaction', 'fluency', 'grammar', 'vocabulary'],
	},
	{
		day: 266,
		theme: '予想外の話題転換から回復する',
		objective: '新しい話題との関係を確認し、必要なcontextを得て会話を続ける',
		grammar: [
			'recovering from a topic shift',
			'how does that relate to / before we move to / could you give me some contextを使う',
			'話題変更を拒まず、つながりが不明なら短く確認して共通の焦点を作ります。',
			'Before we move to cost, could you explain how it relates to the schedule?',
			'I had not considered the community side. Could you give me some context?',
			'旅行計画からenvironmentへ移った時の確認をする。',
			'I see the connection to transport, but could you give me some context about the local environmental concern?',
		],
		vocabulary: 'context|背景;shift|転換;reorient|方向を取り直す;connection|関連',
		phrases:
			'Could you give me some context?|背景を少し教えてください。;How does that relate to...?|それは…とどう関係しますか？',
		voiceTask:
			'会話中に相手が三回予想外の話題へ移り、context確認、bridge、関連する応答で流れを回復する。',
		skillTargets: ['listening', 'interaction', 'speaking', 'fluency'],
	},
	{
		day: 267,
		theme: '要点を聞き取り自分の言葉で再構成する',
		objective: 'near-natural speedの説明から主張、理由、例、条件を選び直す',
		grammar: [
			'key-point retelling',
			'according to / the reason given was / one condition isを使う',
			'原文の順番を暗記せず、聞き手が必要とする構造へ情報を再配置します。',
			'According to the speaker, the trial worked because staff received practical support.',
			'One condition is that the service remains optional during the first month.',
			'新しい地域サービスの説明を三文でretellする。',
			'The speaker supports the service because it saves travel time. The example was a weekly clinic, and one condition is that phone support remains available.',
		],
		vocabulary: 'extract|取り出す;reconstruct|再構成する;supporting detail|補足詳細;condition|条件',
		phrases: 'The reason given was...|示された理由は…。;One condition is...|一つの条件は…。',
		voiceTask:
			'2分のnear-natural説明を一度聞き、メモ3点だけで90秒retellし、話者の意図を確認する質問に答える。',
		skillTargets: ['listening', 'speaking', 'fluency', 'grammar'],
	},
	{
		day: 268,
		theme: 'B1+ Mock Conversation',
		objective: '支援を減らした会話で自発的に展開、確認、修復、要約する',
		grammar: [
			'sustained conversation control',
			'既習tense / clauses / modals / connectorsを必要に応じて選ぶ',
			'指定表現をすべて使うのではなく、意味とinteractionを優先して適切な形を選びます。',
			'I had expected the change to be difficult, but the team adapted more quickly than I thought.',
			'If we introduced it elsewhere, we might need clearer guidance for new users.',
			'経験、問題、意見を関連づけ、最後に次の行動をまとめる。',
			'The experience showed that support matters; if we try this again, I would include a short practice period.',
		],
		vocabulary:
			'sustained|持続した;spontaneous|自発的な;coherence|一貫性;monitor|確認しながら進める',
		phrases:
			'Let me connect that to...|それを…に結びつけます。;To bring these points together,...|これらをまとめると…。',
		voiceTask:
			'事前scriptなしで15分会話する。経験説明、短いlistening summary、意見交換、未知語paraphrase、誤解repair、最終合意を含める。',
		skillTargets: ['listening', 'speaking', 'interaction', 'fluency', 'grammar'],
	},
	{
		day: 269,
		theme: 'Fluency Assessment Rehearsal',
		objective: '評価形式を練習し、内容の証拠と改善点を自分で確認する',
		grammar: [
			'evidence-focused reflection',
			'I demonstrated / I repaired / I need to improveを使う',
			'自己評価を印象だけで終えず、実際に言えた例やrepairした箇所を証拠として示します。',
			'I demonstrated summary skills by reducing the explanation to three key points.',
			'I need to improve how quickly I ask for clarification when a detail is unclear.',
			'会話後にできたこと二つと次のtarget一つを述べる。',
			'I demonstrated interaction by asking follow-up questions, and my next target is to paraphrase more quickly.',
		],
		vocabulary: 'evidence|証拠;demonstrate|示す;target|目標;self-assess|自己評価する',
		phrases: 'I demonstrated this by...|…することで示しました。;My next target is...|次の目標は…。',
		voiceTask:
			'assessment形式で12分会話し、extended answer、summary、paraphrase、repair、key-point listeningを行った後、証拠付きで自己評価する。',
		skillTargets: ['listening', 'speaking', 'interaction', 'fluency', 'grammar', 'vocabulary'],
	},
	{
		day: 270,
		theme: 'Fluency Stage Integration',
		objective: 'B1+入口を目標とする能力を12～18分の統合会話で示す',
		grammar: [
			'Fluency Stage integration',
			'narrative / summary / opinion / conditionals / repairを目的に応じて統合する',
			'修了日だけで到達を認定せず、長い発話とinteractionでできたこと・強化点の証拠を集めます。',
			'Looking back, the main change has been my ability to explain an idea when I do not know the exact word.',
			'I can maintain the conversation, although I still need more practice understanding unexpected details.',
			'経験、input要約、問題解決、意見、別視点、repairを一つの会話で行う。',
			'The speaker’s main point was that gradual change reduces risk; based on my experience, I would test the idea and review it after a month.',
		],
		vocabulary: 'achievement|達成;reinforcement|強化;independent|自立した;readiness|準備度',
		phrases:
			'The evidence I can give is...|示せる証拠は…。;A skill I still want to strengthen is...|まだ強化したい能力は…。',
		voiceTask:
			'12～18分の最終会話。経験を詳しく説明し、near-natural inputを要約し、意見・理由・例・alternative perspectiveを展開し、paraphrase、clarification、repair、最終summaryを行う。結果は認定ではなく次の学習の証拠として扱う。',
		skillTargets: ['listening', 'speaking', 'interaction', 'fluency', 'grammar', 'vocabulary'],
	},
] as const satisfies readonly FluencyLessonSeed[];

export const UNIT_16_LESSONS = buildFluencyUnit(256, seeds);
