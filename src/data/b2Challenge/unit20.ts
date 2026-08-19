import { buildB2ChallengeUnit, type B2ChallengeLessonSeed } from './shared';

const seeds = [
	{
		day: 316,
		theme: 'agreementの範囲を明確にする',
		objective: '全面agreementと部分agreementを区別して次の論点へ進む',
		grammar: [
			'partial agreement markers',
			'I agree that / where I differ is / on that pointを使う',
			'共通点を先に示したうえで、異なる部分を一つに限定します。',
			'I agree that the service is useful; where I differ is how quickly it should expand.',
			'On the access point, we seem to agree completely.',
			'部分agreementからdifferenceへ移る。',
			'I agree that training is needed, but I differ on whether it must happen before the small trial.',
		],
		vocabulary: 'partial agreement|部分的agreement;point of difference|相違点;common ground|共通点',
		phrases: 'On that point, I agree.|その点は賛成です。;Where I differ is...|異なるのは…。',
		voiceTask: '四つの主張へfull、partial、disagreementを使い分け、各応答に理由と質問を加える。',
		skillTargets: ['listening', 'interaction', 'speaking', 'fluency'],
	},
	{
		day: 317,
		theme: 'counterargumentを脅威にせず受け取る',
		objective: '相手の強いpointを認め、自分のpositionを必要な範囲で修正する',
		grammar: [
			'responding to a strong counterargument',
			'that is a fair point / it changes / it does not removeを使う',
			'反対pointが何を変え、何を変えないかを分けるとdefensiveになりにくくなります。',
			'That is a fair point, and it changes how I view the timing.',
			'It does not remove the need for an offline option.',
			'counterargument後のpositionを更新する。',
			'Your example makes a full launch less attractive, although I still support a limited test.',
		],
		vocabulary: 'counterargument|反論;reconsider|再考する;revise a position|立場を修正する',
		phrases:
			'That is a fair point.|それは妥当なpointです。;It changes my view on...|…についての見方が変わります。',
		voiceTask: '自分のproposalにcounterargument三つを受け、影響を評価しpositionを一度修正する。',
		skillTargets: ['listening', 'interaction', 'speaking', 'grammar'],
	},
	{
		day: 318,
		theme: 'team decisionで少数意見を残す',
		objective: 'majority案を進めながら未解決の懸念を記録する',
		grammar: [
			'acknowledging a minority view',
			'most of us / a remaining concern / should be recordedを使う',
			'合意しなかった人を問題扱いせず、懸念をfuture reviewのevidenceとして保持します。',
			'Most of us support the trial, but a remaining concern is weekend support.',
			'That concern should be recorded and reviewed after the first month.',
			'majority decisionとminority concernを要約する。',
			'The team chose option A while recording one unresolved accessibility concern for the review.',
		],
		vocabulary:
			'minority view|少数意見;unresolved concern|未解決の懸念;record a concern|懸念を記録する',
		phrases:
			'A remaining concern is...|残る懸念は…。;We should record that for the review.|reviewのため記録すべきです。',
		voiceTask:
			'team discussionを聞き、decision、supporting reasons、minority concern、review actionを二分でまとめる。',
		skillTargets: ['listening', 'speaking', 'interaction', 'vocabulary'],
	},
	{
		day: 319,
		theme: '相手のevidenceへ具体的に質問する',
		objective: '攻撃的にならずsource、sample、comparisonを確認する',
		grammar: [
			'evidence clarification questions',
			'what is that based on / compared with / how representativeを使う',
			'「証拠は？」だけでなく、判断に必要な不足部分を具体的に尋ねます。',
			'What is that estimate based on?',
			'How representative were the users who joined the trial?',
			'claimのevidenceを確認する質問を作る。',
			'Compared with the previous month, how much did waiting time actually change?',
		],
		vocabulary: 'representative|代表性のある;basis|根拠;comparison group|比較対象',
		phrases:
			'What is that based on?|それは何に基づきますか？;Compared with what?|何と比較していますか？',
		voiceTask: '曖昧なclaim六つへevidence questionを作り、答えを受けてcertaintyを言い換える。',
		skillTargets: ['listening', 'interaction', 'speaking', 'grammar'],
	},
	{
		day: 320,
		theme: 'workloadをめぐる誤解を解く',
		objective: '意図と影響の違いを認め、共同でnext stepを作る',
		grammar: [
			'intent versus impact',
			'I did not intend / I can see that / what would helpを使う',
			'意図が悪くなかったことだけで終えず、相手が受けたimpactを認めます。',
			'I did not intend to add pressure, but I can see that the late change did.',
			'What would help us avoid this next time?',
			'workload misunderstandingをrepairする。',
			'I meant to offer flexibility, but the unclear deadline created more work; let us agree on one date now.',
		],
		vocabulary: 'intent|意図;impact|影響;acknowledge|認める',
		phrases:
			'I can see how that affected...|それが…へ影響したと分かります。;What would help next time?|次回何が役立ちますか？',
		voiceTask:
			'workplace misunderstandingをrole-playし、impact acknowledgment、clarification、agreementへ進む。',
		skillTargets: ['interaction', 'listening', 'speaking', 'fluency'],
	},
	{
		day: 321,
		theme: '社会的topicで断定を弱める',
		objective: '範囲の広いclaimをsome、often、mayで適切に限定する',
		grammar: [
			'responsible generalization',
			'some / tends to / may depend onを使う',
			'一つの例からeveryoneやalwaysへ飛ばず、対象と条件を明示します。',
			'Some commuters may benefit, especially on routes with limited evening service.',
			'The effect tends to depend on housing cost and access to work.',
			'広すぎるclaimを限定する。',
			'Online services can help many users, but the benefit may depend on device access and support.',
		],
		vocabulary:
			'generalization|一般化;qualify a claim|claimを限定する;depend on context|状況次第である',
		phrases:
			'This may be true for..., but...|…には当てはまるかもしれませんが…。;It depends partly on...|一部は…次第です。',
		voiceTask: '広いclaim五つを聞き、scope、condition、exceptionを加えてよりfairに言い直す。',
		skillTargets: ['listening', 'speaking', 'grammar', 'vocabulary'],
	},
	{
		day: 322,
		theme: 'discussionを途中で整理する',
		objective: '合意、相違、未回答questionを短くまとめて方向を戻す',
		grammar: [
			'mid-discussion synthesis',
			'so far / we agree on / still need to decideを使う',
			'会話を止めるためでなく、情報量が増えた時に共通のmapを作るため要約します。',
			'So far, we agree on the goal but not on the launch date.',
			'We still need to decide who will support users during the trial.',
			'長いdiscussionの途中summaryを作る。',
			'We agree that access matters; the open questions are cost, timing, and how feedback will be collected.',
		],
		vocabulary: 'open question|未回答のquestion;discussion map|議論のmap;refocus|焦点を戻す',
		phrases:
			'So far, we agree that...|ここまでは…で合意しています。;The remaining question is...|残るquestionは…。',
		voiceTask: '10分discussionの途中で二回summaryを入れ、相手に正確さをconfirmしてから続ける。',
		skillTargets: ['listening', 'speaking', 'interaction', 'fluency'],
	},
	{
		day: 323,
		theme: 'polite interruptionで要点を守る',
		objective: '長いturnへ配慮しつつclarificationや時間管理のために割り込む',
		grammar: [
			'functional interruption',
			'may I pause you / before we move on / could I clarifyを使う',
			'interruptionの目的を短く示し、相手のpointへ戻る約束をします。',
			'May I pause you for a moment to clarify the date?',
			'Before we move on, could I check one assumption?',
			'必要なinterruptionを行う。',
			'Could I briefly clarify what “support” includes, and then please continue with the cost point?',
		],
		vocabulary: 'interruption|割り込み;hold a thought|話の続き待つ;clarify briefly|短く確認する',
		phrases:
			'May I pause you for a moment?|少し止めてもよいですか？;Please continue with...|…の続きをお願いします。',
		voiceTask:
			'相手のlong turn中に三回、detail確認、misunderstanding防止、time管理のためpoliteにinterruptionする。',
		skillTargets: ['listening', 'interaction', 'speaking', 'fluency'],
	},
	{
		day: 324,
		theme: 'opposing perspectiveをrole-switchする',
		objective: '自分と異なる立場のbest caseを一度公平に主張する',
		grammar: [
			'perspective role-switch',
			'from this point of view / the strongest reason / even ifを使う',
			'弱い反対案を作るのではなく、その立場が最も重視する価値を中心にします。',
			'From the smaller team’s point of view, the strongest reason is simplicity.',
			'Even if advanced tools help later, setup cost matters now.',
			'反対立場を一分支持する。',
			'From residents’ perspective, predictable quiet hours may matter more than the event’s economic benefit.',
		],
		vocabulary: 'role-switch|立場を替える;strongest case|最も強い論拠;underlying value|根底の価値',
		phrases:
			'From that point of view,...|その視点からは…。;The strongest case for it is...|最も強い論拠は…。',
		voiceTask: '一つのtopicで自分の立場、opposite立場、両者の共通価値を順に話す。',
		skillTargets: ['speaking', 'interaction', 'fluency', 'vocabulary'],
	},
	{
		day: 325,
		theme: 'proposalのlanguageを共同編集する',
		objective: '曖昧または強すぎる表現を具体的で合意可能な文へ修正する',
		grammar: [
			'collaborative wording',
			'could we replace / would it be clearer if / by X we meanを使う',
			'wordingの修正を相手のidea否定とせず、meaningの精度を上げる共同作業にします。',
			'Could we replace “always available” with “available during support hours”?',
			'By “successful,” do we mean faster service or higher satisfaction?',
			'曖昧なproposal文を修正する。',
			'It would be clearer to say “review after four weeks” rather than “review soon.”',
		],
		vocabulary: 'wording|言い回し;ambiguous|曖昧な;measurable|測定可能な',
		phrases:
			'Would it be clearer if we said...?|…と言う方が明確ですか？;By..., do we mean...?|…とは…の意味ですか？',
		voiceTask: '短いproposalを相手と共同編集し、scope、measure、deadlineを明確にする15分のtask。',
		skillTargets: ['interaction', 'speaking', 'grammar', 'vocabulary'],
	},
	{
		day: 326,
		theme: '不一致の理由を分類する',
		objective: 'facts、values、risk toleranceのどこで異なるか診断する',
		grammar: [
			'diagnosing disagreement',
			'we differ on whether / our priorities differ / the evidence is unclearを使う',
			'同じ反論を繰り返す前に、不一致の種類を言語化して適切な次actionを選びます。',
			'We differ on whether the evidence is strong enough, not on the goal.',
			'Our priorities differ: you value speed, while I am more cautious about access.',
			'disagreement typeを特定する。',
			'The facts are not disputed; the disagreement is about how much risk is acceptable.',
		],
		vocabulary:
			'risk tolerance|risk許容度;value difference|価値の違い;factual dispute|事実上の争い',
		phrases:
			'We do not disagree about..., but about...|…ではなく…について異なります。;This seems to be a difference in priorities.|優先順位の違いのようです。',
		voiceTask:
			'三つのdisagreementを聞き、typeを診断し、data、compromise、clarificationのnext stepを選ぶ。',
		skillTargets: ['listening', 'interaction', 'speaking', 'vocabulary'],
	},
	{
		day: 327,
		theme: 'discussionのtoneからhesitationを読む',
		objective: 'pause、hedge、indirect wordingからcertaintyを推測して確認する',
		grammar: [
			'listening for hesitation',
			'seems hesitant / may not be fully convinced / sounds open toを使う',
			'toneの推測は断定せず、相手が訂正できる確認questionへつなぎます。',
			'She sounds open to the idea but not fully convinced about timing.',
			'The pause may show hesitation, although it could simply be a search for words.',
			'toneからstanceを仮に述べる。',
			'He seems cautious rather than opposed; I would ask which condition worries him most.',
		],
		vocabulary: 'hesitation|ためらい;fully convinced|十分納得した;indirect wording|遠回しな表現',
		phrases:
			'You sound a little unsure about...|…について少し迷っているようですが…。;Is timing the main concern?|時期が主な懸念ですか？',
		voiceTask: 'toneの異なるnear-natural発言を聞き、certaintyを推測してpressureのない確認を行う。',
		skillTargets: ['listening', 'interaction', 'speaking', 'pronunciation'],
	},
	{
		day: 328,
		theme: '時間制約のあるdecisionをまとめる',
		objective: '未解決点を隠さず、reversibleなnext stepを合意する',
		grammar: [
			'decision under uncertainty',
			'given the time / for now / revisit whenを使う',
			'完全な情報がない時は暫定decisionと再検討条件を明確にします。',
			'Given the time, we should choose the reversible option for now.',
			'We can revisit the decision when user feedback reaches fifty responses.',
			'暫定decisionを要約する。',
			'For now, we will run a two-week trial and revisit the schedule after the support data is available.',
		],
		vocabulary: 'reversible|元に戻せる;temporary decision|暫定decision;revisit|再検討する',
		phrases:
			'Given the time, for now we will...|時間を考え、当面は…。;We will revisit this when...|…の時に再検討します。',
		voiceTask:
			'10分のlimited-time meetingでoptionsを絞り、暫定decision、owner、review conditionを合意する。',
		skillTargets: ['interaction', 'speaking', 'listening', 'fluency'],
	},
	{
		day: 329,
		theme: 'debateを協働summaryへ戻す',
		objective: '勝敗でなくshared question、best evidence、next actionをまとめる',
		grammar: [
			'collaborative closing summary',
			'the discussion highlighted / both sides agree / next we needを使う',
			'相手のweak pointで締めず、残った判断材料と共通のnext stepを示します。',
			'The discussion highlighted a trade-off between speed and equal access.',
			'Both sides agree that a measured trial would provide better evidence.',
			'debate後のneutral summaryを作る。',
			'The strongest argument for expansion is convenience, while the main concern is support; next we need real usage data.',
		],
		vocabulary:
			'highlight|浮き彫りにする;neutral summary|中立summary;shared question|共通のquestion',
		phrases:
			'The discussion highlighted...|議論で…が明らかになりました。;Both sides agree that...|両側は…で合意しています。',
		voiceTask:
			'賛否の短いdebateを聞き、各側のstrongest point、common ground、next evidenceを2分でsummaryする。',
		skillTargets: ['listening', 'speaking', 'fluency', 'vocabulary'],
	},
	{
		day: 330,
		theme: 'Unit 20 Collaborative Discussion',
		objective: 'agreement、counterpoint、evidence question、repair、decisionを長い会話で統合する',
		grammar: [
			'collaborative discussion integration',
			'agreement markers / hedging / counterpoint / synthesisを統合する',
			'自分のturnを長くするより、相手のevidenceとstanceへ関連したresponseを積み重ねます。',
			'I agree with the goal, but the evidence does not yet show whether access will improve.',
			'Your example changes my view on timing, so I would support a smaller trial first.',
			'複数turnでpositionをrefineする。',
			'Begin with a qualified position, ask about evidence, address a counterpoint, and close with a shared next step.',
		],
		vocabulary:
			'collaborative discussion|協働discussion;refined position|改善された立場;shared next step|共通のnext step',
		phrases:
			'Building on your point,...|あなたのpointを発展させると…。;Can we agree on this next step?|このnext stepで合意できますか？',
		voiceTask:
			'17～20分のdiscussion。stance、counterpoint、evidence、interruption、repair、mid-summary、暫定decisionを含める。',
		skillTargets: ['listening', 'speaking', 'interaction', 'fluency', 'grammar', 'vocabulary'],
	},
] as const satisfies readonly B2ChallengeLessonSeed[];

export const UNIT_20_LESSONS = buildB2ChallengeUnit(316, 330, seeds);
