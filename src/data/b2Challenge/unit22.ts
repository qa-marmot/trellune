import { buildB2ChallengeUnit, type B2ChallengeLessonSeed } from './shared';

const seeds = [
	{
		day: 346,
		theme: 'technology導入案をend-to-endで評価する',
		objective: 'need、benefit、risk、evidence、review条件を一つのdiscussionへ統合する',
		grammar: [
			'end-to-end proposal evaluation',
			'the need is / the evidence indicates / subject to reviewを使う',
			'各論点を列挙するだけでなく、evidenceがdecisionをどう支えるかをつなぎます。',
			'The need is clear, but the evidence supports only a limited launch.',
			'I would approve the trial subject to a four-week accessibility review.',
			'導入案を条件付きで評価する。',
			'The tool could reduce repeated work, although a small pilot should test support demand before wider adoption.',
		],
		vocabulary: 'end-to-end|初めから終わりまで;adoption|導入;review condition|review条件',
		phrases:
			'The evidence supports...|evidenceは…を支持します。;I would approve this subject to...|…を条件に承認します。',
		voiceTask:
			'20分のtechnology review。need、demo要約、risk、counterpoint、condition、decisionを扱う。',
		skillTargets: ['listening', 'speaking', 'interaction', 'fluency', 'grammar'],
	},
	{
		day: 347,
		theme: 'remote work方針を二者で共同設計する',
		objective: '異なるpriorityからtestableなshared policyを作る',
		grammar: [
			'co-designing a policy',
			'what if we / that would address / we could measureを使う',
			'妥協を曖昧にせず、action、owner、measure、review dateまで具体化します。',
			'What if we kept two shared days and allowed teams to choose a third?',
			'That would address coordination, and we could measure meeting delays.',
			'共同policyを作る。',
			'We could test two core hours for a month and review response time and employee feedback.',
		],
		vocabulary: 'co-design|共同設計;core hours|共通勤務時間;testable policy|検証可能な方針',
		phrases:
			'What if we combined...?|…を組み合わせたらどうですか？;That would address...|それは…に対応します。',
		voiceTask:
			'managerとstaffのpriorityを聞き、20分でpolicy、measure、exception、reviewを合意する。',
		skillTargets: ['listening', 'interaction', 'speaking', 'fluency'],
	},
	{
		day: 348,
		theme: '地域の交通案をpublicへ説明する',
		objective: '複雑なtrade-offを透明に説明し、批判的questionへ答える',
		grammar: [
			'public-facing explanation',
			'the proposal would / the reason is / we recognize thatを使う',
			'良い点だけでなく、誰が不便になるかとmitigationを同じ説明に含めます。',
			'The proposal would improve evening access because buses are currently limited after eight.',
			'We recognize that one daytime route would run less often, so the change would be reviewed monthly.',
			'交通案をpublic向けに説明する。',
			'The plan prioritizes hospital access while keeping a weekend connection for residents who rely on it.',
		],
		vocabulary: 'public explanation|public向け説明;mitigation|影響軽減;accountability|説明責任',
		phrases:
			'We recognize that...|…であることを認識しています。;To reduce that impact,...|その影響を減らすため…。',
		voiceTask: 'proposal説明5分とpublic Q&A15分。benefit、loss、mitigation、evidence gapを扱う。',
		skillTargets: ['speaking', 'interaction', 'listening', 'vocabulary'],
	},
	{
		day: 349,
		theme: 'learning platformの結果を批判的に読む',
		objective: 'reported improvementとcausationを区別し、追加dataを求める',
		grammar: [
			'correlation without causation',
			'was associated with / does not prove / would need to knowを使う',
			'同時に起きた変化を原因と断定せず、別要因と必要なevidenceを示します。',
			'Higher completion was associated with reminders, but that does not prove the reminders caused it.',
			'We would need to know whether the learners also received extra support.',
			'result claimを慎重に評価する。',
			'Scores rose after the update, although the data does not show whether content or practice time caused the change.',
		],
		vocabulary: 'association|関連;causation|因果関係;confounding factor|別の影響要因',
		phrases:
			'This is associated with..., but...|これは…と関連しますが…。;We would need to know whether...|…かどうか知る必要があります。',
		voiceTask:
			'study summaryを聞き、claim、evidence、alternative explanation、next dataを18分検討する。',
		skillTargets: ['listening', 'speaking', 'grammar', 'interaction'],
	},
	{
		day: 350,
		theme: '旅行troubleからservice改善を導く',
		objective: 'narrativeをsystem problemとactionable lessonへ変換する',
		grammar: [
			'narrative-to-recommendation bridge',
			'what happened showed / the underlying issue / thereforeを使う',
			'個人の不満を一般化せず、再発可能なprocess gapと具体策へつなぎます。',
			'What happened showed that delay information was available in only one channel.',
			'The underlying issue was access, so updates should also appear at the station.',
			'旅行episodeから改善を提案する。',
			'The missed connection revealed an unclear transfer process; therefore, signs should show the minimum transfer time.',
		],
		vocabulary:
			'underlying issue|根本のissue;actionable lesson|行動可能なlesson;service gap|serviceの不足',
		phrases:
			'What this experience revealed was...|この経験が示したのは…。;An actionable improvement would be...|実行可能な改善は…。',
		voiceTask:
			'travel troubleを4分storyで話し、root issue、user impact、service recommendationへ発展させる。',
		skillTargets: ['speaking', 'fluency', 'grammar', 'interaction'],
	},
	{
		day: 351,
		theme: 'AI generated summaryの欠落を見抜く',
		objective: 'original inputとsummaryを比較し、stanceやconditionのlossを指摘する',
		grammar: [
			'evaluating summary fidelity',
			'leaves out / changes the emphasis / needs to retainを使う',
			'語数だけでなく、originalのstance、condition、uncertaintyが保持されたかを確認します。',
			'The summary leaves out the condition that the trial remain voluntary.',
			'It changes the emphasis by presenting a cautious view as full support.',
			'summaryのfidelityを評価する。',
			'The shorter version needs to retain the speaker’s uncertainty about cost and the example about access.',
		],
		vocabulary: 'fidelity|原文への忠実さ;omit a condition|条件を省く;shift emphasis|強調を変える',
		phrases:
			'The summary leaves out...|summaryは…を省いています。;It changes the emphasis by...|…によって強調が変わっています。',
		voiceTask: 'original audioと二つのsummaryを比較し、missing nuanceを修復して90秒版を作る。',
		skillTargets: ['listening', 'speaking', 'vocabulary', 'fluency'],
	},
	{
		day: 352,
		theme: 'community conflictの共通needを探す',
		objective: '表面的positionの下にあるsafety、access、predictabilityを特定する',
		grammar: [
			'needs beneath positions',
			'behind that position / both sides need / could meet that needを使う',
			'要求そのものだけでなく、それを支えるneedを言い換えると新しいoptionを作れます。',
			'Behind the request for an earlier finish is a need for predictable quiet time.',
			'Both sides need safe access, although they propose different routes.',
			'positionsからunderlying needsを見つける。',
			'The shop owners want visibility and residents want calm; a daytime market could meet both needs.',
		],
		vocabulary:
			'underlying need|根底のneed;surface position|表面的position;shared interest|共通利益',
		phrases:
			'Behind that position is a need for...|そのpositionの背後には…のneedがあります。;Could another option meet both needs?|別案で両方のneedを満たせますか？',
		voiceTask:
			'community conflictの二者発言を聞き、positions、needs、shared interest、new optionを20分協議する。',
		skillTargets: ['listening', 'interaction', 'speaking', 'fluency'],
	},
	{
		day: 353,
		theme: 'incident updateでcertaintyを管理する',
		objective: 'known facts、working hypothesis、unknownsを明確に分ける',
		grammar: [
			'incident communication',
			'we know that / our current hypothesis / we have not confirmedを使う',
			'早いupdateでも推測をfactとして共有せず、次の確認時刻を示します。',
			'We know that local copies are safe.',
			'Our current hypothesis is a queue delay, but we have not confirmed the cause.',
			'incident statusを三層で伝える。',
			'We know the service is slow, we suspect a network limit, and we will confirm the next update at four.',
		],
		vocabulary: 'working hypothesis|作業仮説;confirmed fact|確認済みfact;next update|次回update',
		phrases:
			'What we know so far is...|今分かっているのは…。;We have not yet confirmed...|…はまだ確認していません。',
		voiceTask:
			'変化するincident情報を三回受け、各回90秒でfacts、hypothesis、unknowns、next actionを更新する。',
		skillTargets: ['listening', 'speaking', 'interaction', 'grammar'],
	},
	{
		day: 354,
		theme: '長いargumentのlogical gapを確認する',
		objective: 'conclusionへ飛んだstepを特定し、必要なassumptionを尋ねる',
		grammar: [
			'checking a reasoning gap',
			'how do we get from / this assumes that / is there evidence thatを使う',
			'結論全体を否定せず、つながりが弱い一stepだけを確認します。',
			'How do we get from higher interest to a need for a permanent service?',
			'This assumes that trial users represent the wider community.',
			'argumentのmissing stepを尋ねる。',
			'The conclusion assumes that lower cost will increase access; is there evidence that price is the main barrier?',
		],
		vocabulary: 'reasoning gap|論理のgap;assumption|前提;support a conclusion|結論を支える',
		phrases:
			'How do we get from... to...?|…から…へどうつながりますか？;This seems to assume that...|これは…を前提としているようです。',
		voiceTask:
			'three-part argumentを聞き、claim、evidence、gapをmap化しclarification questionを二つ作る。',
		skillTargets: ['listening', 'interaction', 'speaking', 'grammar'],
	},
	{
		day: 355,
		theme: '日常topicからabstract principleへ移る',
		objective: '具体的experienceを無理なくbroader lessonへ接続する',
		grammar: [
			'moving from example to principle',
			'this is one example of / more broadly / the lesson isを使う',
			'一例をuniversal ruleにせず、どの条件でbroader lessonが使えるかを限定します。',
			'This is one example of how unclear defaults can shape behavior.',
			'More broadly, the lesson is to make important choices visible.',
			'日常experienceからprincipleを述べる。',
			'The delayed bus is one example of why real-time information matters when people have limited alternatives.',
		],
		vocabulary:
			'broader principle|より広いprinciple;illustrate|例示する;scope a lesson|lessonの範囲を定める',
		phrases:
			'This is one example of...|これは…の一例です。;More broadly, the lesson is...|より広く言えばlessonは…。',
		voiceTask:
			'shopping、travel、workのepisodeからbroader lessonを作り、別のcontextへ適用できるか話す。',
		skillTargets: ['speaking', 'fluency', 'vocabulary', 'interaction'],
	},
	{
		day: 356,
		theme: 'sensitive feedbackをspecificにする',
		objective: 'personalityでなくobserved behavior、impact、requestへ絞る',
		grammar: [
			'behavior-impact-request feedback',
			'when / the effect was / next time could weを使う',
			'alwaysやcarelessを避け、変えられる行動と次のrequestを具体化します。',
			'When the deadline changed without a message, the team repeated work.',
			'Next time, could we confirm changes in the shared channel?',
			'sensitive feedbackを構造化する。',
			'When the explanation used several terms at once, new users became lost; could we add one example next time?',
		],
		vocabulary:
			'observed behavior|観察した行動;specific impact|具体的impact;actionable request|行動可能なrequest',
		phrases:
			'When..., the effect was...|…の時、影響は…でした。;Next time, could we...?|次回…できますか？',
		voiceTask:
			'work、team sport、volunteer場面のfeedbackをrole-playし、defensive responseへcalmにrepairする。',
		skillTargets: ['interaction', 'speaking', 'listening', 'fluency'],
	},
	{
		day: 357,
		theme: 'multiple constraintsでpriorityを再評価する',
		objective: '新情報ごとにdecision criteriaを明示してplanを更新する',
		grammar: [
			'dynamic reprioritization',
			'now that / given the new constraint / becomes less importantを使う',
			'ただ案を変えるのでなく、どのcriterionのweightが変わったかを説明します。',
			'Now that the budget is fixed, speed becomes less important than reliability.',
			'Given the new access constraint, the central venue is no longer the best option.',
			'新情報でpriorityを更新する。',
			'Because volunteer time is limited, a smaller weekly service is more realistic than a daily launch.',
		],
		vocabulary:
			'reprioritize|優先順位を変える;new constraint|新しいconstraint;decision criterion|判断criterion',
		phrases:
			'Given the new constraint,...|新しいconstraintを考えると…。;This changes the priority from... to...|priorityが…から…へ変わります。',
		voiceTask:
			'project scenarioへ新constraintが三回追加される。各回plan、reason、riskを更新して20分続ける。',
		skillTargets: ['listening', 'interaction', 'speaking', 'grammar'],
	},
	{
		day: 358,
		theme: 'spontaneous topic shiftをbridgeする',
		objective: 'unplanned topicを既存discussionへ関連付け、不要ならparkする',
		grammar: [
			'bridging or parking a topic',
			'that connects to / before we switch / could we parkを使う',
			'新topicを無条件に追わず、relevanceとtimeに応じて扱いを選びます。',
			'That connects to our access point because both depend on support hours.',
			'Could we park the funding question and finish the user flow first?',
			'topic shiftをmanageする。',
			'Before we switch to marketing, let us complete the safety decision and record marketing for later.',
		],
		vocabulary:
			'park a topic|topicを後回しにする;relevance|関連性;discussion flow|discussionのflow',
		phrases:
			'That connects to... because...|それは…に関連します。;Could we park that for later?|それは後で扱えますか？',
		voiceTask: '20分discussion中に予想外topicが四回入る。bridge、park、clarifyを適切に選ぶ。',
		skillTargets: ['interaction', 'listening', 'speaking', 'fluency'],
	},
	{
		day: 359,
		theme: 'B2 Challenge mockを自己評価する',
		objective: 'performanceをevidence、limitation、next targetで振り返る',
		grammar: [
			'evidence-based self-reflection',
			'I demonstrated / one limitation was / next I need toを使う',
			'感想やlevel labelでなく、実際のturn、repair、summaryをevidenceとして挙げます。',
			'I demonstrated interaction by returning to an unanswered point.',
			'One limitation was that my summary lost the speaker’s uncertainty.',
			'mock performanceをevidenceで振り返る。',
			'I sustained the discussion and paraphrased an unknown term; next I need to respond faster to indirect disagreement.',
		],
		vocabulary:
			'performance evidence|performanceのevidence;self-reflection|自己振り返り;next target|次のtarget',
		phrases:
			'Evidence for that is...|そのevidenceは…。;One limitation I noticed was...|気づいたlimitationは…。',
		voiceTask:
			'20分mock conversation後、evidence三つ、repair一つ、next target二つを4分で自己評価する。',
		skillTargets: ['speaking', 'fluency', 'interaction', 'grammar'],
	},
	{
		day: 360,
		theme: 'Unit 22 B2 Challenge Integration',
		objective:
			'opinion、inference、counterpoint、explanation、repairを20分超のdiscussionで統合する',
		grammar: [
			'B2 Challenge integration',
			'tense / clauses / conditionals / hedging / discourse markersを統合する',
			'文法項目をすべて使うのでなく、stanceを正確に伝えinteractionを前へ進める形を選びます。',
			'Although the pilot reduced waiting time, it may not have improved access for people without smartphones.',
			'If the next trial included phone booking, we would have better evidence for a wider launch.',
			'complex topicをmulti-turnで発展させる。',
			'Summarize the input, state a qualified position, address a counterpoint, explain one complex idea, repair a misunderstanding, and close with next evidence.',
		],
		vocabulary:
			'integrated performance|統合performance;qualified position|限定付きposition;sustained exchange|持続したexchange',
		phrases:
			'To connect these points,...|これらのpointをつなぐと…。;My final position, with that qualification, is...|その限定を含む最終positionは…。',
		voiceTask:
			'20～23分のB2 Challenge Integration。summary、stance、evidence、counterpoint、inference、paraphrase、repair、closingを行う。',
		skillTargets: ['listening', 'speaking', 'interaction', 'fluency', 'grammar', 'vocabulary'],
	},
] as const satisfies readonly B2ChallengeLessonSeed[];

export const UNIT_22_LESSONS = buildB2ChallengeUnit(346, 360, seeds);
