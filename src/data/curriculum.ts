import { GRAMMAR_PRACTICE } from './grammarPractice';
import { AVAILABLE_CURRICULUM_TOTAL_DAYS } from '../curriculum/constants';
import { INDEPENDENT_LESSONS } from './independent';
import { FLUENCY_LESSONS } from './fluency';
import { B2_CHALLENGE_LESSONS } from './b2Challenge';

export type CurriculumPhase =
	| 'Foundation'
	| 'Daily Life'
	| 'Connection'
	| 'Independence'
	| 'Independent'
	| 'Fluency'
	| 'B2 Challenge';

type LegacyCurriculumPhase = Exclude<CurriculumPhase, 'Independent' | 'Fluency' | 'B2 Challenge'>;

export interface GrammarFocus {
	readonly id: string;
	readonly title: string;
	readonly focus: string;
	readonly explanation: string;
	readonly examples: readonly [string, string];
	readonly exercise: string;
	readonly expectedAnswer: string;
}

export interface CurriculumItem {
	readonly id: string;
	readonly text: string;
	readonly meaning: string;
}

export interface CurriculumDay {
	readonly day: number;
	readonly week: number;
	readonly phase: CurriculumPhase;
	readonly theme: string;
	readonly objective: string;
	readonly grammar: GrammarFocus;
	readonly vocabulary: readonly CurriculumItem[];
	readonly phrases: readonly CurriculumItem[];
	readonly voiceTask: string;
}

interface WeekSeed {
	readonly phase: LegacyCurriculumPhase;
	readonly days: readonly (readonly [
		theme: string,
		objective: string,
		grammarTitle: string,
		grammarFocus: string,
	])[];
	readonly words: string;
	readonly phrases: string;
}

const splitItems = (source: string, prefix: string): readonly CurriculumItem[] =>
	source.split(';').map((pair, index) => {
		const separator = pair.indexOf('|');
		return {
			id: `${prefix}-${index + 1}`,
			text: separator === -1 ? pair : pair.slice(0, separator),
			meaning: separator === -1 ? pair : pair.slice(separator + 1),
		};
	});

const weeks: readonly WeekSeed[] = [
	{
		phase: 'Foundation',
		days: [
			[
				'はじめまして',
				'名前と出身を伝え、相手の名前を尋ねる',
				'be動詞 I / you',
				'I am / You are と疑問文 Are you ...?',
			],
			[
				'プロフィール交換',
				'職業・所属と住んでいる場所を一文ずつ伝える',
				'be動詞 he / she',
				'He is / She is と短縮形',
			],
			[
				'教室のもの',
				'身の回りの物を指して名前を確認する',
				'this / that',
				'This is / That is と What is this?',
			],
			[
				'持ち物を説明',
				'持っている物と持っていない物を伝える',
				'have / do not have',
				'一般動詞 have の肯定・否定',
			],
			[
				'好きなもの',
				'好き嫌いを述べて相手にも質問する',
				'一般動詞の疑問文',
				'Do you like ...? と短答',
			],
			[
				'聞き返しの基本',
				'聞き取れない時に止め、繰り返しを頼む',
				'命令文・依頼',
				'Please + 動詞 / Can you ...?',
			],
			[
				'第1週ミニ会話',
				'自己紹介から好きなものまで2分会話を続ける',
				'be動詞と一般動詞の整理',
				'疑問文と短答の使い分け',
			],
		],
		words:
			'name|名前;from|〜出身;Japan|日本;live|住む;city|都市;student|学生;teacher|教師;work|働く;company|会社;home|家;friend|友達;family|家族;this|これ;that|あれ;book|本;phone|電話;bag|かばん;pen|ペン;key|鍵;have|持つ;need|必要とする;want|欲しい;like|好む;love|大好き;coffee|コーヒー;tea|紅茶;music|音楽;movie|映画;food|食べ物;water|水;speak|話す;listen|聞く;understand|理解する;repeat|繰り返す;slowly|ゆっくり;again|もう一度;sorry|すみません;please|お願いします;yes|はい;no|いいえ;hello|こんにちは;goodbye|さようなら;nice|すてきな;meet|会う;what|何;where|どこ;who|誰;how|どのように;English|英語',
		phrases:
			'Nice to meet you.|はじめまして。;What is your name?|お名前は何ですか。;I am from Japan.|日本出身です。;I live in Tokyo.|東京に住んでいます。;What do you do?|お仕事は何ですか。;This is my phone.|これは私の電話です。;Do you have a pen?|ペンを持っていますか。;I like music.|音楽が好きです。;How about you?|あなたはどうですか。;Could you say that again?|もう一度言っていただけますか。;Please speak slowly.|ゆっくり話してください。;I do not understand.|分かりません。;What does that mean?|それはどういう意味ですか。;It was nice talking with you.|お話しできてよかったです。',
	},
	{
		phase: 'Foundation',
		days: [
			['朝のルーティン', '起床から外出までを順番に話す', '現在形 I / you', '習慣を表す現在形'],
			['家族の習慣', '家族の毎日の行動を説明する', '三人称単数', 'he / she + 動詞-s'],
			['時刻と予定', '時刻を言い、一日の予定を確認する', '時刻の前置詞', 'at / in / on の基礎'],
			[
				'頻度を伝える',
				'行動の頻度を具体的に述べる',
				'頻度副詞',
				'always / usually / sometimes / never',
			],
			['家の中を案内', '部屋と家具の位置を説明する', 'there is / are', '存在と単複'],
			[
				'家事を相談',
				'普段の家事を説明し、分担を頼む',
				'can の能力・依頼',
				'can / cannot と Can you ...?',
			],
			[
				'日常生活インタビュー',
				'生活リズムについて3分質問し合う',
				'現在形の統合',
				'Wh疑問文 + 現在形',
			],
		],
		words:
			'wake up|起きる;shower|シャワー;breakfast|朝食;leave|出る;early|早く;late|遅く;morning|朝;parent|親;mother|母;father|父;brother|兄弟;sister|姉妹;child|子ども;together|一緒に;clock|時計;hour|時間;minute|分;noon|正午;tonight|今夜;weekday|平日;weekend|週末;always|いつも;usually|普段;sometimes|時々;often|よく;rarely|めったに〜ない;never|決して〜ない;kitchen|台所;bedroom|寝室;bathroom|浴室;table|机;chair|椅子;window|窓;door|ドア;clean|掃除する;wash|洗う;cook|料理する;help|手伝う;busy|忙しい;free|暇な;tired|疲れた;start|始める;finish|終える;before|前に;after|後に;every|毎〜;day|日;week|週;routine|日課',
		phrases:
			'I wake up at seven.|7時に起きます。;What time do you start?|何時に始めますか。;She works from home.|彼女は在宅勤務です。;He usually cooks dinner.|彼は普段夕食を作ります。;I sometimes walk to work.|時々歩いて仕事へ行きます。;I never skip breakfast.|朝食は決して抜きません。;There is a table by the window.|窓のそばに机があります。;There are two bedrooms.|寝室が2つあります。;Can you help me?|手伝ってもらえますか。;I can do it tonight.|今夜できます。;What do you do after work?|仕事の後は何をしますか。;First, I make coffee.|まずコーヒーをいれます。;Then I check my phone.|それから電話を確認します。;That is my usual routine.|それが普段の日課です。',
	},
	{
		phase: 'Foundation',
		days: [
			[
				'カフェで注文',
				'飲み物と軽食を丁寧に注文する',
				'would like',
				'I would like ... / Would you like ...?',
			],
			['数と量', '必要な個数や量を尋ねて答える', '可算・不可算名詞', 'some / any と複数形'],
			[
				'レストラン入店',
				'人数を伝え、席を希望する',
				'人数・希望の表現',
				'a table for ... / Could we ...?',
			],
			[
				'メニュー相談',
				'料理の内容を尋ね、おすすめを聞く',
				'疑問詞 which / what',
				'選択を尋ねる疑問文',
			],
			['味と感想', '食べ物の味を説明し感想を交換する', '形容詞', 'be + 形容詞 / taste + 形容詞'],
			[
				'会計と問題対応',
				'会計を頼み、注文違いを丁寧に伝える',
				'丁寧な could',
				'Could I / Could you ...?',
			],
			[
				'外食ロールプレイ',
				'入店から会計まで3分やり取りする',
				'注文表現の統合',
				'would like / could / some',
			],
		],
		words:
			'menu|メニュー;order|注文する;drink|飲み物;meal|食事;coffee|コーヒー;juice|ジュース;sandwich|サンドイッチ;one|1;two|2;some|いくらか;any|何か;much|多くの量;many|多くの数;enough|十分な;restaurant|レストラン;seat|席;table|テーブル;people|人々;inside|中;outside|外;available|空いている;recommend|勧める;dish|料理;ingredient|材料;meat|肉;fish|魚;vegetable|野菜;allergy|アレルギー;sweet|甘い;salty|塩辛い;spicy|辛い;delicious|おいしい;hot|熱い;cold|冷たい;fresh|新鮮な;bill|会計;check|伝票;change|おつり;cash|現金;card|カード;wrong|間違った;missing|足りない;cup|カップ;glass|グラス;plate|皿;fork|フォーク;knife|ナイフ;spoon|スプーン;server|店員',
		phrases:
			'I would like a coffee.|コーヒーをお願いします。;Can I have this one?|これをいただけますか。;Do you have any tea?|紅茶はありますか。;Two glasses of water, please.|水を2杯お願いします。;A table for two, please.|2人用の席をお願いします。;Could we sit outside?|外に座れますか。;What do you recommend?|おすすめは何ですか。;What is in this dish?|この料理には何が入っていますか。;It is a little spicy.|少し辛いです。;This tastes great.|これはとてもおいしいです。;Could we have the bill?|会計をお願いします。;I do not think this is my order.|これは私の注文ではないと思います。;Can I pay by card?|カードで払えますか。;Thank you for your help.|対応ありがとうございます。',
	},
	{
		phase: 'Daily Life',
		days: [
			['今いる場所', '今いる場所と今していることを説明する', '現在進行形', 'be + 動詞-ing'],
			[
				'街の施設',
				'近くの施設の有無と場所を尋ねる',
				'場所の前置詞',
				'next to / across from / between',
			],
			['道を尋ねる', '目的地までの道順を聞き取る', '命令文', 'go / turn / cross を使う指示'],
			['道を案内する', '目印を使って道順を順番に伝える', '順序表現', 'first / then / after that'],
			['交通手段', '移動方法と所要時間について話す', 'how 疑問文', 'How do / How long ...?'],
			['駅で確認', '乗り場・行先・乗換を確認する', '間接的な質問', 'Do you know where ...?'],
			[
				'街歩きロールプレイ',
				'現在地から目的地まで4分相談する',
				'進行形と場所表現の統合',
				'現在の状況 + 道順',
			],
		],
		words:
			'stand|立つ;sit|座る;wait|待つ;look|見る;wear|着る;carry|運ぶ;walk|歩く;station|駅;bank|銀行;hospital|病院;store|店;park|公園;corner|角;block|街区;left|左;right|右;straight|まっすぐ;turn|曲がる;cross|渡る;pass|通り過ぎる;traffic light|信号;next to|隣に;across from|向かいに;between|間に;behind|後ろに;near|近くに;far|遠くに;map|地図;train|電車;bus|バス;subway|地下鉄;taxi|タクシー;bicycle|自転車;ride|乗る;drive|運転する;platform|乗り場;line|路線;ticket|切符;transfer|乗り換える;destination|目的地;entrance|入口;exit|出口;north|北;south|南;east|東;west|西;distance|距離;arrive|到着する;take|かかる',
		phrases:
			'I am waiting near the station.|駅の近くで待っています。;What are you doing now?|今何をしていますか。;Is there a bank near here?|近くに銀行はありますか。;It is across from the park.|公園の向かいです。;How can I get to the station?|駅にはどう行けばよいですか。;Go straight for two blocks.|2区画まっすぐ進んでください。;Turn left at the light.|信号で左に曲がってください。;You will see it on your right.|右手に見えます。;How long does it take?|どのくらいかかりますか。;I usually take the subway.|普段は地下鉄を使います。;Which line should I take?|どの路線に乗ればよいですか。;Where do I transfer?|どこで乗り換えますか。;Let me check the map.|地図を確認します。;I think we are here.|私たちはここにいると思います。',
	},
	{
		phase: 'Daily Life',
		days: [
			['服を探す', '欲しい服の種類と用途を店員に伝える', 'want to / need to', '目的を表す不定詞'],
			['色とサイズ', '色・サイズの希望と在庫を確認する', '形容詞の語順', '色・大きさ + 名詞'],
			['比較して選ぶ', '二つの商品を価格や特徴で比較する', '比較級', '-er / more ... than'],
			[
				'試着と感想',
				'試着を頼み、サイズ感を説明する',
				'too / enough',
				'too + 形容詞 / 形容詞 + enough',
			],
			['値段と支払い', '値段を確認し、支払い方法を選ぶ', 'how much', '金額を尋ねる・答える'],
			['返品を相談', '商品の問題と希望する対応を伝える', '過去形 be', 'was / were で状態説明'],
			[
				'買い物ロールプレイ',
				'相談から購入・返品まで4分会話する',
				'比較と希望表現の統合',
				'want / need / 比較級',
			],
		],
		words:
			'shirt|シャツ;pants|ズボン;jacket|上着;shoes|靴;dress|ワンピース;wear|着る;use|使う;color|色;black|黒;white|白;blue|青;size|サイズ;small|小さい;medium|中くらい;large|大きい;cheap|安い;expensive|高い;light|軽い;heavy|重い;better|より良い;worse|より悪い;quality|品質;choice|選択;try on|試着する;fit|合う;tight|きつい;loose|ゆるい;comfortable|快適な;mirror|鏡;fitting room|試着室;price|価格;sale|セール;discount|割引;cost|費用;pay|支払う;receipt|レシート;total|合計;return|返品する;exchange|交換する;broken|壊れた;problem|問題;bought|買った;yesterday|昨日;customer|客;clerk|店員;shop|買い物をする;item|商品;another|別の;pair|一組',
		phrases:
			'I am looking for a jacket.|上着を探しています。;I need something for work.|仕事用の物が必要です。;Do you have this in blue?|これの青はありますか。;Do you have a larger size?|もっと大きいサイズはありますか。;This one is cheaper than that one.|こちらはあちらより安いです。;Which one is more comfortable?|どちらがより快適ですか。;Can I try this on?|これを試着できますか。;It is a little too tight.|少しきつすぎます。;How much is this?|これはいくらですか。;Is this on sale?|これはセール品ですか。;I would like to return this.|これを返品したいです。;It was broken when I opened it.|開けた時に壊れていました。;Could I exchange it?|交換できますか。;I will take this one.|これにします。',
	},
	{
		phase: 'Daily Life',
		days: [
			['昨日の出来事', '昨日したことを時系列で3文話す', '規則動詞の過去形', '動詞-ed の肯定文'],
			['週末の経験', '週末の行動を尋ねて答える', '過去形の疑問・否定', 'Did ...? / did not'],
			[
				'移動の思い出',
				'行った場所と移動方法を説明する',
				'不規則動詞 go / come',
				'went / came / took',
			],
			['食事の思い出', '食べた物と感想を説明する', '不規則動詞 eat / have', 'ate / had / was'],
			[
				'良かったこと・困ったこと',
				'出来事への評価と理由を述べる',
				'because / so',
				'原因と結果をつなぐ',
			],
			[
				'詳しく質問する',
				'過去の話に5W1Hの追加質問をする',
				'過去のWh疑問文',
				'What / Where / Who did ...?',
			],
			[
				'週末ストーリー',
				'過去の出来事を4分語り質問に答える',
				'過去形の統合',
				'規則・不規則と接続語',
			],
		],
		words:
			'yesterday|昨日;last|前の;visited|訪れた;watched|見た;played|遊んだ;studied|勉強した;cleaned|掃除した;weekend|週末;did|した;stayed|滞在した;called|電話した;talked|話した;rested|休んだ;worked|働いた;went|行った;came|来た;took|乗った;saw|見た;met|会った;left|出発した;arrived|到着した;ate|食べた;had|持った・食べた;made|作った;drank|飲んだ;found|見つけた;gave|与えた;fun|楽しい;interesting|興味深い;boring|退屈な;difficult|難しい;easy|簡単な;because|なぜなら;so|それで;but|しかし;then|その時;first|最初に;finally|最後に;happen|起こる;story|話;memory|思い出;trip|小旅行;weather|天気;place|場所;person|人;reason|理由;experience|経験;question|質問;answer|答え',
		phrases:
			'I watched a movie yesterday.|昨日映画を見ました。;What did you do last weekend?|先週末は何をしましたか。;I did not go out.|外出しませんでした。;Did you have a good time?|楽しかったですか。;I went to Kyoto by train.|電車で京都へ行きました。;I met an old friend.|旧友に会いました。;We had lunch together.|一緒に昼食を食べました。;The food was delicious.|食事はおいしかったです。;It was fun because everyone was friendly.|皆が親切だったので楽しかったです。;It rained, so we stayed inside.|雨だったので中にいました。;Who did you go with?|誰と行きましたか。;What happened next?|次に何が起きましたか。;Tell me more about it.|それについてもっと教えてください。;That sounds interesting.|それは面白そうですね。',
	},
	{
		phase: 'Daily Life',
		days: [
			[
				'今週の予定',
				'近い未来の決まった予定を説明する',
				'be going to',
				'予定・意図を表す going to',
			],
			['週末を誘う', '活動に誘い、都合を確認する', 'would you like to', '丁寧な誘いと応答'],
			['待ち合わせ', '日時と場所を提案し調整する', '未来の時表現', 'this / next / on / at'],
			['その場で決める', '会話中に決めたことを伝える', 'will', '即時決定・申し出の will'],
			['予定変更', '理由を伝えて日時を変更する', 'have to', '義務と予定変更'],
			['選択肢を相談', '複数案の長所を比べ合意する', 'should', '提案・助言の should'],
			[
				'週末計画会議',
				'二人の予定を合わせて4分で計画を作る',
				'未来表現の統合',
				'going to / will / should',
			],
		],
		words:
			'plan|予定;future|未来;tomorrow|明日;next|次の;week|週;month|月;visit|訪れる;invite|招待する;join|参加する;available|空いている;maybe|たぶん;sure|確かな;sorry|残念ながら;glad|うれしい;meet|会う;date|日付;time|時刻;place|場所;calendar|カレンダー;morning|午前;afternoon|午後;evening|夕方;will|〜するつもり;decide|決める;promise|約束する;bring|持ってくる;pick up|迎えに行く;call|電話する;check|確認する;change|変える;cancel|中止する;delay|遅らせる;reason|理由;appointment|約束;urgent|緊急の;instead|代わりに;option|選択肢;idea|考え;should|〜すべき;could|〜できる;best|最善の;agree|同意する;prefer|より好む;concert|コンサート;museum|博物館;picnic|ピクニック;beach|海岸;hike|ハイキング;event|催し',
		phrases:
			'I am going to visit my family.|家族を訪ねる予定です。;What are you going to do tomorrow?|明日は何をする予定ですか。;Would you like to join me?|一緒に参加しませんか。;I would love to.|ぜひ。;Are you free on Saturday?|土曜日は空いていますか。;Let us meet at ten.|10時に会いましょう。;I will check my calendar.|カレンダーを確認します。;I will call you tonight.|今夜電話します。;I have to change our plan.|予定を変更しなければなりません。;Can we meet on Sunday instead?|代わりに日曜日に会えますか。;We should go early.|早く行った方がよいです。;Which do you prefer?|どちらがよいですか。;That works for me.|それで大丈夫です。;See you then.|ではその時に。',
	},
	{
		phase: 'Connection',
		days: [
			[
				'体調を説明',
				'症状と続いている期間を簡潔に伝える',
				'have / feel + 症状',
				'体調を表す基本文',
			],
			[
				'病院で質問',
				'症状について過去形で質問に答える',
				'when / how long（現在完了）',
				'発症時期・期間の疑問文',
			],
			['薬局で相談', '必要な薬と使用方法を確認する', 'should / should not', '助言と注意'],
			[
				'生活習慣の助言',
				'健康習慣について具体的に助言する',
				'命令文と should',
				'Do / Do not / You should',
			],
			[
				'緊急度を伝える',
				'緊急時に場所・状態・必要な助けを伝える',
				'need + 名詞 / to',
				'必要性を明確にする',
			],
			['回復を説明', '以前と現在の状態を比較する', '比較級の復習', 'better / worse than'],
			[
				'健康相談ロールプレイ',
				'症状説明から助言確認まで4分話す',
				'健康表現の統合',
				'過去・現在・助言',
			],
		],
		words:
			'headache|頭痛;fever|熱;cough|せき;cold|風邪;pain|痛み;sick|具合が悪い;feel|感じる;symptom|症状;since|〜以来;ago|〜前;hurt|痛む;start|始まる;night|夜;temperature|体温;medicine|薬;tablet|錠剤;pharmacy|薬局;dose|服用量;before|前に;after|後に;side effect|副作用;allergic|アレルギーがある;healthy|健康な;sleep|眠る;exercise|運動する;rest|休む;diet|食生活;stress|ストレス;enough|十分な;emergency|緊急事態;ambulance|救急車;accident|事故;address|住所;danger|危険;help|助け;breath|呼吸;recover|回復する;better|より良い;worse|より悪い;still|まだ;almost|ほとんど;normal|正常な;doctor|医師;nurse|看護師;clinic|診療所;hospital|病院;careful|注意深い;serious|深刻な;safe|安全な',
		phrases:
			'I have a headache.|頭が痛いです。;I do not feel well.|具合がよくありません。;When did it start?|いつ始まりましたか。;I have felt sick since yesterday.|昨日から具合が悪いです。;How often should I take this?|これはどのくらいの頻度で飲みますか。;Are there any side effects?|副作用はありますか。;You should get some rest.|少し休んだ方がよいです。;You should not drive today.|今日は運転しない方がよいです。;I need an ambulance.|救急車が必要です。;Please send help to this address.|この住所に助けを送ってください。;I feel better than yesterday.|昨日より気分がよいです。;The pain is getting worse.|痛みが悪化しています。;Should I see a doctor?|医師に診てもらうべきですか。;Thank you. I understand.|ありがとうございます。分かりました。',
	},
	{
		phase: 'Connection',
		days: [
			['仕事の役割', '担当業務と普段の一日を説明する', '現在形の詳細化', '担当・頻度・順序'],
			[
				'進行中の仕事',
				'今取り組んでいる作業と進み具合を話す',
				'現在進行形の復習',
				'一時的な活動と現状',
			],
			['依頼と期限', '仕事を丁寧に依頼し期限を確認する', 'could / would', '丁寧な依頼'],
			[
				'問題を報告',
				'問題・影響・必要な対応を順に伝える',
				'現在完了の導入',
				'has happened / have found',
			],
			['意見を述べる', '案への意見と理由をやわらかく伝える', 'I think / because', '意見と根拠'],
			[
				'会議で確認',
				'理解を確認し要点を言い換える',
				'間接疑問・付加確認',
				'So you mean ...? / Is that right?',
			],
			['短い進捗会議', '進捗・問題・次の行動を5分で共有する', '仕事表現の統合', '現状・完了・未来'],
		],
		words:
			'job|仕事;team|チーム;project|企画;task|作業;customer|顧客;manage|管理する;support|支援する;current|現在の;progress|進捗;working|作業中;prepare|準備する;report|報告書;almost|ほぼ;complete|完了した;deadline|締切;request|依頼;send|送る;review|確認する;update|更新する;possible|可能な;Friday|金曜日;problem|問題;issue|課題;delay|遅れ;error|誤り;impact|影響;solve|解決する;notice|気づく;opinion|意見;think|思う;agree|同意する;disagree|同意しない;reason|理由;useful|役立つ;important|重要な;meeting|会議;point|要点;mean|意味する;confirm|確認する;summary|要約;decision|決定;action|行動;email|メール;document|文書;schedule|予定;client|依頼主;manager|管理者;colleague|同僚;office|職場',
		phrases:
			'I work in customer support.|顧客対応を担当しています。;My main task is answering questions.|主な仕事は質問への回答です。;I am preparing the weekly report.|週次報告を準備しています。;It is almost complete.|ほぼ完了しています。;Could you review this by Friday?|金曜日までに確認していただけますか。;When do you need it?|いつ必要ですか。;I have found a problem.|問題を見つけました。;This may cause a delay.|これは遅れの原因になるかもしれません。;I think this idea is useful.|この案は役立つと思います。;I agree because it is simple.|簡単なので賛成です。;Could you explain that point?|その点を説明していただけますか。;So you mean we should wait.|つまり待つべきという意味ですね。;Is that right?|合っていますか。;My next step is to contact the client.|次に顧客へ連絡します。',
	},
	{
		phase: 'Connection',
		days: [
			['旅行の希望', '行きたい場所と旅行の希望を説明する', 'want to / would like to', '希望と目的'],
			['宿を予約', '日付・人数・部屋の条件を伝える', 'for / from / to', '期間・人数の前置詞'],
			['チェックイン', '予約情報を伝え設備を確認する', '現在完了 have booked', '完了結果の基本'],
			['観光案内を聞く', 'おすすめと行き方・営業時間を尋ねる', '最上級', 'the best / nearest'],
			['旅行中の問題', '紛失や設備不良を説明し対応を求める', '現在完了', 'have lost / has stopped'],
			['旅の経験を共有', '経験の有無と印象を話す', '経験の現在完了', 'Have you ever ...?'],
			[
				'旅行相談ロールプレイ',
				'予約から体験共有まで5分会話する',
				'旅行表現の統合',
				'未来・現在完了・最上級',
			],
		],
		words:
			'travel|旅行する;country|国;abroad|海外;holiday|休暇;culture|文化;adventure|冒険;explore|探索する;hotel|ホテル;room|部屋;single|一人用;double|二人用;night|泊;reserve|予約する;guest|宿泊客;booking|予約;passport|旅券;reception|受付;key card|カードキー;wifi|Wi-Fi;breakfast|朝食;included|含まれた;guide|案内;attraction|観光名所;famous|有名な;popular|人気の;nearest|最寄りの;open|開いている;close|閉まる;lost|なくした;luggage|荷物;wallet|財布;air conditioner|空調;shower|シャワー;repair|修理する;experience|経験;ever|今までに;never|一度も〜ない;already|すでに;yet|まだ;wonderful|すばらしい;amazing|驚くほどよい;flight|飛行便;airport|空港;gate|搭乗口;departure|出発;arrival|到着;tourist|旅行者;local|地元の;reservation|予約',
		phrases:
			'I would like to visit Canada.|カナダを訪れたいです。;I want to learn about the culture.|文化について学びたいです。;I would like to book a room.|部屋を予約したいです。;For three nights, please.|3泊でお願いします。;I have a reservation under Sato.|佐藤の名前で予約しています。;Is breakfast included?|朝食は含まれていますか。;What is the best place to visit?|一番おすすめの場所はどこですか。;What time does it open?|何時に開きますか。;I have lost my key card.|カードキーをなくしました。;The air conditioner has stopped working.|空調が動かなくなりました。;Have you ever been abroad?|海外へ行ったことがありますか。;Yes, I have been to Korea.|はい、韓国へ行ったことがあります。;It was an amazing experience.|すばらしい経験でした。;Could you help me with my booking?|予約を手伝っていただけますか。',
	},
	{
		phase: 'Connection',
		days: [
			['趣味を深掘り', '趣味を始めたきっかけと頻度を話す', '動名詞', 'like / enjoy + 動詞-ing'],
			[
				'映画や本の紹介',
				'作品のあらすじと感想を簡潔に述べる',
				'関係代名詞 who / that',
				'人・物への補足説明',
			],
			['音楽について話す', '好みを比較し具体例を挙げる', '比較級・最上級の復習', '好みの比較'],
			[
				'スポーツ経験',
				'できることと上達したいことを述べる',
				'can / be able to',
				'能力の現在・未来',
			],
			[
				'相手に追加質問',
				'相手の答えから自然な追加質問を作る',
				'疑問詞 + else',
				'What else / Who else / How often',
			],
			[
				'共通点を見つける',
				'共感・相違を示して会話を広げる',
				'so / neither',
				'So do I / Neither do I',
			],
			[
				'趣味の5分会話',
				'追加質問と共感で趣味の会話を5分続ける',
				'会話展開表現の統合',
				'説明・比較・追加質問',
			],
		],
		words:
			'hobby|趣味;enjoy|楽しむ;collect|集める;paint|絵を描く;garden|園芸をする;photograph|写真を撮る;practice|練習する;novel|小説;character|登場人物;plot|筋書き;author|著者;actor|俳優;scene|場面;ending|結末;song|歌;singer|歌手;band|バンド;lyrics|歌詞;rhythm|リズム;favorite|お気に入り;relaxing|くつろげる;sport|スポーツ;swim|泳ぐ;run|走る;climb|登る;skill|技能;improve|上達する;competition|競技;else|ほかに;recently|最近;especially|特に;kind|種類;interested|興味がある;why|なぜ;how often|どのくらい頻繁に;common|共通の;same|同じ;different|違う;both|両方;neither|どちらも〜ない;similar|似た;share|共有する;recommend|勧める;beginner|初心者;expert|熟練者;creative|創造的な;outdoor|屋外の;indoor|屋内の;activity|活動',
		phrases:
			'I enjoy taking photos.|写真を撮るのが好きです。;I started this hobby last year.|去年この趣味を始めました。;It is a story about a young chef.|若い料理人についての物語です。;She is an actor who I really like.|彼女は私がとても好きな俳優です。;This song is more relaxing.|この歌の方がくつろげます。;That is my favorite album.|それは私のお気に入りのアルバムです。;I can swim, but I cannot dive.|泳げますが潜れません。;I want to be able to run farther.|もっと遠くまで走れるようになりたいです。;What else do you enjoy?|ほかに何を楽しみますか。;How did you get interested in it?|どうやってそれに興味を持ちましたか。;So do I.|私もそうです。;I have never tried that.|それは試したことがありません。;You should try it sometime.|いつか試してみてください。;We have a lot in common.|共通点がたくさんありますね。',
	},
	{
		phase: 'Independence',
		days: [
			[
				'意見を組み立てる',
				'結論・理由・例の順で意見を述べる',
				'接続語',
				'because / for example / so',
			],
			[
				'賛成と反対',
				'相手を尊重しながら賛否を伝える',
				'部分同意',
				'I agree / I see your point, but ...',
			],
			[
				'可能性を話す',
				'確信度を区別して予想を述べる',
				'may / might / probably',
				'可能性の助動詞・副詞',
			],
			['条件を考える', '現実的な条件と結果を説明する', '第一条件文', 'If + 現在形, will ...'],
			['利点と欠点', '二つの選択肢の長短を比較する', 'on one hand', '対比する談話表現'],
			[
				'確認して言い換える',
				'理解できない内容を確認し自分の言葉で言い換える',
				'言い換え表現',
				'In other words / Do you mean ...?',
			],
			[
				'やさしいディスカッション',
				'身近なテーマで6分意見交換する',
				'意見表現の統合',
				'主張・根拠・応答・要約',
			],
		],
		words:
			'opinion|意見;believe|信じる;reason|理由;example|例;important|重要な;benefit|利点;result|結果;agree|賛成する;disagree|反対する;point|主張;however|しかし;respect|尊重する;partly|部分的に;instead|代わりに;possible|可能な;probably|おそらく;perhaps|たぶん;may|〜かもしれない;might|〜かもしれない;certain|確かな;unlikely|ありそうにない;if|もし;condition|条件;happen|起こる;change|変化する;choose|選ぶ;save|節約する;waste|無駄にする;advantage|長所;disadvantage|短所;on one hand|一方では;on the other hand|他方では;although|〜だけれども;balance|均衡;compare|比較する;word|言葉;phrase|表現;explain|説明する;rephrase|言い換える;understanding|理解;clear|明確な;exactly|正確に;topic|話題;discussion|議論;view|見方;support|裏付ける;conclusion|結論;summary|要約;perspective|観点',
		phrases:
			'I think this is a good idea.|これはよい考えだと思います。;My main reason is the cost.|主な理由は費用です。;I agree with you.|あなたに賛成です。;I see your point, but I feel differently.|言いたいことは分かりますが、私は違うように感じます。;It might be difficult.|難しいかもしれません。;It will probably take more time.|おそらくもっと時間がかかります。;If we start early, we will finish on time.|早く始めれば時間通りに終わります。;What will you do if it rains?|雨ならどうしますか。;On one hand, it is convenient.|一方では便利です。;The disadvantage is the price.|欠点は価格です。;Do you mean it is not available?|利用できないという意味ですか。;In other words, we need another plan.|言い換えると別の案が必要です。;Let me summarize my view.|私の考えを要約します。;That is an interesting perspective.|それは興味深い見方です。',
	},
	{
		phase: 'Independence',
		days: [
			[
				'会話を始める',
				'状況に合う雑談を始めて質問する',
				'現在・過去の質問復習',
				'自然なオープン質問',
			],
			[
				'話題を広げる',
				'一つの答えから理由・例・感情を尋ねる',
				'follow-up questions',
				'Why / What was ... like? / How did ...?',
			],
			[
				'間をつなぐ',
				'考える時間を取りながら発話を続ける',
				'フィラーと文の修復',
				'Let me think / What I mean is ...',
			],
			[
				'知らない語を回避',
				'知らない単語を説明・言い換えで補う',
				'関係節・用途説明',
				'It is something that / You use it to',
			],
			[
				'誤解を直す',
				'相手の理解を確認し誤解を丁寧に訂正する',
				'否定と対比',
				'Not exactly / I meant ...',
			],
			['話題を移す', '会話を切らずに新しい話題へ移る', '談話標識', 'By the way / Speaking of ...'],
			[
				'会話維持チャレンジ',
				'修復戦略を使い7分会話を続ける',
				'会話方略の統合',
				'開始・展開・修復・転換',
			],
		],
		words:
			'conversation|会話;start|始める;weather|天気;neighborhood|近所;notice|気づく;wonder|気になる;recent|最近の;continue|続ける;detail|詳細;feeling|感情;example|例;experience|経験;surprising|驚くべき;challenging|難しい;pause|間;think|考える;mean|意味する;actually|実は;basically|基本的に;anyway|とにかく;moment|少しの間;describe|説明する;thing|物;person|人;place|場所;use|用途;shape|形;similar|似た;opposite|反対の;misunderstanding|誤解;correct|訂正する;exactly|正確に;rather|むしろ;instead|代わりに;intend|意図する;confused|混乱した;topic|話題;mention|話に出す;speaking of|〜と言えば;by the way|ところで;remind|思い出させる;related|関連した;strategy|方略;repair|修復;maintain|維持する;respond|応答する;clarify|明確にする;interaction|やり取り;confident|自信がある',
		phrases:
			'How has your week been?|今週はどうでしたか。;Have you been busy lately?|最近忙しかったですか。;What was that like?|それはどんな感じでしたか。;How did you feel about it?|それについてどう感じましたか。;Let me think for a moment.|少し考えさせてください。;What I mean is this.|私が言いたいのはこうです。;I do not know the word, but...|単語は分かりませんが…。;It is something you use to cook.|料理に使う物です。;Not exactly.|正確には違います。;I meant next Friday, not this Friday.|今週ではなく来週の金曜日という意味でした。;Does that make sense?|意味は通じますか。;Thanks for clarifying.|はっきり説明してくれてありがとう。;By the way, how is your family?|ところで、ご家族は元気ですか。;Speaking of travel, have you been to Osaka?|旅行と言えば、大阪へ行ったことがありますか。',
	},
	{
		phase: 'Independence',
		days: [
			[
				'成長を振り返る',
				'90日間でできるようになったことを説明する',
				'現在完了 + since',
				'継続・変化の振り返り',
			],
			['忘れられない一日', '印象的な出来事を詳しく物語る', '過去形と接続語', '時間順のナラティブ'],
			[
				'これからの目標',
				'次の3か月の具体的な目標を話す',
				'未来表現の使い分け',
				'going to / will / want to',
			],
			['総合場面：旅行', '移動・宿泊・問題対応を通しで行う', '疑問文総復習', '適切な疑問文の選択'],
			[
				'総合場面：交流',
				'初対面から共通点を見つけ会話を広げる',
				'時制総復習',
				'過去・現在・未来の往復',
			],
			[
				'最終リハーサル',
				'弱点を修復しながら8分会話する',
				'個人弱点の再学習',
				'間違いノート上位項目',
			],
			[
				'90日最終会話',
				'身近な話題で10分会話し今後の計画まで述べる',
				'全項目の統合',
				'正確さ・流暢さ・会話維持',
			],
		],
		words:
			'growth|成長;improve|上達する;since|〜以来;achieve|達成する;proud|誇りに思う;confident|自信がある;challenge|課題;unforgettable|忘れられない;event|出来事;suddenly|突然;luckily|幸運にも;eventually|最終的に;realize|気づく;lesson|教訓;goal|目標;continue|続ける;next|次の;month|月;regularly|定期的に;fluently|流暢に;plan|計画;journey|旅;reservation|予約;direction|道順;problem|問題;solution|解決策;information|情報;confirm|確認する;introduction|自己紹介;background|経歴;interest|興味;common|共通の;follow-up|追加の;connection|つながり;future|未来;rehearsal|リハーサル;weakness|弱点;strength|強み;correct|正確な;natural|自然な;strategy|方略;feedback|フィードバック;final|最終の;conversation|会話;communicate|意思疎通する;explain|説明する;ask|尋ねる;respond|応答する;maintain|維持する',
		phrases:
			'I have improved a lot since day one.|初日から大きく上達しました。;I am proud that I can keep talking.|話し続けられることを誇りに思います。;First, we missed the train, and then...|まず電車に乗り遅れ、それから…。;The experience taught me an important lesson.|その経験から大切なことを学びました。;My next goal is to speak more naturally.|次の目標はもっと自然に話すことです。;I am going to practice every day.|毎日練習する予定です。;Could you confirm my reservation?|予約を確認していただけますか。;What should I do next?|次に何をすべきですか。;We both enjoy learning new things.|私たちは二人とも新しいことを学ぶのが好きです。;What would you like to do in the future?|将来何をしたいですか。;Let me try that again.|もう一度やらせてください。;A better way to say it is...|よりよい言い方は…。;I can explain my ideas more clearly now.|今は考えをより明確に説明できます。;I want to keep improving.|これからも上達し続けたいです。',
	},
] as const;

const curriculum: CurriculumDay[] = [];
let dayNumber = 1;

const curatedVocabularyReplacements = new Map<string, CurriculumItem>(
	splitItems(
		'15:coffee=espresso|エスプレッソ;17:table=counter|カウンター席;29:wear=clothing|衣類;35:yesterday=refund|返金;36:yesterday=earlier|以前に;37:weekend=Saturday|土曜日;38:left=departed|出発した;43:week=this week|今週;44:sorry=unfortunately|残念ながら;45:meet=arrange|取り決める;45:place=venue|会場;45:morning=midday|正午ごろ;47:check=verify|確認する;47:change=reschedule|予定を変更する;47:reason=conflict|予定の重なり;50:cold=dizzy|めまいがする;51:start=begin|始まる;51:night=midnight|真夜中;52:before=before meals|食前に;52:after=after meals|食後に;54:enough=urgent|緊急の;54:help=assistance|援助;55:better=stronger|より元気な;55:worse=weaker|より弱った;56:hospital=treatment|治療;57:culture=customs|習慣・風習;58:night=overnight|一泊の;59:breakfast=lobby|ロビー;61:shower=hot water|お湯;61:repair=maintenance|保守・修理;61:experience=inconvenience|不便;62:never=once|一度;70:recommend=suggest|提案する;78:weather=small talk|雑談;79:example=reaction|反応;79:experience=episode|出来事;81:use=function|機能・用途',
		'curated-v',
	).map((item) => {
		const [dayAndOriginal, text] = item.text.split('=');
		return [dayAndOriginal, { ...item, text }] as const;
	}),
);

function grammarContent(
	title: string,
	focus: string,
): Omit<GrammarFocus, 'id' | 'title' | 'focus'> {
	const practice = GRAMMAR_PRACTICE[title];
	if (!practice) throw new Error(`Missing authored grammar practice for: ${title}`);
	const [exampleOne, exampleTwo, exercise, expectedAnswer] = practice;
	return {
		explanation: `${title}では「${focus}」を使います。まず ${exampleOne} の語順を確認し、次に ${exampleTwo} のように会話の目的へ合わせます。`,
		examples: [exampleOne, exampleTwo],
		exercise,
		expectedAnswer,
	};
}

// The workplace unit is retained above as an authoring reserve, but Core prioritizes
// everyday social independence. It may be used by a future optional content pack.
const coreWeeks = weeks.filter((week) => week.days[0]?.[0] !== '仕事の役割');

coreWeeks.forEach((week, weekIndex) => {
	const vocabulary = splitItems(week.words, `w${weekIndex + 1}-v`);
	const phrases = splitItems(week.phrases, `w${weekIndex + 1}-p`);
	week.days.forEach(([theme, objective, grammarTitle, grammarFocus], dayIndex) => {
		if (theme === '最終リハーサル') return;
		if (dayNumber > AVAILABLE_CURRICULUM_TOTAL_DAYS) return;
		const grammarId = `d${dayNumber}-grammar`;
		const dayVocabulary = vocabulary.slice(dayIndex * 7, dayIndex * 7 + 7).map((item) => {
			const replacement = curatedVocabularyReplacements.get(`${dayNumber}:${item.text}`);
			return replacement ? { ...replacement, id: item.id } : item;
		});
		curriculum.push({
			day: dayNumber,
			week: weekIndex + 1,
			phase: week.phase,
			theme,
			objective,
			grammar: {
				id: grammarId,
				title: grammarTitle,
				focus: grammarFocus,
				...grammarContent(grammarTitle, grammarFocus),
			},
			vocabulary: dayVocabulary,
			phrases: phrases.slice(dayIndex * 2, dayIndex * 2 + 2),
			voiceTask: `「${theme}」を題材に、${objective}。今日の文法「${grammarTitle}」と新しい表現を使い、ChatGPTと段階的な会話練習を行う。`,
		});
		dayNumber += 1;
	});
});

const legacyCurriculum = Object.freeze([...curriculum]);
if (legacyCurriculum.length !== 90) {
	throw new Error('The frozen legacy curriculum must contain exactly Day 1-90.');
}

/** Coreで使用するbundle済みカリキュラム。Boostはこの配列の進捗を変更しない。 */
export const CURRICULUM: readonly CurriculumDay[] = Object.freeze([
	...legacyCurriculum,
	...INDEPENDENT_LESSONS.map((lesson) => lesson.content),
	...FLUENCY_LESSONS.map((lesson) => lesson.content),
	...B2_CHALLENGE_LESSONS.map((lesson) => lesson.content),
]);

export const getCurriculumDay = (day: number): CurriculumDay | undefined =>
	CURRICULUM.find((lesson) => lesson.day === day);

/** @deprecated Use AVAILABLE_CURRICULUM_TOTAL_DAYS for bundled curriculum availability. */
export const CURRICULUM_TOTAL_DAYS = AVAILABLE_CURRICULUM_TOTAL_DAYS;
export const DAILY_NEW_WORD_LIMIT = 8;
export const DAILY_NEW_PHRASE_LIMIT = 3;
export const DAILY_PREVIEW_GRAMMAR_LIMIT = 1;
