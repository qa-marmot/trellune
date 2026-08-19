import { buildIndependentUnit, type IndependentLessonSeed } from './shared';

const seeds = [
	{
		day: 166,
		theme: '近況から会話を広げる',
		objective: '最近の経験を起点に、理由・感情・次の予定へ話題を広げる',
		grammar: [
			'tense switching in conversation',
			'現在完了・過去・未来を目的別に切り替える',
			'経験を現在完了で開き、具体的な出来事は過去形、次の行動は未来表現で続けます。',
			'I have started a new class.',
			'I joined last week, and I am going again tomorrow.',
			'最近始めたこと、初回、次回を三文で言う。',
			'I have started running; I joined a group last Sunday, and I am meeting them again next week.',
		],
		vocabulary: 'update|近況;develop|発展する;transition|移行;detail|詳細;continue|続ける',
		phrases:
			'What have you been doing lately?|最近は何をしていますか。;What are you going to do next?|次は何をする予定ですか。',
		voiceTask: '近況の短答からfollow-upを重ね、過去の具体例と今後の予定まで8分会話を広げる。',
		skillTargets: ['speaking', 'interaction', 'fluency'],
	},
	{
		day: 167,
		theme: '旅行の問題を解決する',
		objective: '状況説明、clarification、選択肢比較、解決までを通して行う',
		grammar: [
			'travel problem integration',
			'passive / modals / conditionalを場面で使う',
			'起きた問題を簡潔に報告し、可能な案を比較し、条件別の対応を決めます。',
			'Our train was cancelled.',
			'If the next one is full, we could take a bus.',
			'「予約が変更されていたら受付に確認します」と言う。',
			'If the booking has been changed, I will check with reception.',
		],
		vocabulary:
			'disruption|運行支障;reservation|予約;replacement|代替;compensation|補償;resolve|解決する',
		phrases:
			'Could you explain what happened?|何が起きたか説明していただけますか。;What are my options now?|今どのような選択肢がありますか。',
		voiceTask: '交通トラブルのrole-playを行い、聞き返し、代替案比較、合意、確認を含めて8分話す。',
		skillTargets: ['interaction', 'listening', 'speaking', 'grammar'],
	},
	{
		day: 168,
		theme: '生活上の変更を相談する',
		objective: '変更理由を説明し、相手への影響と妥協案を話す',
		grammar: [
			'explaining change',
			'because / although / wouldで相談を組み立てる',
			'変更の必要性、相手への配慮、代替案の順で丁寧に相談します。',
			'I need to change the schedule because my hours have changed.',
			'Although it is short notice, would Friday work?',
			'「急ですが別の時間を提案したいです」と言う。',
			'I know this is short notice, but I would like to suggest another time.',
		],
		vocabulary: 'adjustment|調整;impact|影響;notice|事前連絡;compromise|妥協;accommodate|対応する',
		phrases:
			'I need to make a change because...|…なので変更が必要です。;Would this alternative work?|この代替案で都合はよいですか。',
		voiceTask: '共有予定の変更を相談し、相手の懸念をparaphraseして双方が受け入れる案を作る。',
		skillTargets: ['interaction', 'speaking', 'listening'],
	},
	{
		day: 169,
		theme: 'サービスの問題を説明する',
		objective: '事実と希望する対応を分け、丁寧に問題解決を依頼する',
		grammar: [
			'polite complaint',
			'passive + requestで責めずに事実を伝える',
			'何が起きたか、既に試したこと、希望する対応を順に述べます。',
			'The wrong item was delivered.',
			'Could you replace it or issue a refund?',
			'「二度請求されました。確認していただけますか」と言う。',
			'I was charged twice. Could you check it, please?',
		],
		vocabulary: 'complaint|苦情;refund|返金;replace|交換する;charge|請求する;receipt|領収書',
		phrases:
			'There seems to be a problem with...|…に問題があるようです。;I would appreciate it if you could...|…していただけると助かります。',
		voiceTask: '誤配送のcustomer service role-playで、証拠・希望・代替対応を確認して解決する。',
		skillTargets: ['speaking', 'interaction', 'pronunciation'],
	},
	{
		day: 170,
		theme: '手順を説明して確認する',
		objective: '複数工程を簡潔に説明し、聞き手の理解を確認する',
		grammar: [
			'process explanation integration',
			'passive / sequence / conditionを組み合わせる',
			'工程を順に示し、条件分岐がある箇所だけifを使い、最後に理解確認をします。',
			'First, the form is checked.',
			'If information is missing, it will be returned.',
			'「承認されたらメールが送られます」と言う。',
			'If it is approved, an email will be sent.',
		],
		vocabulary: 'procedure|手順;step|工程;submit|提出する;approve|承認する;instruction|指示',
		phrases:
			'The next step is to...|次の手順は…。;Does that process make sense?|その手順で分かりますか。',
		voiceTask: 'アプリ登録や申請の手順を五段階で説明し、相手に要点を言い返してもらって修正する。',
		skillTargets: ['speaking', 'listening', 'interaction', 'grammar'],
	},
	{
		day: 171,
		theme: '短いニュースを伝える',
		objective: '聞いた情報をsourceとcertaintyを保って報告する',
		grammar: [
			'reported information + modals',
			'said that / may / according toを統合する',
			'誰が言ったかと、確定情報か可能性かを分け、推測を事実として伝えません。',
			'The report said that the road would reopen.',
			'According to the staff, it may take another hour.',
			'「主催者によると日程は変わるかもしれません」と言う。',
			'According to the organizer, the date may change.',
		],
		vocabulary: 'source|情報源;report|報道;update|最新情報;official|公式の;verify|確認する',
		phrases:
			'According to...|…によると…。;This has not been confirmed yet.|これはまだ確認されていません。',
		voiceTask: '短い更新情報を聞き、確定事項・可能性・未確認事項を区別して第三者へ伝える。',
		skillTargets: ['listening', 'speaking', 'vocabulary'],
	},
	{
		day: 172,
		theme: '経験から助言する',
		objective: '自分の経験を根拠に、押しつけない助言を行う',
		grammar: [
			'experience-based advice',
			'present perfect + could / shouldを組み合わせる',
			'まず自分の経験を一例として示し、相手に選択肢を残す助言へつなげます。',
			'I have had a similar problem.',
			'You could try contacting them directly.',
			'「同じ状況を経験したので、早めに予約した方がよいと思います」と言う。',
			'I have been in the same situation, so I think you should book early.',
		],
		vocabulary: 'similar|似た;approach|方法;effective|効果的な;recommendation|提案;outcome|結果',
		phrases:
			'Something that worked for me was...|私に効果があったのは…。;You could consider...|…を検討してもよいでしょう。',
		voiceTask: '相手の問題を十分に聞いてから、自分の経験、助言、注意点を順に伝える。',
		skillTargets: ['listening', 'interaction', 'speaking'],
	},
	{
		day: 173,
		theme: '比較して提案を決める',
		objective: '三案を優先条件で評価し、共同決定する',
		grammar: [
			'decision-making integration',
			'comparatives / superlatives / conditionalを統合する',
			'優先条件を確定し、各案を同じ軸で比較し、条件つきの最終案を決めます。',
			'Option B is more flexible but less reliable.',
			'If cost is our priority, option A is the best.',
			'「安全を優先するなら三番目が最適です」と言う。',
			'If safety is our priority, the third option is the best.',
		],
		vocabulary:
			'evaluate|評価する;criteria|基準;rank|順位づける;trade-off|得失;joint decision|共同決定',
		phrases:
			'Based on our priorities,...|優先事項に基づくと…。;Can we agree on...?|…で合意できますか。',
		voiceTask: '三つの旅行案を同じ四基準で比較し、相手と交渉して一つに合意する。',
		skillTargets: ['interaction', 'speaking', 'listening', 'fluency'],
	},
	{
		day: 174,
		theme: '誤解を修復する',
		objective: '誤解の箇所を特定し、言い換えと例で正しい意味へ戻す',
		grammar: [
			'conversation repair integration',
			'Not exactly / What I meant was...で訂正する',
			'相手を否定するのでなく、自分の説明不足を補い、短い例で意味を確かめます。',
			'Not exactly. What I meant was next week.',
			'Let me put it another way.',
			'「中止ではなく延期という意味でした」と言う。',
			'I meant that it was postponed, not cancelled.',
		],
		vocabulary:
			'misunderstanding|誤解;correct|訂正する;rephrase|言い換える;intend|意図する;distinction|区別',
		phrases:
			'That is not quite what I meant.|私の意図とは少し違います。;Let me explain it another way.|別の言い方で説明します。',
		voiceTask: '日時・条件・意見の三つの誤解を、訂正、言い換え、理解確認の順で修復する。',
		skillTargets: ['interaction', 'speaking', 'pronunciation'],
	},
	{
		day: 175,
		theme: '要点を短く伝える',
		objective: '長い説明をmain point、理由、next stepへ圧縮する',
		grammar: [
			'concise summary',
			'The main point is / because / nextで構成する',
			'細部を削り、聞き手が行動するために必要な三点だけを残します。',
			'The main point is that the event has moved.',
			'The next step is to confirm your booking.',
			'「要点は遅延で、次に連絡を待ちます」と言う。',
			'The main point is that there is a delay, and the next step is to wait for an update.',
		],
		vocabulary: 'essential|必須の;concise|簡潔な;priority|優先事項;summary|要約;action|行動',
		phrases:
			'The key thing to remember is...|覚えておく要点は…。;In one sentence,...|一文で言うと…。',
		voiceTask: '90秒の説明を聞き、20秒で要点を伝え、抜けた重要情報がないか確認する。',
		skillTargets: ['listening', 'fluency', 'speaking'],
	},
	{
		day: 176,
		theme: '自然速度への対応',
		objective: 'connected speechを完全に聞き取れなくても要点を保持し聞き返す',
		grammar: [
			'selective clarification',
			'key wordを指定して聞き返す',
			'全体を止めず、日時・理由・行動など理解に必要な箇所だけを具体的に確認します。',
			'Did you say the meeting had moved?',
			'Could you repeat the reason for the change?',
			'「最後の対応だけもう一度お願いします」と言う。',
			'Could you repeat just the final action?',
		],
		vocabulary:
			'connected speech|連結した発話;key word|重要語;selective|選択的な;gist|要旨;recover|取り戻す',
		phrases:
			'I caught the main idea, but...|要点は分かりましたが…。;Could you say the key date again?|重要な日付をもう一度お願いします。',
		voiceTask: 'controlled natural speedの説明を聞き、gistを言い返し、必要箇所だけ二度聞き返す。',
		skillTargets: ['listening', 'interaction', 'pronunciation'],
	},
	{
		day: 177,
		theme: '複数時制で経験を語る',
		objective: '過去の経験、現在への影響、将来の行動を一続きに話す',
		grammar: [
			'multi-tense integration',
			'past / present perfect / futureを時間軸で整理する',
			'time markerを明示し、各時制が示す時間を聞き手が追えるようにします。',
			'I made this mistake last year.',
			'I have changed my routine, and I will keep using the new method.',
			'「以前失敗し、それ以来練習し、次回も準備します」と言う。',
			'I failed before, but I have practiced since then, and I will prepare again next time.',
		],
		vocabulary:
			'timeline|時間軸;influence|影響する;since then|それ以来;continue|続ける;future|将来',
		phrases:
			'Since that experience,...|その経験以来…。;In the future, I plan to...|今後は…する予定です。',
		voiceTask: '一つの学びをpast event、current change、future planの三部構成で2分話す。',
		skillTargets: ['grammar', 'speaking', 'fluency'],
	},
	{
		day: 178,
		theme: 'B1 Entry 統合ロールプレイ',
		objective: '問題解決と意見交換を一つの会話で行う',
		grammar: [
			'integrated interaction',
			'question / explanation / comparison / repairを統合する',
			'相手の情報を確認し、選択肢を比較し、誤解を修復して共同のnext stepへ進みます。',
			'Could you clarify the main problem?',
			'Although option A is faster, option B may be safer.',
			'確認と比較を含めて代替案を勧める。',
			'Could you clarify the timing? Although the first option is faster, the second may be more reliable.',
		],
		vocabulary: 'scenario|場面;integrate|統合する;adapt|適応する;negotiate|交渉する;outcome|結果',
		phrases:
			'Let us work through this step by step.|一つずつ解決しましょう。;So our final decision is...|最終決定は…ですね。',
		voiceTask:
			'旅行中の変更と意見の違いを含むrole-playを10分行い、clarificationとparaphraseを自発的に使う。',
		skillTargets: ['speaking', 'listening', 'interaction', 'fluency'],
	},
	{
		day: 179,
		theme: 'Independent Stage リハーサル',
		objective: '経験・比較・物語・意見の四領域を連続して扱う',
		grammar: [
			'independent stage rehearsal',
			'既習文法を意味に応じて自分で選ぶ',
			'文法名を指定されなくても、時間・関係・確度・条件に合う形を選んで会話を維持します。',
			'I have had a similar experience, but mine ended differently.',
			'If I faced that situation again, I would ask more questions.',
			'経験と次回の条件をつなげて話す。',
			'I have learned from that experience, so if it happens again, I will ask for clarification.',
		],
		vocabulary:
			'rehearsal|リハーサル;independent|自立した;combine|組み合わせる;self-correct|自分で直す;strategy|方略',
		phrases:
			'Let me organize my thoughts.|考えを整理させてください。;Could I clarify one point before I answer?|答える前に一点確認してよいですか。',
		voiceTask:
			'四つの短いtaskを通して10分会話し、follow-up、repair、summaryをそれぞれ最低一度使う。',
		skillTargets: ['speaking', 'listening', 'interaction', 'fluency', 'pronunciation'],
	},
	{
		day: 180,
		theme: 'Independent Stage 統合会話',
		objective: '身近な複数話題で8–12分会話し、理由・例・要約・修復を自立して行う',
		grammar: [
			'Independent Stage integration',
			'A2–B1 entryの文法を会話目的に合わせて統合する',
			'正確さだけでなく、分からない時の確認、言い換え、follow-up、要約で会話を最後まで維持します。',
			'I have experienced something similar, although the details were different.',
			'If I had to choose now, I would explain my reasons first.',
			'意見、理由、例、条件を含めて選択を述べる。',
			'In my view, this is the better option because it is reliable, although it may cost more.',
		],
		vocabulary:
			'independence|自立;integration|統合;maintain|維持する;clarify|明確にする;reflect|振り返る',
		phrases:
			'Let me summarize what we discussed.|話した内容を要約します。;I can explain that in another way.|別の言い方で説明できます。',
		voiceTask:
			'経験、問題解決、意見の三話題で8–12分会話し、理由・例・follow-up・clarification・paraphrase・summaryを自発的に使う。',
		skillTargets: [
			'speaking',
			'listening',
			'interaction',
			'fluency',
			'pronunciation',
			'grammar',
			'vocabulary',
		],
	},
] as const satisfies readonly IndependentLessonSeed[];

export const UNIT_10_LESSONS = buildIndependentUnit(166, seeds);
