import { buildIndependentUnit, type IndependentLessonSeed } from './shared';

const seeds = [
	{
		day: 121,
		theme: '予定を具体化する',
		objective: '決定済みの予定とその場の判断を区別して話す',
		grammar: [
			'going to / will',
			'計画とその場の判断を使い分ける',
			'going toは既に考えた計画、willは会話中の判断や申し出に使います。',
			'I am going to visit my aunt this weekend.',
			'I will call her now.',
			'「明日は勉強する予定で、今ノートを準備します」と言う。',
			'I am going to study tomorrow, and I will prepare my notes now.',
		],
		vocabulary: 'arrangement|予定;intention|意図;prepare|準備する;decision|判断;schedule|日程',
		phrases: 'I am planning to...|…する予定です。;I will take care of that.|それは私が対応します。',
		voiceTask: '週末の予定を説明し、相手から出た問題にその場で対応案を二つ申し出る。',
		skillTargets: ['grammar', 'speaking', 'interaction'],
	},
	{
		day: 122,
		theme: '約束された予定',
		objective: '現在進行形を使って確定した近い未来の予定を確認する',
		grammar: [
			'present continuous for arrangements',
			'日時が決まった予定を表す',
			'人や場所と調整済みの予定には現在進行形を使い、日時を添えます。',
			'I am meeting Ken at six.',
			'We are taking the early train tomorrow.',
			'「金曜に歯医者へ行きます」と言う。',
			'I am seeing the dentist on Friday.',
		],
		vocabulary:
			'appointment|予約;arrange|手配する;reschedule|日程変更する;available|空いている;confirm|確定する',
		phrases:
			'Are we still meeting at...?|まだ…時に会う予定ですか。;Could we move it to...?|…へ変更できますか。',
		voiceTask: '三つの予定を確認し、重なりを見つけて一つを丁寧にrescheduleする。',
		skillTargets: ['interaction', 'listening', 'grammar'],
	},
	{
		day: 123,
		theme: '助言を求める',
		objective: '困りごとを説明し、shouldで具体的な助言を受ける',
		grammar: [
			'should / should not',
			'軽い助言と理由を組み合わせる',
			'shouldは相手の選択を残す助言です。命令にせず、理由を添えます。',
			'You should check the details first.',
			'You should not wait until the last minute.',
			'「少し休んだ方がよいです」と言う。',
			'You should take a short break.',
		],
		vocabulary: 'advice|助言;suggestion|提案;issue|問題;consider|検討する;improve|改善する',
		phrases:
			'What do you think I should do?|どうすべきだと思いますか。;You might want to...|…するとよいかもしれません。',
		voiceTask: '日常の困りごとを状況・試したこと・望む結果まで説明し、助言を聞いて応答する。',
		skillTargets: ['speaking', 'listening', 'interaction'],
	},
	{
		day: 124,
		theme: 'ルールと必要性',
		objective: 'mustとhave toを使い、規則と状況上の必要を説明する',
		grammar: [
			'must / have to',
			'強い必要性と外部ルールを伝える',
			'mustは話し手が強く必要と考えること、have toは規則や状況による必要によく使います。',
			'You must show your ID.',
			'We have to leave before eight.',
			'「この建物では靴を脱ぐ必要があります」と言う。',
			'You have to take off your shoes in this building.',
		],
		vocabulary:
			'rule|規則;requirement|必要条件;permission|許可;obligation|義務;identification|身分証明',
		phrases:
			'You are required to...|…する必要があります。;Do I have to...?|…しなければなりませんか。',
		voiceTask:
			'施設の利用ルールを説明し、must / have to / do not have toの違いを質問に応じて明確にする。',
		skillTargets: ['grammar', 'vocabulary', 'interaction'],
	},
	{
		day: 125,
		theme: '可能性を比べる',
		objective: 'may / might / couldで確実でない将来の可能性を伝える',
		grammar: [
			'may / might / could',
			'断定せず複数の可能性を示す',
			'三つとも可能性に使えます。確実でないことを明示し、必要なら条件を加えます。',
			'It might rain in the afternoon.',
			'We could take a taxi if we are late.',
			'「会議は早く終わるかもしれません」と言う。',
			'The meeting may finish early.',
		],
		vocabulary:
			'possibility|可能性;likely|ありそうな;uncertain|不確かな;perhaps|ひょっとすると;alternative|別案',
		phrases:
			'There is a chance that...|…可能性があります。;We could always...|いつでも…という手があります。',
		voiceTask: '天候や交通が不確かな計画について三つの可能性とそれぞれのbackup planを話す。',
		skillTargets: ['grammar', 'speaking', 'fluency'],
	},
	{
		day: 126,
		theme: '現実的な条件を話す',
		objective: 'first conditionalで条件と起こり得る結果を説明する',
		grammar: [
			'first conditional',
			'if + 現在形、will + 動詞で現実的な将来を表す',
			'if節にはwillを置かず、条件が満たされた時の結果を主節に置きます。',
			'If it rains, we will stay inside.',
			'I will call you if the schedule changes.',
			'「早く終われば散歩に行きます」と言う。',
			'If I finish early, I will go for a walk.',
		],
		vocabulary:
			'condition|条件;consequence|結果;unless|…でない限り;depend|左右される;backup|予備の',
		phrases:
			'If that happens,...|もしそうなったら…。;It depends on whether...|…かどうかによります。',
		voiceTask: '週末イベントの雨・遅刻・満席の三条件に対する行動を相談し、計画表を口頭で作る。',
		skillTargets: ['grammar', 'interaction', 'listening'],
	},
	{
		day: 127,
		theme: 'if と unless',
		objective: '必要条件を肯定・否定の両方から簡潔に表す',
		grammar: [
			'unless',
			'if notをunlessで言い換える',
			'unlessは「…でない限り」を表し、既に否定を含むので後ろを重ねて否定しません。',
			'We will walk unless it rains.',
			'Unless you book early, tickets may sell out.',
			'「連絡がなければ予定通り始めます」と言う。',
			'We will start as planned unless you contact me.',
		],
		vocabulary:
			'unless|…でない限り;exception|例外;require|必要とする;otherwise|そうでなければ;proceed|進める',
		phrases:
			'Unless something changes,...|何か変わらない限り…。;Otherwise, we will...|そうでなければ…します。',
		voiceTask: '旅行計画の「通常案」と三つの例外条件をunless / otherwiseで説明する。',
		skillTargets: ['grammar', 'speaking', 'pronunciation'],
	},
	{
		day: 128,
		theme: '提案を交渉する',
		objective: 'could / why don’t weで案を出し、相手の条件に合わせて修正する',
		grammar: [
			'suggestion patterns',
			'複数案を押しつけずに提示する',
			'couldは可能な案、Why don’t we...?は共同提案です。反応を聞いて案を調整します。',
			'We could meet halfway.',
			'Why don’t we start a little earlier?',
			'「オンラインで話すのはどうですか」と提案する。',
			'Why don’t we talk online?',
		],
		vocabulary:
			'proposal|提案;adjust|調整する;acceptable|受け入れられる;flexible|柔軟な;solution|解決策',
		phrases:
			'Would that work for you?|それで都合はよいですか。;How about changing...?|…を変えるのはどうですか。',
		voiceTask: '時間と場所の条件が違う二人の予定を交渉し、少なくとも二案を修正して合意する。',
		skillTargets: ['interaction', 'listening', 'speaking'],
	},
	{
		day: 129,
		theme: '目的を説明する',
		objective: 'to不定詞を使って行動の目的を短く明確にする',
		grammar: [
			'infinitive of purpose',
			'行動 + to + 目的をつなぐ',
			'何のための行動かをto + 動詞で加えると、becauseより簡潔に目的を示せます。',
			'I went to the library to study.',
			'We saved money to take a trip.',
			'「質問するために電話しました」と言う。',
			'I called to ask a question.',
		],
		vocabulary: 'purpose|目的;aim|目標;prepare|備える;save|貯める;contact|連絡する',
		phrases:
			'I did it to...|…するためにそれをしました。;The purpose is to...|目的は…することです。',
		voiceTask: '今週行った三つの行動について、それぞれの目的と結果を説明する。',
		skillTargets: ['grammar', 'speaking', 'fluency'],
	},
	{
		day: 130,
		theme: '好きな活動と目標',
		objective: 'gerundとinfinitiveの基本パターンで好みと希望を話す',
		grammar: [
			'gerund / infinitive patterns',
			'enjoy + ing、want + toを使い分ける',
			'動詞ごとに続く形をchunkとして覚え、会話ではよく使う組み合わせを優先します。',
			'I enjoy cooking for friends.',
			'I want to learn how to bake bread.',
			'「新しい人と話すのが好きです」と言う。',
			'I enjoy talking with new people.',
		],
		vocabulary: 'enjoy|楽しむ;avoid|避ける;decide|決める;hope|望む;practice|練習する',
		phrases:
			'I enjoy doing that because...|それをするのが好きなのは…だからです。;I hope to...|…したいと思っています。',
		voiceTask: '楽しんでいる活動、避けていること、次に挑戦したいことを理由つきで話す。',
		skillTargets: ['grammar', 'vocabulary', 'speaking'],
	},
	{
		day: 131,
		theme: '問題への助言',
		objective: '状況を聞き取り、強さの異なる助言を選ぶ',
		grammar: [
			'advice strength',
			'could / should / have toを状況で選ぶ',
			'couldは選択肢、shouldは勧め、have toは避けられない必要を示します。',
			'You could ask a colleague.',
			'You should back up the file first.',
			'期限が今日なので「今日送る必要があります」と言う。',
			'You have to send it today.',
		],
		vocabulary: 'urgent|緊急の;optional|任意の;solution|解決策;consequence|結果;recommend|勧める',
		phrases:
			'One option would be...|一つの選択肢は…。;In this case, you need to...|この場合は…する必要があります。',
		voiceTask: '三つの問題を聞き、選択肢・おすすめ・必要行動を区別して助言する。',
		skillTargets: ['listening', 'interaction', 'grammar'],
	},
	{
		day: 132,
		theme: '不確かな説明を確認する',
		objective: '可能性表現を聞き、確定事項と未確定事項を分けて要約する',
		grammar: [
			'certainty questions',
			'Is it certain...? / Do we know...?で確度を確認する',
			'mayやmightを聞いたら、決定済みか可能性だけかをclarificationで確かめます。',
			'Is the date confirmed?',
			'Do we know whether the store will open?',
			'「それは確定ですか、それとも可能性ですか」と尋ねる。',
			'Is that confirmed, or is it only a possibility?',
		],
		vocabulary: 'certain|確かな;confirmed|確定した;tentative|仮の;chance|見込み;clarification|確認',
		phrases:
			'Is that definite?|それは確定ですか。;So it may happen, but it is not confirmed.|起こる可能性はありますが未確定なのですね。',
		voiceTask: '不確定なイベント説明を聞き、確定・可能性・条件の三種類に分けて言い返す。',
		skillTargets: ['listening', 'interaction', 'fluency'],
	},
	{
		day: 133,
		theme: '計画を言い換える',
		objective: '知らない語を避け、目的と特徴から計画を説明し直す',
		grammar: [
			'paraphrasing plans',
			'It is a plan to... / something that...で修復する',
			'語が出ない時は止まらず、目的・場所・必要な行動を別の簡単な語で説明します。',
			'It is a plan to share rides.',
			'We need something that keeps food cold.',
			'「名前は分かりませんが、日程を管理するものです」と言う。',
			'I do not know the word, but it is something that helps you manage a schedule.',
		],
		vocabulary:
			'paraphrase|言い換える;describe|説明する;function|機能;feature|特徴;repair|修復する',
		phrases:
			'I do not know the exact word, but...|正確な語は分かりませんが…。;What I mean is...|私が言いたいのは…。',
		voiceTask: '計画に必要な物や場所を固有名詞なしで説明し、聞き手の確認へ言い換えて答える。',
		skillTargets: ['interaction', 'speaking', 'vocabulary'],
	},
	{
		day: 134,
		theme: 'Unit 7 計画会議',
		objective: '予定・条件・助言・可能性を統合して実行案を作る',
		grammar: [
			'planning integration',
			'future forms / modals / conditionalを統合する',
			'確定予定、未確定要素、条件別対応、担当を順に整理します。',
			'We are meeting at nine, but the weather might change.',
			'If it rains, we will use the indoor space.',
			'「私が予約し、満席なら別の店を探します」と言う。',
			'I will book it, and if it is full, I will find another restaurant.',
		],
		vocabulary:
			'agenda|議題;responsibility|担当;backup plan|予備案;coordinate|調整する;finalize|確定する',
		phrases:
			'Let us confirm the final plan.|最終計画を確認しましょう。;Who will be responsible for...?|…は誰が担当しますか。',
		voiceTask: '小さなイベントの計画会議を7分行い、役割・条件・予備案を確定して最後に要約する。',
		skillTargets: ['speaking', 'interaction', 'listening', 'fluency'],
	},
	{
		day: 135,
		theme: '計画と助言の統合発話',
		objective: '自分の目標、実行計画、起こり得る問題と対策を説明する',
		grammar: [
			'Unit 7 review',
			'purpose / future / conditionalを一続きにする',
			'目標、目的、具体的な予定、ifによる対策の順で話すと計画が明確になります。',
			'I am going to take a course to improve my writing.',
			'If the class is full, I will study online.',
			'「会話力を伸ばすため毎週練習します」と言う。',
			'I am going to practice every week to improve my conversation skills.',
		],
		vocabulary: 'goal|目標;milestone|節目;action|行動;obstacle|障害;strategy|方略',
		phrases:
			'My first step will be...|最初の一歩は…。;If I face a problem, I will...|問題が起きたら…します。',
		voiceTask: '三か月の小さな目標を2分で発表し、助言と想定外の条件へ応答して合計8分話す。',
		skillTargets: ['speaking', 'fluency', 'pronunciation', 'interaction'],
	},
] as const satisfies readonly IndependentLessonSeed[];

export const UNIT_07_LESSONS = buildIndependentUnit(121, seeds);
