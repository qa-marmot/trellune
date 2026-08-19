import { buildB2ChallengeUnit, type B2ChallengeLessonSeed } from './shared';

const seeds = [
	{
		day: 331,
		theme: '話者のstanceとcertaintyを分ける',
		objective: '賛否の方向と確信の強さを別々に聞き取る',
		grammar: [
			'stance versus certainty',
			'supports but remains unsure / strongly doubts / cautiously favorsを使う',
			'賛成していても確信が弱い場合があるため、stanceとcertaintyを一語でまとめません。',
			'The speaker cautiously favors the plan but remains unsure about funding.',
			'She strongly doubts the timeline, although she supports the goal.',
			'発言のstanceとcertaintyを二文で述べる。',
			'He appears neutral on the idea itself but is fairly certain that the current process will not scale.',
		],
		vocabulary: 'certainty|確信度;cautiously favor|慎重に支持する;stance signal|stanceのsignal',
		phrases:
			'The speaker supports..., but is unsure about...|話者は…を支持しますが…は不確かです。;The level of certainty seems...|確信度は…のようです。',
		voiceTask: 'near-natural発言八つを聞き、stance、certainty、根拠語句を即答する。',
		skillTargets: ['listening', 'speaking', 'interaction', 'vocabulary'],
	},
	{
		day: 332,
		theme: '遠回しな依頼のimplicationを捉える',
		objective: 'literal meaningと期待されるactionを分けて確認する',
		grammar: [
			'interpreting indirect requests',
			'may be implying / seems to be asking / should Iを使う',
			'文化やcontextで解釈が変わるため、推測後に相手が訂正できるquestionを置きます。',
			'“The report is still quite long” may be implying a request to shorten it.',
			'Are you asking me to revise the summary before the meeting?',
			'indirect requestを確認する。',
			'It sounds as though you need the figures earlier; should I send a draft this afternoon?',
		],
		vocabulary: 'implication|含意;indirect request|遠回しな依頼;literal meaning|文字通りの意味',
		phrases:
			'Are you suggesting that...?|…というsuggestionですか？;Would you like me to...?|私が…しましょうか？',
		voiceTask:
			'indirectなworkplace発言六つへimplicationを推測し、pressureのない確認responseを返す。',
		skillTargets: ['listening', 'interaction', 'speaking', 'fluency'],
	},
	{
		day: 333,
		theme: 'connected speechで省略された語を補う',
		objective: '全部を聞き直さずcontextから欠けたdetailを絞って確認する',
		grammar: [
			'targeted listening repair',
			'did you say / was that before or after / which oneを使う',
			'聞こえなかった部分だけを特定すると会話のflowを保てます。',
			'Did you say the change starts Thursday or the following Thursday?',
			'Was that before or after the user test?',
			'欠けたdetailだけ確認する。',
			'I caught the reason but not the date; did you say the fifteenth?',
		],
		vocabulary:
			'reduced speech|弱化した発話;missing detail|聞き取れないdetail;targeted repair|焦点を絞ったrepair',
		phrases:
			'I caught..., but not...|…は聞き取れましたが…は不明です。;Was that... or...?|…ですか、それとも…ですか？',
		voiceTask: 'connected speechの短いupdateを聞き、missing部分だけを確認して正確なsummaryを返す。',
		skillTargets: ['listening', 'interaction', 'pronunciation', 'speaking'],
	},
	{
		day: 334,
		theme: '皮肉ではない軽いunderstatementを読む',
		objective: 'wordsとcontextの差から話者の本当の評価を慎重に推測する',
		grammar: [
			'understatement awareness',
			'may be understating / sounds more serious than / probably meansを使う',
			'toneだけで断定せず、状況との不一致を根拠にして確認します。',
			'Calling a two-hour delay “a small issue” may be understating the impact.',
			'The situation sounds more serious than the speaker’s words suggest.',
			'understatementの可能性を述べる。',
			'“Not ideal” probably means the result was disappointing, but I would ask what failed before assuming more.',
		],
		vocabulary:
			'understatement|控えめすぎる表現;tone-context gap|toneとcontextの差;downplay|軽く扱う',
		phrases:
			'The wording may be understating...|表現は…を控えめにしているかもしれません。;Do you mean it was more serious?|より深刻だったという意味ですか？',
		voiceTask:
			'context付き発言五つを聞き、literal meaning、possible nuance、safe confirmationを述べる。',
		skillTargets: ['listening', 'interaction', 'speaking', 'vocabulary'],
	},
	{
		day: 335,
		theme: 'hedgingの強さを調整する',
		objective: 'evidenceに合うcertaintyでclaimし、曖昧すぎる表現も避ける',
		grammar: [
			'calibrated hedging',
			'appears / is likely / may possiblyをevidence別に使う',
			'hedgeを増やすほど丁寧になるわけではなく、evidenceの強さに合わせます。',
			'The results strongly suggest that waiting time fell.',
			'The change may possibly affect weekend use, but the sample is small.',
			'evidence三段階でclaimを調整する。',
			'The repeated pattern suggests a real improvement, while the single complaint may reflect an isolated case.',
		],
		vocabulary: 'calibrate|強さを調整する;strong evidence|強いevidence;tentative claim|暫定claim',
		phrases:
			'The evidence strongly suggests...|evidenceは…を強く示します。;A more tentative conclusion is...|より暫定的な結論は…。',
		voiceTask: 'evidence cards六枚からclaimを作り、hedgeが強すぎる/弱すぎる箇所を相互修正する。',
		skillTargets: ['speaking', 'grammar', 'interaction', 'vocabulary'],
	},
	{
		day: 336,
		theme: 'unknown expressionをcontextで処理する',
		objective: '会話を止めず仮のmeaningを作り、重要なら確認する',
		grammar: [
			'meaning from context',
			'from the context / seems to mean / is it similar toを使う',
			'未知表現を完全に推測せず、周囲のexampleとcontrastから仮説を作ります。',
			'From the context, “roll back” seems to mean returning to an earlier version.',
			'Is it similar to undoing the last change?',
			'unknown phraseのmeaningを確認する。',
			'It sounds like “phase out” means stopping something gradually rather than immediately.',
		],
		vocabulary:
			'context clue|contextの手掛かり;provisional meaning|仮のmeaning;phase out|段階的に終了する',
		phrases:
			'From the context, it seems to mean...|contextから…の意味のようです。;Is it similar to...?|…に似ていますか？',
		voiceTask: '未知chunkを含む会話を聞き、context clue、仮meaning、確認、paraphraseを六回行う。',
		skillTargets: ['listening', 'interaction', 'vocabulary', 'speaking'],
	},
	{
		day: 337,
		theme: '話者が避けたpointを確認する',
		objective: 'missing answerを攻撃せず、元questionへ丁寧に戻す',
		grammar: [
			'returning to an unanswered point',
			'I noticed we have not covered / could we return to / before we closeを使う',
			'意図的回避と決めつけず、discussion map上の未回答pointとして扱います。',
			'I noticed we have not covered who will handle support.',
			'Before we close, could we return to the cost estimate?',
			'未回答pointへ戻る。',
			'You explained the benefits clearly; could we also return to what happens if the trial fails?',
		],
		vocabulary:
			'unanswered point|未回答point;return to|…へ戻る;avoid an assumption|決めつけを避ける',
		phrases:
			'Could we return to...?|…へ戻れますか？;I do not think we have covered...|…はまだ扱っていないと思います。',
		voiceTask: '長いresponse中の未回答questionを特定し、acknowledgmentを入れて丁寧に戻す。',
		skillTargets: ['listening', 'interaction', 'speaking', 'fluency'],
	},
	{
		day: 338,
		theme: '複数speakerのstanceをmap化する',
		objective: 'agreement line、difference、influenceを三者discussionから要約する',
		grammar: [
			'multi-speaker synthesis',
			'both A and B / unlike C / shifted afterを使う',
			'発言順を再現せず、立場の関係と変化を中心に再構成します。',
			'Both A and B support a trial, unlike C, who prefers more research first.',
			'B became more cautious after hearing the staffing estimate.',
			'三者のstance mapを口頭化する。',
			'Two speakers agree on the goal; one differs on timing, and another changed position when access was discussed.',
		],
		vocabulary: 'stance map|stanceの関係図;alignment|立場の一致;shift position|立場を変える',
		phrases:
			'Both speakers agree on..., but differ on...|両者は…で合意し…で異なります。;The position shifted after...|…の後で立場が変わりました。',
		voiceTask:
			'三者discussionを一度聞き、各stance、common ground、shift、unresolved pointを2分でsummaryする。',
		skillTargets: ['listening', 'speaking', 'fluency', 'vocabulary'],
	},
	{
		day: 339,
		theme: 'natural follow-upでdetailを深める',
		objective: '直前のanswerからwhy、example、impactを自然に選ぶ',
		grammar: [
			'responsive follow-up chains',
			'what led to / can you give an example / how did that affectを使う',
			'準備済みquestion listではなく、相手のkeywordを再利用して次のquestionを作ります。',
			'You mentioned trust; what led people to lose it?',
			'Can you give an example of how the delay affected users?',
			'answerから三段follow-upを作る。',
			'If the speaker says training was confusing, ask which part, what happened next, and what would have helped.',
		],
		vocabulary:
			'follow-up chain|follow-upの連鎖;pick up on|発言を拾う;deepen a point|pointを深める',
		phrases:
			'You mentioned... — could you say more?|…と言いましたが、詳しく話せますか？;How did that affect...?|それは…にどう影響しましたか？',
		voiceTask:
			'topic cardsなしで相手のanswerだけからfollow-upを五回連続し、最後に学んだことを要約する。',
		skillTargets: ['listening', 'interaction', 'speaking', 'fluency'],
	},
	{
		day: 340,
		theme: '自然なturn-takingで発言量を調整する',
		objective: '長すぎるturnを短く区切り、相手へinviteして再開する',
		grammar: [
			'turn-yielding and resuming',
			'what do you think / I can add more / to return toを使う',
			'長いanswerを一度閉じて相手のresponseを受け、必要なら元pointへ戻ります。',
			'That is the main reason; what do you think?',
			'To return to the example, I can add one detail about cost.',
			'長い説明を二turnに分ける。',
			'Give the position and one reason, invite a response, then add the example only if it is useful.',
		],
		vocabulary:
			'yield a turn|turnを譲る;resume a point|pointを再開する;interaction balance|会話量のbalance',
		phrases:
			'That is my main point. What do you think?|主なpointは以上です。どう思いますか？;To return to what I was saying,...|話を戻すと…。',
		voiceTask: '5分のprepared内容を独占せず複数turnへ分け、相手の反応に応じて順序を変える。',
		skillTargets: ['interaction', 'speaking', 'fluency', 'listening'],
	},
	{
		day: 341,
		theme: '軽いdisagreementをtoneで調整する',
		objective: 'words、stress、pauseを使ってfirmだが敵対的でないresponseにする',
		grammar: [
			'spoken disagreement nuance',
			'I am not sure that follows / I see it differently / my concern isを使う',
			'過度なapologyでpointを弱めず、相手のideaと人を分けて扱います。',
			'I see it differently because the trial included only experienced users.',
			'I am not sure that the result supports a full launch.',
			'firm but respectfulなdisagreementを作る。',
			'I understand the aim; my concern is that the evidence does not cover smaller teams.',
		],
		vocabulary: 'firm|はっきりした;respectful|相手を尊重する;tone control|tone調整',
		phrases:
			'I see that differently.|その点は異なる見方です。;My concern is not..., but...|懸念は…ではなく…です。',
		voiceTask:
			'同じdisagreementをtoo soft、too strong、balancedの三toneで言い、natural stressを調整する。',
		skillTargets: ['speaking', 'interaction', 'pronunciation', 'fluency'],
	},
	{
		day: 342,
		theme: 'speaker intentionをmultiple cluesで推測する',
		objective: 'word choice、example、omissionを組み合わせて意図の仮説を作る',
		grammar: [
			'inference from combined clues',
			'taken together / may indicate / another possibility isを使う',
			'単一clueで断定せず、複数のclueとalternative explanationを示します。',
			'Taken together, the repeated cost examples may indicate that he wants a smaller pilot.',
			'Another possibility is that he needs clearer figures before deciding.',
			'clueからintentionを二案作る。',
			'The positive opening and cautious ending may indicate conditional support rather than full agreement.',
		],
		vocabulary: 'combined clue|複合clue;indicate|示す;alternative interpretation|別解釈',
		phrases:
			'Taken together, these clues suggest...|clueを合わせると…を示します。;Another interpretation is...|別の解釈は…。',
		voiceTask: '2分発言からclue三つを取り、main inference、alternative、確認questionを述べる。',
		skillTargets: ['listening', 'speaking', 'interaction', 'grammar'],
	},
	{
		day: 343,
		theme: 'paraphraseでnuanceを保つ',
		objective: '強さ、条件、stanceを失わずに別のwordsで言い換える',
		grammar: [
			'nuance-preserving paraphrase',
			'generally / only if / not necessarilyを保持する',
			'短縮時にhedgeやconditionを落とすとmeaningが変わるため、核となるnuanceを先に見つけます。',
			'“Generally effective” does not mean “always works.”',
			'“Only if support remains” must keep the condition in the paraphrase.',
			'nuanceを保ったparaphraseを作る。',
			'The speaker is cautiously supportive, not fully convinced, and wants the trial limited to two months.',
		],
		vocabulary:
			'preserve nuance|nuanceを保つ;overstate|強く言いすぎる;conditional meaning|条件付きmeaning',
		phrases:
			'A careful paraphrase would be...|慎重なparaphraseは…。;I would not reduce that to...|それを…まで単純化しません。',
		voiceTask:
			'hedgingを含む発言八つをparaphraseし、originalよりstrong/weakになっていないか確認する。',
		skillTargets: ['listening', 'speaking', 'vocabulary', 'fluency'],
	},
	{
		day: 344,
		theme: '自然速度のdiscussionへ再参加する',
		objective: '一部を聞き逃してもsummary requestからrejoinする',
		grammar: [
			'rejoining after losing the thread',
			'I lost the part about / could you recap / if I follow correctlyを使う',
			'分かったふりをせず、どこまで理解したかを示して不足部分だけ補います。',
			'I followed the cost point but lost the part about staffing.',
			'Could you briefly recap what changed after the trial?',
			'discussionへrejoinする。',
			'If I follow correctly, we are comparing two schedules; could you recap why the first one was rejected?',
		],
		vocabulary: 'lose the thread|話の流れを見失う;recap|短く振り返る;rejoin|再参加する',
		phrases:
			'I followed..., but lost...|…は分かりましたが…を見失いました。;Could you briefly recap...?|…を短く振り返れますか？',
		voiceTask:
			'near-natural group discussionで意図的に一部を聞き逃し、targeted recap後に関連pointでrejoinする。',
		skillTargets: ['listening', 'interaction', 'speaking', 'fluency'],
	},
	{
		day: 345,
		theme: 'Unit 21 Nuance & Interaction Lab',
		objective: 'inference、stance、nuance、repair、turn-takingを自然な会話で統合する',
		grammar: [
			'nuanced interaction integration',
			'inference / calibrated hedging / paraphrase / repairを統合する',
			'正解を当てるより、推測を確認し、誤りなら自然に更新するinteractionを重視します。',
			'You sound cautiously supportive, although I may be reading too much into the example.',
			'If I have understood the condition correctly, the change would remain temporary.',
			'nuanceを確認しながらdiscussionを続ける。',
			'State a tentative inference, ask for confirmation, paraphrase the reply, and adjust your position.',
		],
		vocabulary:
			'nuanced interaction|nuanceのあるinteraction;tentative inference|暫定inference;conversational recovery|会話回復',
		phrases:
			'I may be reading too much into this, but...|考えすぎかもしれませんが…。;Have I understood the nuance correctly?|nuanceを正しく理解しましたか？',
		voiceTask:
			'18～20分のnear-natural interaction。stance inference、unknown wording、interruption、paraphrase、repair、final recapを含める。',
		skillTargets: [
			'listening',
			'speaking',
			'interaction',
			'fluency',
			'pronunciation',
			'vocabulary',
		],
	},
] as const satisfies readonly B2ChallengeLessonSeed[];

export const UNIT_21_LESSONS = buildB2ChallengeUnit(331, 345, seeds);
