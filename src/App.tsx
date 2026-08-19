import { useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import {
	Navigate,
	Route,
	Routes,
	useLocation,
	useNavigate,
	useParams,
	useSearchParams,
} from 'react-router-dom';
import { CURRICULUM } from './data/curriculum';
import {
	AVAILABLE_CURRICULUM_TOTAL_DAYS,
	CURRICULUM_MANIFEST,
	type PracticeBlock,
	type PracticePrompt,
} from './curriculum';
import { AppShell, PageHeader, ProgressRing } from './components/AppShell';
import { Icon } from './components/Icon';
import { MAX_SESSION_SOURCE_BYTES, parseSession, SAMPLE_SESSION_JSON } from './lib/sessionImport';
import { isDemoMode } from './demo';
import { parseBaselineAssessment } from './lib/baselineImport';
import { MAX_ASSESSMENT_SOURCE_BYTES, parseStageAssessment } from './lib/assessmentImport';
import { BoostModeSchema, IanaTimeZoneSchema, SessionJsonSchema } from './lib/schemas';
import type { BoostMode } from './lib/schemas';
import {
	buildBaselinePrompt,
	buildBoostPrompt,
	buildCorePrompt,
	buildStudyContext,
	buildWeeklyPrompt,
	type LearnerPromptContext,
} from './domain/prompts';
import {
	CONVERSATION_PROVIDER_PRESETS,
	getConversationProviderPreset,
	type ConversationProviderId,
} from './agents/contract';
import { recommendBoost } from './domain/recommendations';
import { buildPracticeFeedbackPrompt } from './domain/practiceFeedback';
import {
	FOUNDATION_STAGE_ASSESSMENT,
	STAGE_ASSESSMENT_DEFINITIONS,
	buildStageAssessmentPrompt,
	type AssessmentSkill,
} from './domain/assessment';
import { addStudyDays, studyDateAt } from './domain/calendar';
import {
	discardUnresolvableBlockedSync,
	getSyncStatus,
	resolveSyncConflict,
	retryBlockedSync,
	syncNow,
	type SyncRunResult,
	type SyncStatusSummary,
} from './sync/service';
import {
	applyBackupPreview,
	assertBackupFileSize,
	backupFailureMessage,
	createBackupText,
	previewBackupText,
	type BackupPreview,
} from './storage/backup';
import { type AppData, useAppState } from './state/AppState';

type CoreDisplayStep = keyof AppData['core'];

function minuteRange([start, end]: readonly [number, number]): string {
	return start === end ? String(start) : `${start}–${end}`;
}

const OnboardingSetupSchema = z
	.object({
		learnerName: z.string().trim().min(1, '呼ばれたい名前を入力してください。').max(200),
		dailyMinutes: z.number().int().min(10).max(30),
		timeZone: IanaTimeZoneSchema,
		startDate: z.iso.date(),
	})
	.strict();
const LOCAL_DELETE_CONFIRMATION = '端末データを削除';

const coreSteps: Array<{
	key: CoreDisplayStep;
	title: string;
	detail: string;
	to: string;
	tone: string;
}> = [
	{
		key: 'reviews',
		title: '期限が来た復習',
		detail: '7枚 · 約5分',
		to: '/reviews',
		tone: 'cyan',
	},
	{
		key: 'grammar',
		title: '今日の文法',
		detail: 'be動詞で自己紹介',
		to: '/grammar',
		tone: 'pear',
	},
	{
		key: 'import',
		title: 'Core会話と結果取込',
		detail: '話した結果JSONを取り込む',
		to: '/voice',
		tone: 'lavender',
	},
];

function RequireOnboarding({ children }: { children: React.ReactNode }) {
	const { data } = useAppState();
	return data.onboarded ? children : <Navigate to="/onboarding" replace />;
}

function Onboarding() {
	const { data, operationError, update } = useAppState();
	const navigate = useNavigate();
	const [name, setName] = useState(data.learnerName);
	const [minutes, setMinutes] = useState(data.dailyMinutes);
	const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo';
	const [timeZone, setTimeZone] = useState(data.timeZone || browserTimeZone);
	const [startDate, setStartDate] = useState(() =>
		data.startDate ? data.startDate : studyDateAt(new Date(), timeZone),
	);
	const [errors, setErrors] = useState<Record<string, string>>({});
	return (
		<main className="onboarding-shell">
			<div className="onboarding-copy reveal">
				<span className="wordmark wordmark--standalone">
					<span className="wordmark__mark">TL</span>Trellune
				</span>
				<h1 tabIndex={-1}>話す日を、365日つづける。</h1>
				<p>毎日のCoreはひとつの画面に。FoundationからB2 Challengeへ、安全に積み上げます。</p>
				<ul className="onboarding-facts" aria-label="保存と連携について">
					<li>個人用・ローカル優先で、同期はあとから任意で選べます。</li>
					<li>音声と、貼り付けたJSONの原文は保存しません。</li>
					<li>会話AI連携は手動コピー＆ペーストだけで、外部AI APIを使いません。</li>
					<li>一度開いた主要画面と学習データはオフラインでも利用できます。</li>
				</ul>
				<div className="onboarding-track" aria-label="365日の構成">
					<span>
						1–90
						<br />
						<small>Foundation</small>
					</span>
					<span>
						91–180
						<br />
						<small>Independent</small>
					</span>
					<span>
						181–270
						<br />
						<small>Fluency</small>
					</span>
					<span>
						271–365
						<br />
						<small>B2 Challenge</small>
					</span>
				</div>
			</div>
			<form
				className="setup-card reveal"
				onSubmit={async (event) => {
					event.preventDefault();
					const parsed = OnboardingSetupSchema.safeParse({
						learnerName: name,
						dailyMinutes: minutes,
						timeZone,
						startDate,
					});
					if (!parsed.success) {
						const nextErrors: Record<string, string> = {};
						for (const issue of parsed.error.issues) {
							const field = String(issue.path[0] ?? 'form');
							if (!nextErrors[field]) {
								nextErrors[field] =
									field === 'timeZone'
										? '有効なIANAタイムゾーンを入力してください。'
										: field === 'startDate'
											? '開始日を入力してください。'
											: issue.message;
							}
						}
						setErrors(nextErrors);
						return;
					}
					setErrors({});
					const result = await update({ onboarded: true, ...parsed.data });
					if (result.ok) navigate('/baseline');
				}}
			>
				<h2>最初の設定</h2>
				<label className="field">
					<span>呼ばれたい名前</span>
					<input
						value={name}
						onChange={(event) => {
							setName(event.target.value);
							setErrors((current) => ({ ...current, learnerName: '' }));
						}}
						placeholder="例: Yabu"
						autoComplete="name"
						aria-invalid={Boolean(errors.learnerName)}
						aria-describedby="learner-name-help learner-name-error"
					/>
					<small id="learner-name-help">アプリ内だけに保存します。</small>
					{errors.learnerName ? (
						<small id="learner-name-error" className="field-error">
							{errors.learnerName}
						</small>
					) : null}
				</label>
				<fieldset className="choice-group">
					<legend>毎日の目安</legend>
					{[10, 20, 30].map((value) => (
						<label key={value} className={minutes === value ? 'choice is-selected' : 'choice'}>
							<input
								type="radio"
								name="minutes"
								value={value}
								checked={minutes === value}
								onChange={() => setMinutes(value)}
							/>
							<span>{value}分</span>
						</label>
					))}
				</fieldset>
				<label className="field">
					<span>学習タイムゾーン（IANA）</span>
					<input
						value={timeZone}
						onChange={(event) => {
							setTimeZone(event.target.value);
							setErrors((current) => ({ ...current, timeZone: '' }));
						}}
						list="time-zone-options"
						required
						aria-invalid={Boolean(errors.timeZone)}
						aria-describedby="time-zone-help time-zone-error"
					/>
					<datalist id="time-zone-options">
						<option value="Asia/Tokyo" />
						<option value="America/New_York" />
						<option value="Europe/London" />
						<option value="Australia/Sydney" />
					</datalist>
					<small id="time-zone-help">日付境界と復習時刻の計算に使います。</small>
					{errors.timeZone ? (
						<small id="time-zone-error" className="field-error">
							{errors.timeZone}
						</small>
					) : null}
				</label>
				<label className="field">
					<span>Day 1を始める日</span>
					<input
						type="date"
						value={startDate}
						onChange={(event) => {
							setStartDate(event.target.value);
							setErrors((current) => ({ ...current, startDate: '' }));
						}}
						required
						aria-invalid={Boolean(errors.startDate)}
						aria-describedby="start-date-help start-date-error"
					/>
					<small id="start-date-help">開始日前は学習記録を作りません。</small>
					{errors.startDate ? (
						<small id="start-date-error" className="field-error">
							{errors.startDate}
						</small>
					) : null}
				</label>
				<button className="button button--primary" type="submit">
					ベースラインへ
					<Icon name="arrow" />
				</button>
				<p className="form-note">
					アカウント作成はありません。学習データはこの端末から始まります。
				</p>
				{operationError ? (
					<p className="feedback is-error" role="alert">
						{operationError}
					</p>
				) : null}
			</form>
		</main>
	);
}

function Baseline() {
	const navigate = useNavigate();
	const { recordBaseline, setEditorDirty } = useAppState();
	const [source, setSource] = useState('');
	const [result, setResult] = useState<ReturnType<typeof parseBaselineAssessment> | null>(null);
	const [message, setMessage] = useState('');
	const [messageIsError, setMessageIsError] = useState(false);
	const byteLength = new TextEncoder().encode(source).byteLength;
	useEffect(() => {
		setEditorDirty(Boolean(source.trim()));
		return () => setEditorDirty(false);
	}, [setEditorDirty, source]);
	const validate = () => {
		const next = parseBaselineAssessment(source);
		setResult(next);
		setMessage('');
		setMessageIsError(next.errors.length > 0);
	};
	const save = async () => {
		if (!result?.assessment || result.errors.length) return;
		const saved = await recordBaseline(result.assessment);
		setMessage(saved.message);
		setMessageIsError(!saved.ok);
		if (saved.ok) {
			setEditorDirty(false);
			navigate('/today');
		}
	};
	return (
		<AppShell>
			<PageHeader
				title="話し始める前の記録"
				description="今の自分を測るだけ。点数でコースを短くしたり長くしたりはしません。"
			/>
			<section className="split-panel">
				<div className="surface surface--cyan">
					<h2>会話AIで8分話す</h2>
					<ol className="plain-steps">
						<li>自己紹介</li>
						<li>昨日したこと</li>
						<li>来週したいこと</li>
						<li>分からない時の聞き返し</li>
					</ol>
					<button className="button" type="button" onClick={() => navigate('/voice?mode=baseline')}>
						ベースライン用プロンプト
					</button>
				</div>
				<form
					className="surface"
					onSubmit={(event) => {
						event.preventDefault();
						validate();
					}}
				>
					<h2>評価JSONを確認して取り込む</h2>
					<p>Voice終了後に表示されたベースラインJSONを貼り付けます。SESSION_JSONとは別です。</p>
					<label className="field" htmlFor="baseline-json">
						<span>会話AIが返したベースラインJSON</span>
						<textarea
							id="baseline-json"
							value={source}
							onChange={(event) => {
								setSource(event.target.value);
								setResult(null);
								setMessage('');
							}}
							aria-invalid={Boolean(result?.errors.length)}
							aria-describedby="baseline-limit baseline-feedback"
						/>
						<small id="baseline-limit">
							入力上限 1MB（現在 {byteLength.toLocaleString('ja-JP')} /{' '}
							{MAX_SESSION_SOURCE_BYTES.toLocaleString('ja-JP')} bytes）
						</small>
					</label>
					<button className="button button--primary" type="submit">
						検証してプレビュー
					</button>
					<div id="baseline-feedback" aria-live="polite">
						{result?.errors.length ? (
							<div className="error-box" role="alert">
								<strong>保存できません</strong>
								<ul>
									{result.errors.map((error) => (
										<li key={error}>{error}</li>
									))}
								</ul>
							</div>
						) : result?.assessment ? (
							<div className="preview-data">
								<p>5観点と自己評価を確認しました。保存前は端末データを変更していません。</p>
								<dl>
									<dt>自信</dt>
									<dd>{result.assessment.confidence}/5</dd>
									<dt>課題達成 / 文法 / 語彙 / 流暢さ / やり取り</dt>
									<dd>
										{result.assessment.taskCompletion} / {result.assessment.grammar} /{' '}
										{result.assessment.vocabulary} / {result.assessment.fluency} /{' '}
										{result.assessment.interaction}
									</dd>
								</dl>
								<button
									className="button button--primary"
									type="button"
									onClick={() => void save()}
								>
									評価を保存してDay 1へ
								</button>
							</div>
						) : null}
					</div>
					<button className="button" type="button" onClick={() => navigate('/today')}>
						Day 1を始める（今回はスキップ）
					</button>
					{message ? (
						<p
							className={`feedback${messageIsError ? ' is-error' : ' is-success'}`}
							role={messageIsError ? 'alert' : 'status'}
						>
							{message}
						</p>
					) : null}
				</form>
			</section>
		</AppShell>
	);
}

const assessmentSkillLabels: Record<AssessmentSkill, string> = {
	grammar: '文法',
	vocabulary: '語彙',
	speaking: '発話',
	fluency: '流暢さ',
	interaction: 'やり取り',
	listening: '聞き取り',
	pronunciation: '発音',
	reading: '読解',
	writing: '作文',
};

const assessmentResultLabels = {
	pass: 'Pass',
	provisional: '暫定評価',
	'reinforcement-recommended': '補強を推奨',
} as const;

function StageAssessmentPage() {
	const { data, recordStageAssessment, setEditorDirty } = useAppState();
	const availableDefinitions = STAGE_ASSESSMENT_DEFINITIONS.filter(
		(definition) =>
			definition === FOUNDATION_STAGE_ASSESSMENT ||
			data.currentDay >= definition.curriculumRange.endDay,
	);
	const initialDefinition = availableDefinitions.at(-1) ?? FOUNDATION_STAGE_ASSESSMENT;
	const [assessmentId, setAssessmentId] = useState(initialDefinition.assessmentId);
	const definition =
		availableDefinitions.find((candidate) => candidate.assessmentId === assessmentId) ??
		FOUNDATION_STAGE_ASSESSMENT;
	const [attemptId, setAttemptId] = useState('');
	const [source, setSource] = useState('');
	const [result, setResult] = useState<ReturnType<typeof parseStageAssessment> | null>(null);
	const [message, setMessage] = useState('');
	const [messageIsError, setMessageIsError] = useState(false);
	const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
	const prompt = useMemo(() => {
		if (!attemptId) return '';
		const relevantMistakes = [...data.mistakes]
			.sort((left, right) => right.repetitions - left.repetitions)
			.slice(0, 10)
			.map(({ original, correction, repetitions }) => ({
				original,
				correction,
				repetitions,
			}));
		return buildStageAssessmentPrompt(definition, attemptId, {
			learnerName: data.learnerName || 'Learner',
			goal: data.goal,
			currentDay: data.currentDay,
			completedDays: data.completedDays.length,
			repeatedWeaknesses: relevantMistakes
				.filter((mistake) => mistake.repetitions >= 3)
				.map((mistake) => `${mistake.original} → ${mistake.correction}`),
			relevantMistakes,
		});
	}, [
		attemptId,
		definition,
		data.completedDays.length,
		data.currentDay,
		data.goal,
		data.learnerName,
		data.mistakes,
	]);
	const byteLength = new TextEncoder().encode(source).byteLength;
	useEffect(() => {
		setEditorDirty(Boolean(source.trim()));
		return () => setEditorDirty(false);
	}, [setEditorDirty, source]);
	const validate = () => {
		const next = parseStageAssessment(source);
		setResult(next);
		setMessage('');
		setMessageIsError(next.errors.length > 0);
	};
	const save = async () => {
		if (!result?.assessment || result.errors.length) return;
		const saved = await recordStageAssessment(result.assessment);
		setMessage(saved.message);
		setMessageIsError(!saved.ok);
		if (saved.ok) {
			setSource('');
			setResult(null);
			setEditorDirty(false);
		}
	};
	const copyPrompt = async () => {
		try {
			await navigator.clipboard.writeText(prompt);
			setCopyStatus('copied');
			window.setTimeout(() => setCopyStatus('idle'), 2_500);
		} catch {
			setCopyStatus('failed');
		}
	};
	return (
		<AppShell>
			<PageHeader
				title="Stage Assessment"
				description="Stageごとのtask evidenceを保存します。Graduationは8技能を統合して推定し、正式なCEFR認定やCoreのlockには使いません。"
			/>
			{availableDefinitions.length > 1 ? (
				<div className="phase-tabs" role="tablist" aria-label="Assessment Stage">
					{availableDefinitions.map((candidate) => (
						<button
							key={candidate.assessmentId}
							type="button"
							className={candidate.assessmentId === definition.assessmentId ? 'is-active' : ''}
							role="tab"
							aria-selected={candidate.assessmentId === definition.assessmentId}
							onClick={() => {
								setAssessmentId(candidate.assessmentId);
								setAttemptId('');
								setSource('');
								setResult(null);
								setMessage('');
							}}
						>
							{candidate.title}
						</button>
					))}
				</div>
			) : null}
			<section className="surface surface--cyan">
				<p className="eyebrow">
					{definition.title.toUpperCase()} · DAY {definition.curriculumRange.startDay}–
					{definition.curriculumRange.endDay} · TARGET {definition.targetCefr} ESTIMATE
				</p>
				<h2>{definition.title}</h2>
				<p>
					評価対象:{' '}
					{definition.requiredSkills.map((skill) => assessmentSkillLabels[skill]).join('・')}
				</p>
				{definition.skillRubrics ? (
					<details className="assessment-rubric">
						<summary>1–5 rubricとCEFR推定条件を確認</summary>
						<div className="assessment-rubric__content">
							{definition.requiredSkills.map((skill) => (
								<section key={skill}>
									<h3>{assessmentSkillLabels[skill]}</h3>
									<ol>
										{definition.skillRubrics?.[skill]?.map((descriptor, index) => (
											<li key={descriptor}>
												<strong>{index + 1}</strong> {descriptor}
											</li>
										))}
									</ol>
								</section>
							))}
							{definition.cefrEstimateGuardrails ? (
								<div className="assessment-guardrail">
									<strong>Profile guardrail</strong>
									<p>
										B2-entryは全skill {definition.cefrEstimateGuardrails.b2EntryMinimumScore}
										/5以上、B2はpassかつ全skill {definition.cefrEstimateGuardrails.b2MinimumScore}
										/5以上が必要です。平均点で弱いskillを隠しません。
									</p>
								</div>
							) : null}
						</div>
					</details>
				) : null}
				{definition.cefrEstimateScope === 'spoken' ? (
					<p>
						このAssessmentのCEFR推定は会話・Listening中心です。Reading/Writingを含むfull
						CEFRの認定・保証には使用しません。
					</p>
				) : definition.cefrEstimateScope === 'integrated' ? (
					<p>
						Reading・Writing・Listening・会話のtask
						evidenceを統合して推定します。日数やpassだけでは判定せず、正式なCEFR認定でもありません。
					</p>
				) : null}
				<button
					className="button button--primary"
					type="button"
					onClick={() => {
						setAttemptId(crypto.randomUUID());
						setCopyStatus('idle');
					}}
				>
					{attemptId ? '新しいAssessmentを開始' : 'Assessmentを開始'}
				</button>
			</section>
			{prompt ? (
				<section className="prompt-panel">
					<div className="prompt-panel__head">
						<div>
							<span>コピー専用</span>
							<h2>Stage Assessment prompt</h2>
						</div>
						<button className="button" type="button" onClick={() => void copyPrompt()}>
							<Icon name="copy" /> {copyStatus === 'copied' ? 'コピー済み' : 'コピー'}
						</button>
					</div>
					<pre>{prompt}</pre>
					<p>
						先にこのテキストを送信し、その後Voiceを開始します。終了後にASSESSMENT_JSONを明示的に依頼してください。
					</p>
					{copyStatus === 'failed' ? (
						<p className="feedback is-error">コピーできませんでした。</p>
					) : null}
				</section>
			) : null}
			<form
				className="surface"
				onSubmit={(event) => {
					event.preventDefault();
					validate();
				}}
			>
				<h2>ASSESSMENT_JSONを確認して取り込む</h2>
				<label className="field" htmlFor="assessment-json">
					<span>会話AIが返したASSESSMENT_JSON</span>
					<textarea
						id="assessment-json"
						value={source}
						onChange={(event) => {
							setSource(event.target.value);
							setResult(null);
							setMessage('');
						}}
						aria-invalid={Boolean(result?.errors.length)}
						aria-describedby="assessment-limit assessment-feedback"
					/>
					<small id="assessment-limit">
						入力上限 1MB（現在 {byteLength.toLocaleString('ja-JP')} /{' '}
						{MAX_ASSESSMENT_SOURCE_BYTES.toLocaleString('ja-JP')} bytes）
					</small>
				</label>
				<button className="button button--primary" type="submit">
					検証してプレビュー
				</button>
				<div id="assessment-feedback" aria-live="polite">
					{result?.warnings.map((warning) => (
						<p key={warning}>{warning}</p>
					))}
					{result?.errors.length ? (
						<div className="error-box" role="alert">
							<strong>保存できません</strong>
							<ul>
								{result.errors.map((error) => (
									<li key={error}>{error}</li>
								))}
							</ul>
						</div>
					) : result?.assessment ? (
						<div className="preview-data">
							<dl>
								<dt>結果</dt>
								<dd>{assessmentResultLabels[result.assessment.result]}</dd>
								{result.assessment.cefrEstimate ? (
									<>
										<dt>
											{result.assessment.cefrEstimateScope === 'integrated'
												? '統合8技能CEFR推定（認定ではありません）'
												: '会話・Listening中心の推定（full CEFR認定ではありません）'}
										</dt>
										<dd>{result.assessment.cefrEstimate}</dd>
									</>
								) : null}
								<dt>評価されたskills</dt>
								<dd>
									{(Object.entries(result.assessment.scores) as Array<[AssessmentSkill, number]>)
										.map(([skill, score]) => `${assessmentSkillLabels[skill]} ${score}/5`)
										.join(' · ')}
								</dd>
								<dt>Strengths</dt>
								<dd>{result.assessment.strengths.join(' / ') || 'なし'}</dd>
								<dt>Reinforcement targets</dt>
								<dd>{result.assessment.reinforcementTargets.join(' / ') || 'なし'}</dd>
								<dt>Evidence</dt>
								<dd>{result.assessment.evidence.map((item) => item.note).join(' / ') || 'なし'}</dd>
								<dt>Next targets</dt>
								<dd>{result.assessment.nextTargets.join(' / ') || 'なし'}</dd>
							</dl>
							<button className="button button--primary" type="button" onClick={() => void save()}>
								Assessmentを保存
							</button>
						</div>
					) : null}
				</div>
				{message ? (
					<p
						className={`feedback${messageIsError ? ' is-error' : ' is-success'}`}
						role={messageIsError ? 'alert' : 'status'}
					>
						{message}
					</p>
				) : null}
			</form>
			<section className="session-list" aria-labelledby="assessment-history-title">
				<h2 id="assessment-history-title">Attempt history</h2>
				{data.stageAssessments.length ? (
					data.stageAssessments.map((assessment) => (
						<article key={assessment.attemptId}>
							<div>
								<strong>{assessmentResultLabels[assessment.result]}</strong>
								{assessment.cefrEstimate ? (
									<span>
										{assessment.cefrEstimateScope === 'integrated'
											? '統合8技能CEFR推定'
											: '会話・Listening中心の推定'}{' '}
										{assessment.cefrEstimate}（認定ではありません）
									</span>
								) : null}
								<p>
									{new Date(assessment.completedAt).toLocaleString('ja-JP')} ·{' '}
									{Object.keys(assessment.scores)
										.map((skill) => assessmentSkillLabels[skill as AssessmentSkill])
										.join('・')}
								</p>
							</div>
							<strong>{assessment.strengths.join(' / ') || '記録済み'}</strong>
						</article>
					))
				) : (
					<div className="empty-state">
						<p>保存済みのStage Assessmentはありません。</p>
					</div>
				)}
			</section>
		</AppShell>
	);
}

function Today() {
	const { data } = useAppState();
	const navigate = useNavigate();
	const current = CURRICULUM[data.currentDay - 1] ?? CURRICULUM[0];
	const currentLesson = CURRICULUM_MANIFEST.lessons[data.currentDay - 1];
	const currentPracticeMinutes =
		currentLesson?.practiceBlocks.reduce((sum, block) => sum + block.estimatedMinutes, 0) ?? 0;
	const currentStage = CURRICULUM_MANIFEST.stages.find(
		(stage) => stage.startDay <= data.currentDay && data.currentDay <= stage.endDay,
	);
	const completed = Object.values(data.core).filter(Boolean).length;
	const percent = Math.round((completed / 3) * 100);
	const nextCoreStep = coreSteps.find((step) => !data.core[step.key]);
	if (data.studyStatus === 'before-start') {
		return (
			<AppShell>
				<PageHeader
					title="開始日を待っています"
					description={`Day 1は${data.startDate ?? '設定した日'}から始まります。設定画面で変更できます。`}
				/>
			</AppShell>
		);
	}
	if (data.studyStatus === 'graduated') {
		const canBoostToday = Object.values(data.core).every(Boolean);
		return (
			<AppShell>
				<PageHeader
					title={`${AVAILABLE_CURRICULUM_TOTAL_DAYS}日間を修了しました`}
					description={`新しいCore日は作成しません。履歴・ライブラリ・分析は引き続き確認できます。Day ${AVAILABLE_CURRICULUM_TOTAL_DAYS}を今日完了した場合は、その日のBoostだけ利用できます。`}
				/>
				{canBoostToday ? (
					<button className="button button--dark" type="button" onClick={() => navigate('/boost')}>
						Day {AVAILABLE_CURRICULUM_TOTAL_DAYS}のBoostを選ぶ
					</button>
				) : null}
			</AppShell>
		);
	}
	return (
		<AppShell>
			<section className="today-hero reveal">
				<div className="today-hero__copy">
					<p className="day-label">
						DAY {String(data.currentDay).padStart(2, '0')} · WEEK {current.week}
					</p>
					<h1 tabIndex={-1}>{current.theme}</h1>
					<p>{current.objective}</p>
					<div className="today-meta">
						<span>
							<Icon name="clock" />
							{currentStage && currentStage.startDay > 90
								? `Core ${minuteRange(currentStage.timeGuidance.minimumCoreMinutes)}分 · 推奨${minuteRange(currentStage.timeGuidance.recommendedMinutes)}分`
								: `約${data.dailyMinutes}分`}
						</span>
						<span>{data.streak}日連続</span>
					</div>
					{nextCoreStep ? (
						<button
							className="button button--primary today-next-action"
							type="button"
							onClick={() => navigate(nextCoreStep.to)}
						>
							次へ · {nextCoreStep.title}
						</button>
					) : null}
				</div>
				<ProgressRing value={percent} label="Core" />
			</section>
			<section className="core-section">
				<div className="section-heading">
					<div>
						<h2>今日のCore</h2>
						<p>3つの証跡がそろうと今日の学習が完了します。</p>
					</div>
					<strong>{completed}/3</strong>
				</div>
				<div className="core-list">
					{coreSteps.map((step, index) => (
						<button
							key={step.key}
							className={`core-step tone-${step.tone}${data.core[step.key] ? ' is-complete' : ''}`}
							type="button"
							aria-label={`${step.title} · ${data.core[step.key] ? '完了' : '未完了'}`}
							onClick={() => navigate(step.to)}
						>
							<span className="core-step__number">
								{data.core[step.key] ? <Icon name="check" /> : index + 1}
							</span>
							<span>
								<strong>{step.title}</strong>
								<small>
									{step.key === 'grammar' && currentPracticeMinutes > 0
										? `${current.grammar.title} · Non-Voice練習 ${currentPracticeMinutes}分`
										: step.detail}
								</small>
							</span>
							<Icon name="arrow" className="core-step__arrow" />
						</button>
					))}
				</div>
			</section>
			<section className="boost-strip">
				<div>
					<h2>{percent === 100 ? 'まだ話せそう？' : 'BoostはCoreのあとで'}</h2>
					<p>追加学習は任意です。しなくても失敗にはなりません。</p>
				</div>
				<button
					className="button button--dark"
					type="button"
					disabled={percent !== 100}
					onClick={() => navigate('/boost')}
				>
					Boostを選ぶ
				</button>
			</section>
		</AppShell>
	);
}

function Curriculum() {
	const { data } = useAppState();
	const navigate = useNavigate();
	const initialStage =
		CURRICULUM_MANIFEST.stages.find(
			(stage) => stage.startDay <= data.currentDay && data.currentDay <= stage.endDay,
		) ?? CURRICULUM_MANIFEST.stages[0]!;
	const [stageId, setStageId] = useState(initialStage.id);
	const stage =
		CURRICULUM_MANIFEST.stages.find((candidate) => candidate.id === stageId) ?? initialStage;
	const units = CURRICULUM_MANIFEST.units.filter((unit) => unit.stageId === stage.id);
	const selectedStageContainsCurrentDay =
		stage.startDay <= data.currentDay && data.currentDay <= stage.endDay;
	return (
		<AppShell>
			<PageHeader
				title={`${AVAILABLE_CURRICULUM_TOTAL_DAYS}日の地図`}
				description="先取りはpreviewedとして記録されます。未来のCore完了にはなりません。"
				action={
					<button className="button" type="button" onClick={() => navigate('/assessment')}>
						Stage Assessment
					</button>
				}
			/>
			<div className="phase-tabs" role="tablist" aria-label="学習Stage">
				{CURRICULUM_MANIFEST.stages.map((item, index) => (
					<button
						key={item.id}
						id={`phase-tab-${index}`}
						className={stage.id === item.id ? 'is-active' : ''}
						role="tab"
						aria-selected={stage.id === item.id}
						aria-controls="curriculum-phase-panel"
						tabIndex={stage.id === item.id ? 0 : -1}
						onClick={() => setStageId(item.id)}
						onKeyDown={(event) => {
							if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
							event.preventDefault();
							const direction = event.key === 'ArrowRight' ? 1 : -1;
							const next =
								(index + direction + CURRICULUM_MANIFEST.stages.length) %
								CURRICULUM_MANIFEST.stages.length;
							setStageId(CURRICULUM_MANIFEST.stages[next]!.id);
							document.getElementById(`phase-tab-${next}`)?.focus();
						}}
					>
						{item.title} · {item.startDay}–{item.endDay}
					</button>
				))}
			</div>
			<div
				id="curriculum-phase-panel"
				className="curriculum-list"
				role="tabpanel"
				aria-labelledby={`phase-tab-${CURRICULUM_MANIFEST.stages.indexOf(stage)}`}
			>
				<p className="curriculum-stage-guidance">
					Core {minuteRange(stage.timeGuidance.minimumCoreMinutes)}分 · 推奨
					{minuteRange(stage.timeGuidance.recommendedMinutes)}分 · Boost込み最大
					{stage.timeGuidance.maximumWithBoostMinutes}分
				</p>
				{selectedStageContainsCurrentDay ? (
					<button
						className="button curriculum-current-action"
						type="button"
						onClick={() => navigate(`/curriculum/${data.currentDay}`)}
					>
						Day {data.currentDay}へ戻る
					</button>
				) : null}
				{units.map((unit, unitIndex) => {
					const containsCurrentDay =
						unit.startDay <= data.currentDay && data.currentDay <= unit.endDay;
					return (
						<details
							className="curriculum-unit"
							key={unit.id}
							open={containsCurrentDay || (!selectedStageContainsCurrentDay && unitIndex === 0)}
						>
							<summary>
								<div>
									<h2>{unit.title}</h2>
									<p>
										Day {unit.startDay}–{unit.endDay}
									</p>
								</div>
								<span>{containsCurrentDay ? '現在のUnit' : '開く'}</span>
							</summary>
							<div className="curriculum-unit__days">
								{CURRICULUM.filter((day) => unit.startDay <= day.day && day.day <= unit.endDay).map(
									(day) => {
										const status = data.completedDays.includes(day.day)
											? '完了'
											: day.day === data.currentDay
												? '今日'
												: data.previewedDays.includes(day.day)
													? '予習済み'
													: '未着手';
										return (
											<button
												key={day.day}
												className={`curriculum-row status-${status}`}
												type="button"
												onClick={() => navigate(`/curriculum/${day.day}`)}
											>
												<span className="curriculum-row__day">
													{String(day.day).padStart(2, '0')}
												</span>
												<span>
													<strong>{day.theme}</strong>
													<small>{day.grammar.title}</small>
												</span>
												<span className="status-chip">{status}</span>
											</button>
										);
									},
								)}
							</div>
						</details>
					);
				})}
			</div>
		</AppShell>
	);
}

function CurriculumDetail() {
	const params = useParams();
	const { data } = useAppState();
	const dayNumber = Number(params.day ?? data.currentDay);
	const day = CURRICULUM[dayNumber - 1] ?? CURRICULUM[0];
	const lesson = CURRICULUM_MANIFEST.lessons[day.day - 1];
	return (
		<AppShell>
			<PageHeader title={`Day ${day.day} · ${day.theme}`} description={day.objective} />
			<div className="detail-grid">
				<article className="surface surface--pear">
					<h2>{day.grammar.title}</h2>
					<p>{day.grammar.focus}</p>
				</article>
				<article className="surface">
					<h2>単語</h2>
					<p>{day.vocabulary.map((item) => item.text).join(' · ')}</p>
				</article>
				<article className="surface">
					<h2>定型表現</h2>
					<ul>
						{day.phrases.map((item) => (
							<li key={item.id}>{item.text}</li>
						))}
					</ul>
				</article>
				<article className="surface surface--coral">
					<h2>Voice課題</h2>
					<p>{day.voiceTask}</p>
				</article>
			</div>
			{lesson?.practiceBlocks.length ? (
				<section className="practice-library" aria-labelledby="practice-library-title">
					<div className="section-heading">
						<div>
							<p className="eyebrow">Non-Voice practice</p>
							<h2 id="practice-library-title">読む・書く・使い直す</h2>
						</div>
						<p>
							目安 {lesson.practiceBlocks.reduce((sum, block) => sum + block.estimatedMinutes, 0)}分
						</p>
					</div>
					<div className="practice-block-list">
						{lesson.practiceBlocks.map((block) => (
							<article className="practice-block" key={block.id}>
								<p className="eyebrow">{block.kind}</p>
								<h3>{block.title}</h3>
								<p>{block.instructions}</p>
								{block.sourceText ? <blockquote lang="en">{block.sourceText}</blockquote> : null}
								<ol className="practice-prompt-list">
									{block.prompts.map((prompt) => (
										<li key={prompt.id}>
											<span>{prompt.prompt}</span>
											{prompt.output ? (
												<small>
													英語 {prompt.output.minimumWords}〜{prompt.output.maximumWords}語
												</small>
											) : null}
										</li>
									))}
								</ol>
								{block.output ? (
									<p className="practice-meta">
										英語 {block.output.minimumWords}〜{block.output.maximumWords}語 ·{' '}
										{block.estimatedMinutes}分
									</p>
								) : null}
							</article>
						))}
					</div>
				</section>
			) : null}
			{day.day > data.currentDay ? (
				<p className="feedback">
					未来日の文法予習は、Core完了後のNext Lesson Previewから記録します。
				</p>
			) : null}
		</AppShell>
	);
}

function countEnglishWords(value: string): number {
	return value.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/gu)?.length ?? 0;
}

function practiceBlockWordCount(block: PracticeBlock, responses: Record<string, string>): number {
	return block.prompts.reduce(
		(total, prompt) => total + countEnglishWords(responses[prompt.id] ?? ''),
		0,
	);
}

function practicePromptIsReady(prompt: PracticePrompt, response: string): boolean {
	if (!response.trim()) return false;
	if (
		prompt.expectedAnswer !== undefined &&
		response.normalize('NFKC').trim().toLocaleLowerCase('en-US') !==
			prompt.expectedAnswer.normalize('NFKC').trim().toLocaleLowerCase('en-US')
	)
		return false;
	if (!prompt.output) return true;
	const words = countEnglishWords(response);
	return words >= prompt.output.minimumWords && words <= prompt.output.maximumWords;
}

function practiceBlockIsReady(block: PracticeBlock, responses: Record<string, string>): boolean {
	if (block.prompts.some((prompt) => !practicePromptIsReady(prompt, responses[prompt.id] ?? '')))
		return false;
	if (!block.output) return true;
	const words = practiceBlockWordCount(block, responses);
	return words >= block.output.minimumWords && words <= block.output.maximumWords;
}

function practiceBlockIsReviewed(
	block: PracticeBlock,
	revealed: Record<string, boolean>,
	checks: Record<string, readonly string[]>,
): boolean {
	return block.prompts.every(
		(prompt) => revealed[prompt.id] === true && checks[prompt.id]?.includes('reviewed') === true,
	);
}

function Grammar() {
	const { data, completeStep } = useAppState();
	const day = CURRICULUM[data.currentDay - 1] ?? CURRICULUM[0];
	const lesson = CURRICULUM_MANIFEST.lessons[day.day - 1];
	const practiceBlocks = lesson?.practiceBlocks ?? [];
	const stage = CURRICULUM_MANIFEST.stages.find(
		(candidate) => candidate.startDay <= day.day && day.day <= candidate.endDay,
	)!;
	const [answer, setAnswer] = useState('');
	const [checked, setChecked] = useState(false);
	const [practiceVisible, setPracticeVisible] = useState(false);
	const [practiceAttempted, setPracticeAttempted] = useState(false);
	const [practiceResponses, setPracticeResponses] = useState<Record<string, string>>({});
	const [practiceInitialResponses, setPracticeInitialResponses] = useState<Record<string, string>>(
		{},
	);
	const [practiceFeedbackRevealed, setPracticeFeedbackRevealed] = useState<Record<string, boolean>>(
		{},
	);
	const [practiceChecks, setPracticeChecks] = useState<Record<string, readonly string[]>>({});
	const [practiceCopyId, setPracticeCopyId] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string } | null>(null);
	const normalizeAnswer = (value: string) =>
		value.normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/gu, ' ');
	const correct = normalizeAnswer(answer) === normalizeAnswer(day.grammar.expectedAnswer);
	const practiceInputsReady = practiceBlocks.every((block) =>
		practiceBlockIsReady(block, practiceResponses),
	);
	const practiceReviewed = practiceBlocks.every((block) =>
		practiceBlockIsReviewed(block, practiceFeedbackRevealed, practiceChecks),
	);
	const practiceReady = practiceInputsReady && practiceReviewed;
	const feedback = !checked
		? '入力後に答えを確認します。'
		: !correct
			? `今日の形「${day.grammar.expectedAnswer}」を確認してください。`
			: practiceBlocks.length > 0 && !practiceVisible
				? '正解です。続けて、下の練習で自分の英文を作ります。'
				: practiceBlocks.length > 0 && !practiceInputsReady
					? practiceAttempted
						? '未入力の欄、または語数を確認してください。練習文は端末へ保存されません。'
						: '各課題へ英語で答え、語数を確認してから完了します。'
					: practiceBlocks.length > 0 && !practiceReviewed
						? '回答後にフィードバックを開き、要点とrubricを自己点検してください。必要なら同じ欄で修正できます。'
						: saving
							? '正解です。学習状況を保存しています。'
							: saveResult?.ok
								? '正解です。次は声に出して3回。'
								: (saveResult?.message ??
									'学習状況を保存できませんでした。もう一度お試しください。');
	return (
		<AppShell>
			<PageHeader title={day.grammar.title} description={day.grammar.focus} />
			<section className="lesson-layout">
				<article className="lesson-note">
					<h2>会話で使う形</h2>
					<p>{day.grammar.explanation}</p>
					<ul>
						{day.grammar.examples.map((example) => (
							<li key={example}>{example}</li>
						))}
					</ul>
				</article>
				<form
					className="practice-card"
					onSubmit={async (event) => {
						event.preventDefault();
						setChecked(true);
						setSaveResult(null);
						if (!correct) return;
						if (practiceBlocks.length > 0 && !practiceVisible) {
							setPracticeVisible(true);
							return;
						}
						if (!practiceReady) {
							setPracticeAttempted(true);
							return;
						}
						setSaving(true);
						try {
							setSaveResult(await completeStep('grammar'));
						} finally {
							setSaving(false);
						}
					}}
				>
					<p className="eyebrow">Step 1 / 3 · Check the form</p>
					<h2>まず今日の形を確認</h2>
					<label className="field">
						<span>{day.grammar.exercise}</span>
						<input
							value={answer}
							onChange={(event) => {
								setAnswer(event.target.value);
								setChecked(false);
								setPracticeVisible(false);
								setPracticeAttempted(false);
								setSaveResult(null);
							}}
							disabled={saving}
							aria-invalid={checked && !correct}
							aria-describedby="grammar-feedback"
						/>
					</label>
					<p
						id="grammar-feedback"
						className={`feedback${checked ? (correct && !saveResult?.ok ? (saving ? '' : ' is-error') : correct ? ' is-success' : ' is-error') : ''}`}
						aria-live="polite"
					>
						{feedback}
					</p>
					{checked && correct && practiceVisible && practiceBlocks.length > 0 ? (
						<div className="practice-block-list practice-block-list--form">
							<p className="eyebrow practice-step-label">Step 2 / 3 · Produce & transfer</p>
							{practiceBlocks.map((block) => {
								const words = practiceBlockWordCount(block, practiceResponses);
								const invalid =
									practiceAttempted && !practiceBlockIsReady(block, practiceResponses);
								return (
									<article className="practice-block" key={block.id}>
										<p className="eyebrow">{block.kind}</p>
										<h3>{block.title}</h3>
										<p>{block.instructions}</p>
										{block.sourceText ? (
											<blockquote lang="en">{block.sourceText}</blockquote>
										) : null}
										{block.prompts.map((prompt, index) => {
											const promptResponse = practiceResponses[prompt.id] ?? '';
											const promptWords = countEnglishWords(promptResponse);
											const promptInvalid =
												practiceAttempted && !practicePromptIsReady(prompt, promptResponse);
											return (
												<div className="field" key={prompt.id}>
													<label htmlFor={`practice-response-${prompt.id}`}>
														{index + 1}. {prompt.prompt}
													</label>
													<textarea
														id={`practice-response-${prompt.id}`}
														rows={block.sourceText ? 4 : 3}
														value={promptResponse}
														onChange={(event) => {
															setPracticeResponses((current) => ({
																...current,
																[prompt.id]: event.target.value,
															}));
															if (practiceFeedbackRevealed[prompt.id]) {
																setPracticeChecks((current) => ({ ...current, [prompt.id]: [] }));
															}
															setPracticeAttempted(false);
														}}
														disabled={saving}
														aria-invalid={promptInvalid}
														data-practice-response
													/>
													{prompt.guidance ? <small>{prompt.guidance}</small> : null}
													{prompt.output ? (
														<small className={promptInvalid ? 'field-error' : undefined}>
															{promptWords}語 / {prompt.output.minimumWords}〜
															{prompt.output.maximumWords}語
														</small>
													) : null}
													{practiceFeedbackRevealed[prompt.id] ? (
														<section
															className="practice-feedback"
															aria-label={`${index + 1}のフィードバック`}
														>
															<div className="practice-feedback__head">
																<div>
																	<p className="eyebrow">Step 3 / 3 · Compare & retry</p>
																	<h4>要点と自分の回答を照合</h4>
																</div>
																<button
																	className="button button--compact"
																	type="button"
																	onClick={async () => {
																		try {
																			await navigator.clipboard.writeText(
																				buildPracticeFeedbackPrompt({
																					cefr: stage.targetCefr,
																					task: prompt.prompt,
																					response: promptResponse,
																					targetGrammar:
																						prompt.feedback.targetFeatures?.join(' / ') ??
																						day.grammar.title,
																					feedback: prompt.feedback,
																				}),
																			);
																			setPracticeCopyId(prompt.id);
																		} catch {
																			setPracticeCopyId(null);
																		}
																	}}
																>
																	<Icon name="copy" />{' '}
																	{practiceCopyId === prompt.id ? 'コピー済み' : 'AIで添削'}
																</button>
															</div>
															{practiceInitialResponses[prompt.id] !== promptResponse ? (
																<details>
																	<summary>最初の回答と修正版を比較</summary>
																	<p lang="en">{practiceInitialResponses[prompt.id]}</p>
																</details>
															) : null}
															{prompt.feedback.keyPoints?.length ? (
																<div>
																	<strong>Key points</strong>
																	<ul>
																		{prompt.feedback.keyPoints.map((point) => (
																			<li key={point}>{point}</li>
																		))}
																	</ul>
																</div>
															) : null}
															<p>{prompt.feedback.rationale}</p>
															{prompt.feedback.evidenceClue ? (
																<p>
																	<strong>本文のclue:</strong> {prompt.feedback.evidenceClue}
																</p>
															) : null}
															{prompt.feedback.commonErrors?.length ? (
																<details>
																	<summary>よくある見落とし</summary>
																	<ul>
																		{prompt.feedback.commonErrors.map((error) => (
																			<li key={error}>{error}</li>
																		))}
																	</ul>
																</details>
															) : null}
															<fieldset className="practice-checklist">
																<legend>自分の回答を確認</legend>
																<ul>
																	{prompt.feedback.checklist.map((item) => (
																		<li key={item}>{item}</li>
																	))}
																</ul>
																<label>
																	<input
																		type="checkbox"
																		checked={
																			practiceChecks[prompt.id]?.includes('reviewed') ?? false
																		}
																		onChange={(event) =>
																			setPracticeChecks((current) => ({
																				...current,
																				[prompt.id]: event.target.checked ? ['reviewed'] : [],
																			}))
																		}
																	/>
																	<span>比較と必要な修正を終えた</span>
																</label>
															</fieldset>
															<p className="practice-meta">
																修正する場合は上の回答欄を編集し、rubricをもう一度確認します。
															</p>
														</section>
													) : (
														<button
															className="button"
															type="button"
															disabled={!practicePromptIsReady(prompt, promptResponse)}
															onClick={() => {
																setPracticeInitialResponses((current) => ({
																	...current,
																	[prompt.id]: promptResponse,
																}));
																setPracticeFeedbackRevealed((current) => ({
																	...current,
																	[prompt.id]: true,
																}));
															}}
														>
															フィードバックを見る
														</button>
													)}
												</div>
											);
										})}
										{block.output ? (
											<p className={`practice-meta${invalid ? ' is-error' : ''}`}>
												{words}語 / {block.output.minimumWords}〜{block.output.maximumWords}語
											</p>
										) : null}
									</article>
								);
							})}
						</div>
					) : null}
					<button className="button button--primary" type="submit" disabled={saving}>
						{saving ? '保存中…' : practiceVisible ? '自己点検を完了して保存' : '答えを確認'}
					</button>
				</form>
			</section>
		</AppShell>
	);
}

function Library({ kind }: { kind: 'vocabulary' | 'phrases' }) {
	const { data } = useAppState();
	const learningKind = kind === 'vocabulary' ? 'vocabulary' : 'phrase';
	const normalize = (value: string) =>
		value.normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/gu, ' ');
	const acquired = data.learningItems.filter((item) => item.kind === learningKind);
	const acquiredByText = new Map(acquired.map((item) => [normalize(item.displayText), item]));
	const curriculumItems =
		kind === 'vocabulary'
			? CURRICULUM.flatMap((day) =>
					day.vocabulary.map((item) => ({
						term: item.text,
						note: `${item.meaning} · ${day.theme}`,
						day: day.day,
						status: acquiredByText.get(normalize(item.text))?.status ?? 'curriculum',
					})),
				)
			: CURRICULUM.flatMap((day) =>
					day.phrases.map((item) => ({
						term: item.text,
						note: `${item.meaning} · ${day.theme}`,
						day: day.day,
						status: acquiredByText.get(normalize(item.text))?.status ?? 'curriculum',
					})),
				);
	const curriculumIdentities = new Set(curriculumItems.map((item) => normalize(item.term)));
	const items = [
		...curriculumItems,
		...acquired
			.filter((item) => !curriculumIdentities.has(normalize(item.displayText)))
			.map((item) => ({
				term: item.displayText,
				note: `${item.meaningJa} · Voice取込`,
				day: 0,
				status: item.status,
			})),
	];
	const [query, setQuery] = useState('');
	const [status, setStatus] = useState('all');
	const filtered = items.filter(
		(item) =>
			(status === 'all' || item.status === status) &&
			(item.term.toLowerCase().includes(query.toLowerCase()) || item.note.includes(query)),
	);
	return (
		<AppShell>
			<PageHeader
				title={kind === 'vocabulary' ? '単語' : '定型表現'}
				description={
					kind === 'vocabulary'
						? '能動語彙600–800語を、会話の場面と一緒に覚えます。'
						: '会話を止めない150表現を集めます。'
				}
			/>
			<label className="search-field">
				<span>検索</span>
				<input
					type="search"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="英語またはテーマ"
				/>
			</label>
			<label className="search-field">
				<span>状態</span>
				<select value={status} onChange={(event) => setStatus(event.target.value)}>
					<option value="all">すべて</option>
					<option value="curriculum">未獲得</option>
					<option value="previewed">予習済み</option>
					<option value="new">新規</option>
					<option value="learning">学習中</option>
					<option value="learned">習得</option>
				</select>
			</label>
			<p className="result-count" aria-live="polite">
				{filtered.length}件
			</p>
			<div className="library-list">
				{filtered.map((item, index) => (
					<article key={`${item.day}-${item.term}-${index}`}>
						<span>{item.day ? `DAY ${item.day}` : 'VOICE'}</span>
						<strong>{item.term}</strong>
						<small>{item.note}</small>
						<small>状態: {item.status}</small>
					</article>
				))}
			</div>
		</AppShell>
	);
}

function Reviews() {
	const { data, completeStep, gradeReview } = useAppState();
	const card = data.reviewCards[0];
	const [revealed, setRevealed] = useState(false);
	useEffect(() => {
		if (data.reviewCards.length === 0 && !data.core.reviews) void completeStep('reviews');
	}, [completeStep, data.core.reviews, data.reviewCards.length]);
	const grade = async (value: 'again' | 'hard' | 'good' | 'easy') => {
		if (!card) return;
		const saved = await gradeReview(card.id, value);
		if (saved.ok) {
			setRevealed(false);
		}
	};
	return (
		<AppShell>
			<PageHeader
				title="期限が来た復習"
				description={`${data.reviewCount}枚 · 間隔反復は少ない量を、忘れる直前に戻します。`}
			/>
			<section className="review-workspace">
				{card ? (
					<button
						className={`review-card${revealed ? ' is-revealed' : ''}`}
						type="button"
						onClick={() => setRevealed(true)}
						aria-label={revealed ? `答え: ${card.back}` : `問題: ${card.front}。答えを見る`}
					>
						<span>{revealed ? 'ANSWER' : 'QUESTION'}</span>
						<strong>{revealed ? card.back : card.front}</strong>
						<small>{revealed ? '声に出せたら評価してください。' : 'タップして答えを見る'}</small>
					</button>
				) : (
					<p className="feedback is-success" role="status">
						今日が期限のカードはありません。復習は完了です。
					</p>
				)}
				{card && revealed ? (
					<div className="grade-row">
						<button type="button" onClick={() => void grade('again')}>
							もう一度
						</button>
						<button type="button" onClick={() => void grade('hard')}>
							難しい
						</button>
						<button type="button" onClick={() => void grade('good')}>
							できた
						</button>
						<button type="button" onClick={() => void grade('easy')}>
							簡単
						</button>
					</div>
				) : null}
			</section>
		</AppShell>
	);
}

function Mistakes() {
	const { data } = useAppState();
	return (
		<AppShell>
			<PageHeader
				title="間違いノート"
				description="同じミスが3回以上なら、次のBoostでWeakness Attackを優先します。"
			/>
			<div className="mistake-list">
				{data.mistakes.map((item) => (
					<article key={item.id}>
						<div>
							<span className="status-chip">{item.category}</span>
							<strong>{item.original}</strong>
							<p>{item.correction}</p>
						</div>
						<span className={item.repetitions >= 3 ? 'repeat-count is-urgent' : 'repeat-count'}>
							{item.repetitions}回
						</span>
					</article>
				))}
			</div>
		</AppShell>
	);
}

function Voice() {
	const { data } = useAppState();
	const [searchParams] = useSearchParams();
	const day = CURRICULUM[data.currentDay - 1] ?? CURRICULUM[0];
	const requestedMode = searchParams.get('mode');
	const initialMode =
		requestedMode === 'baseline' ||
		requestedMode === 'study' ||
		requestedMode === 'weekly' ||
		/^boost-(5|15|30|60)$/u.test(requestedMode ?? '')
			? requestedMode!
			: 'core';
	const [mode, setMode] = useState(initialMode);
	const [providerId, setProviderId] = useState<ConversationProviderId>('chatgpt');
	const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
	const requestedBoost = BoostModeSchema.safeParse(searchParams.get('boost'));
	const boostMode: BoostMode = requestedBoost.success ? requestedBoost.data : 'speaking_sprint';
	const provider = getConversationProviderPreset(providerId);
	const context: LearnerPromptContext = useMemo(() => {
		const nextDay = CURRICULUM[day.day];
		return {
			learnerName: data.learnerName || 'Learner',
			curriculumDay: day.day,
			theme: day.theme,
			objective: day.objective,
			grammarTitle: day.grammar.title,
			grammarFocus: day.grammar.focus,
			voiceTask: day.voiceTask,
			dueReviews: data.reviewCards.map((card) => ({ front: card.front, back: card.back })),
			todayVocabulary: day.vocabulary.map((item) => ({ text: item.text, meaning: item.meaning })),
			todayPhrases: day.phrases.map((item) => ({ text: item.text, meaning: item.meaning })),
			recentMistakes: data.mistakes.slice(0, 20).map((item) => ({
				original: item.original,
				correction: item.correction,
				repetitions: item.repetitions,
			})),
			remainingNewWords: data.remainingAcquisition.words,
			remainingNewPhrases: data.remainingAcquisition.phrases,
			remainingPreviewGrammar: data.remainingAcquisition.previewGrammar,
			nextGrammar: nextDay
				? {
						curriculumDay: nextDay.day,
						topicId: nextDay.grammar.id,
						title: nextDay.grammar.title,
						focus: nextDay.grammar.focus,
					}
				: null,
		};
	}, [data.learnerName, data.mistakes, data.remainingAcquisition, data.reviewCards, day]);
	const prompt = useMemo(() => {
		if (mode === 'baseline') return buildBaselinePrompt(data.learnerName);
		if (mode === 'study') return buildStudyContext(context);
		if (mode === 'weekly') {
			const startDay = Math.max(1, day.day - ((day.day - 1) % 7));
			const covered = CURRICULUM.filter((item) => item.day >= startDay && item.day <= day.day);
			return buildWeeklyPrompt(
				startDay,
				day.day,
				covered.map((item) => item.objective),
				covered.map((item) => item.grammar.title),
				covered.flatMap((item) => item.phrases.map((phrase) => phrase.text)),
				context.recentMistakes.filter((item) => item.repetitions >= 3),
			);
		}
		if (mode.startsWith('boost-')) {
			return buildBoostPrompt(
				context,
				Number(mode.slice(6)) as 5 | 15 | 30 | 60,
				boostMode,
				providerId,
			);
		}
		return buildCorePrompt(context, providerId);
	}, [boostMode, context, data.learnerName, mode, providerId]);
	if (mode.startsWith('boost-') && !Object.values(data.core).every(Boolean)) {
		return <Navigate to="/today" replace />;
	}
	if (
		mode.startsWith('boost-') &&
		boostMode === 'next_lesson_preview' &&
		(!context.nextGrammar || data.remainingAcquisition.previewGrammar < 1)
	) {
		return <Navigate to="/boost" replace />;
	}
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(prompt);
			setCopyStatus('copied');
			window.setTimeout(() => setCopyStatus('idle'), 2500);
		} catch {
			setCopyStatus('failed');
		}
	};
	return (
		<AppShell>
			<PageHeader
				title="会話AIへ持っていく"
				description="自動送信はしません。プロンプトをコピーし、自分で選ぶ会話AIで練習します。"
			/>
			<div className="bridge-layout">
				<aside className="mode-list" aria-label="プロンプトの種類">
					{['core', 'boost-5', 'boost-15', 'boost-30', 'boost-60', 'study', 'weekly'].map(
						(item) => (
							<button
								key={item}
								className={mode === item ? 'is-active' : ''}
								type="button"
								aria-pressed={mode === item}
								onClick={() => setMode(item)}
							>
								{item === 'core'
									? 'Core会話'
									: item === 'study'
										? 'Study Mode'
										: item === 'weekly'
											? '週次評価'
											: item.replace('boost-', 'Boost ')}
								{item.startsWith('boost') ? '分' : ''}
							</button>
						),
					)}
				</aside>
				<section className="prompt-panel">
					<label className="field">
						<span>会話AIプリセット</span>
						<select
							value={providerId}
							onChange={(event) => setProviderId(event.target.value as ConversationProviderId)}
						>
							{CONVERSATION_PROVIDER_PRESETS.map((preset) => (
								<option key={preset.id} value={preset.id}>
									{preset.label}（{preset.testedStatus === 'tested' ? '確認済み' : '未検証'}）
								</option>
							))}
						</select>
						<small>{provider.setupNoteJa}</small>
					</label>
					{(mode === 'core' || mode.startsWith('boost-')) &&
					provider.capabilities.voiceConversation !== 'tested' ? (
						<p className="feedback">
							このプリセットのVoice対応は未検証です。Voiceを使えない場合、会話・Listeningを含むCoreの代替にはなりません。
						</p>
					) : null}
					<div className="prompt-panel__head">
						<div>
							<span>コピー専用</span>
							<h2>
								{mode === 'core'
									? '今日のCore会話'
									: mode === 'study'
										? '通常チャット用Study Mode'
										: mode === 'weekly'
											? '週次評価'
											: mode === 'baseline'
												? 'ベースライン評価'
												: mode.replace('-', ' ')}
							</h2>
						</div>
						<button className="button" type="button" onClick={copy}>
							<Icon name="copy" />
							{copyStatus === 'copied' ? 'コピー済み' : 'コピー'}
						</button>
					</div>
					{copyStatus === 'failed' ? (
						<p className="feedback is-error" role="alert">
							クリップボードへコピーできませんでした。下のプロンプトを選択して手動でコピーしてください。
						</p>
					) : null}
					<pre tabIndex={0} aria-label="コピーする会話AIプロンプト">
						{prompt}
					</pre>
					{mode === 'core' || mode.startsWith('boost-') ? (
						<>
							<p>
								会話AIのテキスト欄へ先に貼り付けて送信し、その後Voiceを開始してください。Voice終了後に明示的に「SESSION_JSONを出力」と送り、返ったJSONだけを取込画面へ貼ります。
							</p>
							<a className="button button--primary" href="/import">
								会話後に結果JSONを取り込む
							</a>
						</>
					) : (
						<p>
							プロンプトをテキストとして先に送信してください。この補助評価ではSESSION_JSONを生成・取込しません。
						</p>
					)}
				</section>
			</div>
		</AppShell>
	);
}

function SessionImport() {
	const { importSession, setEditorDirty } = useAppState();
	const [source, setSource] = useState('');
	const [result, setResult] = useState<ReturnType<typeof parseSession> | null>(null);
	const [message, setMessage] = useState('');
	const [messageIsError, setMessageIsError] = useState(false);
	const structured = result?.session
		? SessionJsonSchema.safeParse(result.session.payload)
		: undefined;
	const sourceBytes = new TextEncoder().encode(source).byteLength;
	useEffect(() => () => setEditorDirty(false), [setEditorDirty]);
	const preview = () => {
		setMessage('');
		setMessageIsError(false);
		setResult(parseSession(source));
	};
	const save = async () => {
		if (!result?.session) return;
		const response = await importSession(result.session);
		setMessage(response.message);
		setMessageIsError(!response.ok);
		if (response.ok) setEditorDirty(false);
	};
	return (
		<AppShell>
			<PageHeader
				title="会話結果JSONを取込"
				description="元の貼り付け内容は保持したまま、検証結果を別に表示します。"
			/>
			<section className="import-layout">
				<div className="import-editor">
					<label className="field">
						<span>会話AIが返したJSON</span>
						<textarea
							aria-invalid={Boolean(result?.errors.length)}
							aria-describedby="session-import-limit session-import-feedback"
							value={source}
							onChange={(event) => {
								setSource(event.target.value);
								setEditorDirty(event.target.value.trim().length > 0);
								setResult(null);
							}}
							placeholder={SAMPLE_SESSION_JSON}
						/>
						<small id="session-import-limit">
							入力上限 1MB（現在 {sourceBytes.toLocaleString('ja-JP')} /{' '}
							{MAX_SESSION_SOURCE_BYTES.toLocaleString('ja-JP')}{' '}
							bytes）。上限を超えても入力は消えず、 保存前の検証で拒否します。
						</small>
					</label>
					<div className="button-row">
						{isDemoMode ? (
							<button
								className="button"
								type="button"
								onClick={() => {
									setSource(SAMPLE_SESSION_JSON);
									setEditorDirty(true);
									setResult(null);
									setMessage('合成SESSION_JSONを読み込みました。検証してから取り込めます。');
									setMessageIsError(false);
								}}
							>
								合成サンプルを読み込む
							</button>
						) : null}
						<button
							className="button"
							type="button"
							onClick={async () => {
								try {
									const text = await navigator.clipboard.readText();
									setSource(text);
									setEditorDirty(text.trim().length > 0);
									setResult(null);
									setMessage('クリップボードから読み込みました。内容を確認してください。');
									setMessageIsError(false);
								} catch {
									setMessage(
										'クリップボードを読み込めませんでした。入力欄は変更していません。直接貼り付けてください。',
									);
									setMessageIsError(true);
								}
							}}
						>
							クリップボード読込
						</button>
						<button className="button button--primary" type="button" onClick={preview}>
							検証してプレビュー
						</button>
					</div>
				</div>
				<aside id="session-import-feedback" className="import-preview" aria-live="polite">
					<h2>取込プレビュー</h2>
					{result?.errors.length ? (
						<div className="error-box">
							<strong>保存できません</strong>
							<ul>
								{result.errors.map((error) => (
									<li key={error}>{error}</li>
								))}
							</ul>
						</div>
					) : result?.session && structured?.success ? (
						<div className="preview-data">
							{result.warnings.length ? (
								<div className="feedback" role="status">
									{result.warnings.join(' ')}
								</div>
							) : null}
							<dl>
								<dt>種類</dt>
								<dd>{result.session.kind}</dd>
								<dt>時間</dt>
								<dd>{result.session.durationMinutes}分</dd>
								<dt>スコア</dt>
								<dd>{result.session.score}</dd>
								<dt>要約</dt>
								<dd>{result.session.summary}</dd>
								<dt>新規単語</dt>
								<dd>{structured.data.newVocabulary.length}件</dd>
								<dt>新規定型表現</dt>
								<dd>{structured.data.newPhrases.length}件</dd>
								<dt>文法予習</dt>
								<dd>{structured.data.previewGrammar.length}件</dd>
								<dt>間違い</dt>
								<dd>{structured.data.mistakes.length}件</dd>
								<dt>復習カード</dt>
								<dd>{structured.data.reviewCards.length}件</dd>
							</dl>
							<button className="button button--primary" type="button" onClick={() => void save()}>
								この内容を保存
							</button>
						</div>
					) : (
						<p className="empty-copy">JSONを検証すると、保存前の内容がここに表示されます。</p>
					)}
					{message ? (
						<p
							className={`feedback ${messageIsError ? 'is-error' : 'is-success'}`}
							role={messageIsError ? 'alert' : 'status'}
						>
							{message}
						</p>
					) : null}
				</aside>
			</section>
		</AppShell>
	);
}

function Sessions() {
	const { data } = useAppState();
	const [searchParams, setSearchParams] = useSearchParams();
	const parsedKind = z.enum(['all', 'core', 'boost']).safeParse(searchParams.get('kind') ?? 'all');
	const parsedDate = z.iso.date().safeParse(searchParams.get('date') ?? '');
	const parsedMode = BoostModeSchema.safeParse(searchParams.get('mode') ?? '');
	const kind = parsedKind.success ? parsedKind.data : 'all';
	const date = parsedDate.success ? parsedDate.data : '';
	const mode = parsedMode.success ? parsedMode.data : '';
	const updateFilter = (key: 'kind' | 'date' | 'mode', value: string) => {
		const next = new URLSearchParams(searchParams);
		if (!value || value === 'all') next.delete(key);
		else next.set(key, value);
		setSearchParams(next, { replace: true });
	};
	const sessions = data.sessions.filter((session) => {
		if (kind !== 'all' && session.kind !== kind) return false;
		if (date && studyDateAt(session.completedAt, data.timeZone) !== date) return false;
		if (mode) {
			const payload = SessionJsonSchema.safeParse(session.payload);
			if (!payload.success || payload.data.boost?.mode !== mode) return false;
		}
		return true;
	});
	return (
		<AppShell>
			<PageHeader title="セッション履歴" description="CoreとBoostは別々に記録します。" />
			<form className="session-filters" aria-label="セッション履歴の絞り込み">
				<label className="field">
					<span>種類</span>
					<select value={kind} onChange={(event) => updateFilter('kind', event.target.value)}>
						<option value="all">すべて</option>
						<option value="core">Core</option>
						<option value="boost">Boost</option>
					</select>
				</label>
				<label className="field">
					<span>実施日</span>
					<input
						type="date"
						value={date}
						onChange={(event) => updateFilter('date', event.target.value)}
					/>
				</label>
				<label className="field">
					<span>Boostモード</span>
					<select value={mode} onChange={(event) => updateFilter('mode', event.target.value)}>
						<option value="">すべて</option>
						{BoostModeSchema.options.map((value) => (
							<option key={value} value={value}>
								{value}
							</option>
						))}
					</select>
				</label>
				<button
					className="button"
					type="button"
					disabled={!searchParams.size}
					onClick={() => setSearchParams({}, { replace: true })}
				>
					絞り込みを解除
				</button>
			</form>
			{sessions.length ? (
				<div className="session-list">
					{sessions.map((session) => (
						<article key={session.sessionId}>
							<div>
								<span className="status-chip">{session.kind}</span>
								<h2>{session.summary}</h2>
								<p>
									{new Date(session.completedAt).toLocaleString('ja-JP')} ·{' '}
									{session.durationMinutes}分
								</p>
							</div>
							<div className="session-list__actions">
								<strong>{session.score}</strong>
								<a className="button" href={`/sessions/${encodeURIComponent(session.sessionId)}`}>
									詳細
								</a>
							</div>
						</article>
					))}
				</div>
			) : (
				<div className="empty-state">
					<h2>
						{data.sessions.length
							? '条件に一致するセッションがありません'
							: 'まだセッションがありません'}
					</h2>
					<p>
						{data.sessions.length
							? '絞り込みを解除するか、条件を変更してください。'
							: 'Core Voiceの結果JSONを取り込むと、ここに履歴が残ります。'}
					</p>
					{!data.sessions.length ? (
						<a className="button" href="/voice">
							会話準備へ
						</a>
					) : null}
				</div>
			)}
		</AppShell>
	);
}

function SessionDetail() {
	const { data } = useAppState();
	const { sessionId = '' } = useParams();
	const parsedId = z.string().min(1).max(128).safeParse(sessionId);
	const session = parsedId.success
		? data.sessions.find((item) => item.sessionId === parsedId.data)
		: undefined;
	if (!session) {
		return (
			<AppShell>
				<PageHeader
					title="セッションが見つかりません"
					description="削除済みか、URLが正しくありません。"
				/>
				<a className="button" href="/sessions">
					セッション履歴へ戻る
				</a>
			</AppShell>
		);
	}
	const payload = SessionJsonSchema.safeParse(session.payload);
	return (
		<AppShell>
			<PageHeader title={session.summary} description="保存済みの検証済みセッションです。" />
			<article className="surface session-detail">
				<dl>
					<dt>種類</dt>
					<dd>{session.kind === 'core' ? 'Core' : 'Boost'}</dd>
					<dt>実施日時</dt>
					<dd>
						{new Date(session.completedAt).toLocaleString('ja-JP', { timeZone: data.timeZone })}
					</dd>
					<dt>時間</dt>
					<dd>{session.durationMinutes}分</dd>
					<dt>スコア</dt>
					<dd>{session.score}</dd>
					<dt>間違い</dt>
					<dd>{session.mistakes.length}件</dd>
					{payload.success ? (
						<>
							<dt>カリキュラム日</dt>
							<dd>Day {payload.data.curriculumDay}</dd>
							{payload.data.boost ? (
								<>
									<dt>Boostモード</dt>
									<dd>{payload.data.boost.mode}</dd>
								</>
							) : null}
							<dt>評価コメント</dt>
							<dd>{payload.data.evaluation.commentJa}</dd>
						</>
					) : null}
				</dl>
			</article>
			<a className="button" href="/sessions">
				セッション履歴へ戻る
			</a>
		</AppShell>
	);
}

function Analytics() {
	const { data } = useAppState();
	const coreRate = Math.round((data.completedDays.length / Math.max(1, data.currentDay)) * 100);
	const today = studyDateAt(new Date(), data.timeZone);
	const completedDates = new Set(data.completedStudyDates);
	const recentDates = Array.from({ length: 7 }, (_, index) => addStudyDays(today, index - 6));
	return (
		<AppShell>
			<PageHeader title="進捗" description="Boostの量ではなく、Coreの継続と使える表現を見ます。" />
			<div className="analytics-grid">
				<article className="metric metric--wide">
					<span>CORE完了率</span>
					<strong>{coreRate}%</strong>
					<div className="bar">
						<i style={{ transform: `scaleX(${coreRate / 100})` }} />
					</div>
				</article>
				<article className="metric">
					<span>連続日数</span>
					<strong>
						{data.streak}
						<small>日</small>
					</strong>
				</article>
				<article className="metric">
					<span>Voice</span>
					<strong>
						{data.sessions.length}
						<small>回</small>
					</strong>
				</article>
				<article className="metric">
					<span>Core / Boost</span>
					<strong>
						{data.activity.coreSessions} / {data.activity.boostSessions}
					</strong>
				</article>
				<article className="metric">
					<span>復習イベント</span>
					<strong>{data.activity.reviewEvents}</strong>
				</article>
				<article className="metric">
					<span>獲得 単語 / 表現</span>
					<strong>
						{data.activity.acquiredWords} / {data.activity.acquiredPhrases}
					</strong>
				</article>
				<article className="metric">
					<span>文法進捗</span>
					<strong>{data.activity.grammarProgress}</strong>
				</article>
				<article className="metric metric--chart">
					<span>直近7日</span>
					<div className="mini-bars" role="img" aria-label="直近7日のCore実績">
						{recentDates.map((date) => (
							<i key={date} className={completedDates.has(date) ? 'is-done' : ''} title={date} />
						))}
					</div>
				</article>
			</div>
		</AppShell>
	);
}

const boostModes: ReadonlyArray<{ id: BoostMode; label: string }> = [
	{ id: 'review_rescue', label: 'Review Rescue' },
	{ id: 'speaking_sprint', label: 'Speaking Sprint' },
	{ id: 'grammar_deep_dive', label: 'Grammar Deep Dive' },
	{ id: 'scenario_challenge', label: 'Scenario Challenge' },
	{ id: 'weakness_attack', label: 'Weakness Attack' },
	{ id: 'next_lesson_preview', label: 'Next Lesson Preview' },
	{ id: 'free_talk', label: 'Free Talk' },
];

function Boost() {
	const { data } = useAppState();
	const navigate = useNavigate();
	const [minutes, setMinutes] = useState(15);
	const scoredSessions = data.sessions
		.map((session) => SessionJsonSchema.safeParse(session.payload))
		.filter((result) => result.success)
		.map((result) => result.data);
	const latestSessionId = data.sessions[0]?.sessionId;
	const oldestDueAt = data.reviewCards
		.map((card) => Date.parse(card.dueAt))
		.filter(Number.isFinite)
		.sort((left, right) => left - right)[0];
	const recommendation = recommendBoost({
		overdueReviewCount: data.reviewCount,
		oldestOverdueDays:
			oldestDueAt === undefined ? 0 : Math.max(0, (Date.now() - oldestDueAt) / 86_400_000),
		repeatedMistakeCount: data.mistakes.filter((item) => item.repetitions >= 3).length,
		repeatedMistakeInLatestSession: data.mistakes.some(
			(item) => item.repetitions >= 3 && item.sessionId === latestSessionId,
		),
		recentInteractionScores: scoredSessions.map((item) => item.evaluation.interaction),
		recentGrammarScores: scoredSessions.map((item) => item.evaluation.grammar),
	});
	const nextPreviewAvailable = data.currentDay < 90 && data.remainingAcquisition.previewGrammar > 0;
	const recommended =
		recommendation.mode === 'next_lesson_preview' && !nextPreviewAvailable
			? 'speaking_sprint'
			: recommendation.mode;
	const [mode, setMode] = useState<BoostMode>(recommended);
	if (!Object.values(data.core).every(Boolean)) return <Navigate to="/today" replace />;
	return (
		<AppShell>
			<PageHeader title="Boost" description="追加学習です。未来のCore完了には使いません。" />
			<section className="boost-builder">
				<p className="feedback" role="status">
					おすすめ: {boostModes.find((item) => item.id === recommended)?.label}（
					{recommendation.reason}）
				</p>
				<div>
					<h2>時間を選ぶ</h2>
					<div className="time-options">
						{[5, 15, 30, 60].map((value) => (
							<button
								key={value}
								className={minutes === value ? 'is-active' : ''}
								type="button"
								aria-pressed={minutes === value}
								onClick={() => setMinutes(value)}
							>
								<strong>{value}</strong>
								<span>分</span>
							</button>
						))}
					</div>
				</div>
				<div>
					<h2>モードを選ぶ</h2>
					<div className="mode-grid">
						{boostModes.map((item) => (
							<button
								key={item.id}
								className={mode === item.id ? 'is-active' : ''}
								type="button"
								aria-pressed={mode === item.id}
								disabled={item.id === 'next_lesson_preview' && !nextPreviewAvailable}
								onClick={() => setMode(item.id)}
							>
								<strong>{item.label}</strong>
								<small>
									{item.id === 'review_rescue'
										? '期限切れを先に減らす'
										: item.id === 'weakness_attack'
											? '3回以上のミスを集中練習'
											: item.id === 'next_lesson_preview' && !nextPreviewAvailable
												? '次のDayがないか、今日の予習上限に達しています'
												: '今日の余力を会話に使う'}
								</small>
							</button>
						))}
					</div>
				</div>
				<button
					className="button button--dark"
					type="button"
					onClick={() => navigate(`/voice?mode=boost-${minutes}&boost=${encodeURIComponent(mode)}`)}
				>
					Boostプロンプトを作る
				</button>
			</section>
		</AppShell>
	);
}

function Backup() {
	const [preview, setPreview] = useState<BackupPreview | null>(null);
	const [confirmed, setConfirmed] = useState(false);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState('');
	const [isError, setIsError] = useState(false);
	const download = async () => {
		setBusy(true);
		setMessage('');
		setIsError(false);
		try {
			const blob = new Blob([await createBackupText()], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `trellune-backup-${new Date().toISOString().slice(0, 10)}.json`;
			link.click();
			URL.revokeObjectURL(url);
			setMessage('改ざん検知情報を含むバックアップを作成しました。');
		} catch (error) {
			setIsError(true);
			setMessage(backupFailureMessage(error));
		} finally {
			setBusy(false);
		}
	};
	const read = async (file?: File) => {
		if (!file) return;
		setBusy(true);
		setPreview(null);
		setConfirmed(false);
		setMessage('');
		setIsError(false);
		try {
			assertBackupFileSize(file.size);
			setPreview(await previewBackupText(await file.text()));
			setMessage('検証に成功しました。まだ端末内データは変更していません。');
		} catch (error) {
			setIsError(true);
			setMessage(backupFailureMessage(error));
		} finally {
			setBusy(false);
		}
	};
	const apply = async () => {
		if (!preview || !confirmed) return;
		setBusy(true);
		setMessage('');
		setIsError(false);
		try {
			await applyBackupPreview(preview);
			setPreview(null);
			setConfirmed(false);
			setMessage('バックアップを復元し、保存後の件数も確認しました。');
		} catch (error) {
			setIsError(true);
			setMessage(backupFailureMessage(error));
		} finally {
			setBusy(false);
		}
	};
	const impactRows = preview
		? [
				['セッション', preview.impact.sessions],
				['間違い', preview.impact.mistakes],
				['学習項目', preview.impact.learningItems],
				['復習カード', preview.impact.reviewCards],
				['日次進捗', preview.impact.dailyProgress],
			]
		: [];
	return (
		<AppShell>
			<PageHeader
				title="バックアップと復元"
				description="端末内データをJSONとして保存します。音声は含みません。"
			/>
			<div className="detail-grid">
				<article className="surface surface--pear">
					<h2>バックアップ</h2>
					<p>現在の設定、進捗、履歴、間違いノートを書き出します。</p>
					<p>
						JSONは暗号化されません。共有フォルダーや公開リンクを避け、自分だけがアクセスできる場所へ安全に保管してください。
					</p>
					<button
						className="button button--primary"
						type="button"
						disabled={busy}
						onClick={() => void download()}
					>
						JSONを保存
					</button>
				</article>
				<article className="surface">
					<h2>復元</h2>
					<p>ファイルを検証して変更件数を表示します。この時点では何も変更しません。</p>
					<label className="field" htmlFor="backup-restore-file">
						<span>Trelluneバックアップ（JSON）</span>
						<input
							id="backup-restore-file"
							type="file"
							accept="application/json"
							disabled={busy}
							onChange={(event) => void read(event.target.files?.[0])}
						/>
					</label>
				</article>
			</div>
			{preview ? (
				<section className="surface backup-preview" aria-labelledby="backup-preview-title">
					<h2 id="backup-preview-title">復元プレビュー</h2>
					<p>
						作成日時: {new Date(preview.envelope.createdAt).toLocaleString('ja-JP')} ·
						SHA-256確認済み
					</p>
					<table>
						<thead>
							<tr>
								<th scope="col">対象</th>
								<th scope="col">復元後</th>
								<th scope="col">追加</th>
								<th scope="col">更新</th>
								<th scope="col">削除</th>
							</tr>
						</thead>
						<tbody>
							{impactRows.map(([label, impact]) => (
								<tr key={label as string}>
									<th scope="row">{label as string}</th>
									<td>{(impact as BackupPreview['impact']['sessions']).incoming}</td>
									<td>{(impact as BackupPreview['impact']['sessions']).add}</td>
									<td>{(impact as BackupPreview['impact']['sessions']).update}</td>
									<td>{(impact as BackupPreview['impact']['sessions']).remove}</td>
								</tr>
							))}
						</tbody>
					</table>
					<label className="switch backup-confirmation">
						<input
							type="checkbox"
							checked={confirmed}
							onChange={(event) => setConfirmed(event.target.checked)}
						/>
						<span>現在の端末内データを、このプレビュー内容で置き換えることを確認しました</span>
					</label>
					<button
						className="button button--primary"
						type="button"
						disabled={!confirmed || busy}
						onClick={() => void apply()}
					>
						確認して復元
					</button>
				</section>
			) : null}
			{message ? (
				<p className={`feedback${isError ? ' is-error' : ''}`} role={isError ? 'alert' : 'status'}>
					{message}
				</p>
			) : null}
		</AppShell>
	);
}

function Settings() {
	const { data, deleteDeviceData, update } = useAppState();
	const [syncStatus, setSyncStatus] = useState<SyncStatusSummary | null>(null);
	const [syncMessage, setSyncMessage] = useState('');
	const [syncBusy, setSyncBusy] = useState(false);
	const [deleteAcknowledged, setDeleteAcknowledged] = useState(false);
	const [deleteConfirmation, setDeleteConfirmation] = useState('');
	const [deleteBusy, setDeleteBusy] = useState(false);
	const [deleteMessage, setDeleteMessage] = useState('');
	const refreshSyncStatus = async () => setSyncStatus(await getSyncStatus());
	const syncMessageFor = (result: SyncRunResult): string => {
		switch (result.status) {
			case 'completed':
				return '同期を完了しました。';
			case 'busy':
				return '別の同期処理が実行中です。少し待ってから状態を確認してください。';
			case 'offline':
				return 'オフラインのため同期していません。接続後にもう一度実行してください。';
			case 'blocked':
				return result.conflicts
					? '同期は一部停止しています。下の競合を確認して、採用するデータを選んでください。'
					: '同期できない操作があります。「停止中の操作を再試行」またはエラー表示を確認してください。';
			case 'failed':
				return '同期に失敗しました。端末内の学習データは保存されています。接続とエラー表示を確認してください。';
		}
	};
	useEffect(() => {
		void refreshSyncStatus();
		const timer = window.setInterval(() => void refreshSyncStatus(), 2_000);
		return () => window.clearInterval(timer);
	}, []);
	return (
		<AppShell>
			<PageHeader title="設定" description="学習の目安と、この端末での保存方法を管理します。" />
			<div className="settings-list">
				<section>
					<div>
						<h2>1日の目安</h2>
						<p>Coreの内容は変えず、表示する時間の目安だけ変更します。</p>
					</div>
					<select
						value={data.dailyMinutes}
						onChange={(event) => void update({ dailyMinutes: Number(event.target.value) })}
						aria-label="1日の学習時間"
					>
						{[10, 20, 30, 45].map((value) => (
							<option key={value} value={value}>
								{value}分
							</option>
						))}
					</select>
				</section>
				<section className="sync-detail">
					<div>
						<h2>同期状態</h2>
						<p aria-live="polite">
							未送信 {syncStatus?.pending ?? 0} · 同期中 {syncStatus?.syncing ?? 0} · 停止{' '}
							{syncStatus?.blocked ?? 0} · 競合 {syncStatus?.conflicts.length ?? 0}
						</p>
						<p>
							最終成功:{' '}
							{syncStatus?.lastSuccessAt
								? new Date(syncStatus.lastSuccessAt).toLocaleString('ja-JP')
								: 'まだありません'}
						</p>
						<p>
							最終試行:{' '}
							{syncStatus?.lastAttemptAt
								? `${new Date(syncStatus.lastAttemptAt).toLocaleString('ja-JP')}（${syncStatus.lastAttemptStatus ?? '不明'}）`
								: 'まだありません'}
						</p>
						{syncStatus?.lastErrorCode ? (
							<p className="feedback is-error">エラー: {syncStatus.lastErrorCode}</p>
						) : null}
					</div>
					<div className="button-row">
						<button
							className="button"
							type="button"
							disabled={!data.syncEnabled || syncBusy}
							onClick={async () => {
								setSyncBusy(true);
								try {
									setSyncMessage(syncMessageFor(await syncNow()));
								} catch {
									setSyncMessage('同期に失敗しました。端末内の学習データは保存されています。');
								} finally {
									setSyncBusy(false);
									await refreshSyncStatus();
								}
							}}
						>
							{syncBusy ? '同期中…' : '今すぐ同期'}
						</button>
						<button
							className="button"
							type="button"
							disabled={!syncStatus?.blocked}
							onClick={async () => {
								await retryBlockedSync();
								await refreshSyncStatus();
							}}
						>
							停止中の操作を再試行
						</button>
						<button
							className="button"
							type="button"
							disabled={!syncStatus || syncStatus.blocked <= syncStatus.conflicts.length}
							onClick={async () => {
								if (
									!window.confirm(
										'競合として統合できない停止操作だけを送信待ちから外します。端末内データは削除しません。続けますか？',
									)
								)
									return;
								await discardUnresolvableBlockedSync();
								await refreshSyncStatus();
							}}
						>
							停止操作を待機列から除外
						</button>
					</div>
					{syncMessage ? (
						<p className="feedback" role="status">
							{syncMessage}
						</p>
					) : null}
				</section>
				{syncStatus?.conflicts.map((conflict) => (
					<section key={conflict.id} className="sync-conflict">
						<div>
							<h2>同期競合</h2>
							<p>
								{conflict.entityType} / {conflict.entityId}
							</p>
						</div>
						<div className="button-row">
							<button
								className="button"
								type="button"
								onClick={async () => {
									await resolveSyncConflict(conflict.id, 'keep-local');
									await syncNow();
									await refreshSyncStatus();
								}}
							>
								この端末を採用
							</button>
							<button
								className="button"
								type="button"
								onClick={async () => {
									await resolveSyncConflict(conflict.id, 'use-server');
									await refreshSyncStatus();
								}}
							>
								サーバーを採用
							</button>
						</div>
					</section>
				))}
				<section>
					<div>
						<h2>D1同期</h2>
						<p>Accessで保護されたAPIへ同期します。初期状態は端末内だけです。</p>
					</div>
					<label className="switch">
						<input
							type="checkbox"
							checked={data.syncEnabled}
							onChange={(event) => void update({ syncEnabled: event.target.checked })}
						/>
						<span>同期</span>
					</label>
				</section>
				<section>
					<div>
						<h2>動きを減らす</h2>
						<p>OS設定に加えて、アプリ内の空間的な動きを抑えます。</p>
					</div>
					<label className="switch">
						<input
							type="checkbox"
							checked={data.reduceMotion}
							onChange={(event) => void update({ reduceMotion: event.target.checked })}
						/>
						<span>低減</span>
					</label>
				</section>
				<section className="danger-zone">
					<div>
						<h2>この端末の学習データを削除</h2>
						<p id="local-delete-description">
							プロフィール、設定、進捗、履歴、復習、バックアップ復元情報、未送信同期操作をこの端末から削除します。Cloudflare
							D1の同期済みデータは削除しません。
						</p>
						<p>先にバックアップを保存してください。削除後は元に戻せません。</p>
						<label className="switch delete-confirmation">
							<input
								type="checkbox"
								checked={deleteAcknowledged}
								onChange={(event) => setDeleteAcknowledged(event.target.checked)}
							/>
							<span>対象と不可逆性を確認しました</span>
						</label>
						<label className="field" htmlFor="local-delete-confirmation">
							<span>確認のため「{LOCAL_DELETE_CONFIRMATION}」と入力</span>
							<input
								id="local-delete-confirmation"
								value={deleteConfirmation}
								onChange={(event) => setDeleteConfirmation(event.target.value)}
								aria-describedby="local-delete-description"
								autoComplete="off"
							/>
						</label>
						<button
							className="button button--danger"
							type="button"
							disabled={
								deleteBusy ||
								!deleteAcknowledged ||
								deleteConfirmation !== LOCAL_DELETE_CONFIRMATION
							}
							onClick={async () => {
								setDeleteBusy(true);
								const result = await deleteDeviceData();
								setDeleteMessage(result.message);
								setDeleteBusy(false);
							}}
						>
							{deleteBusy ? '削除しています…' : 'この端末のデータを削除'}
						</button>
						{deleteMessage ? <p role="status">{deleteMessage}</p> : null}
						<p>同期済みデータを含む削除は、本人確認と本番操作承認が必要なため自動実行しません。</p>
					</div>
				</section>
			</div>
			<nav className="settings-links">
				<a href="/baseline">ベースライン評価を再開</a>
				<a href="/assessment">Stage Assessment</a>
				<a href="/sessions">セッション履歴</a>
				<a href="/mistakes">間違いノート</a>
				<a href="/analytics">進捗分析</a>
				<a href="/backup">バックアップ</a>
				<a href="/vocabulary">単語</a>
				<a href="/phrases">定型表現</a>
			</nav>
			<footer className="statement-footer">
				<p>小さく話す。毎日つなぐ。</p>
				<div>
					<span>Trellune</span>
					<span>Local-first · no AI API</span>
				</div>
			</footer>
		</AppShell>
	);
}

function OfflineHelp({ unknownPath = false }: { unknownPath?: boolean }) {
	const [online, setOnline] = useState<boolean | null>(null);
	useEffect(() => {
		const refresh = () => setOnline(navigator.onLine);
		refresh();
		window.addEventListener('online', refresh);
		window.addEventListener('offline', refresh);
		return () => {
			window.removeEventListener('online', refresh);
			window.removeEventListener('offline', refresh);
		};
	}, []);
	if (online === null) {
		return (
			<main className="app-loading" aria-busy="true" aria-live="polite">
				<h1>ページを確認しています…</h1>
			</main>
		);
	}
	return (
		<AppShell>
			<PageHeader
				title={
					online && unknownPath
						? 'ページが見つかりません'
						: 'このページはまだオフラインで使えません'
				}
				description={
					online && unknownPath
						? 'URLを確認するか、取得済みの画面へ戻ってください。'
						: 'オンライン時に一度開くと、次回から利用できる場合があります。'
				}
			/>
			<div className="empty-state">
				<h2>オフラインで開けないとき</h2>
				<p>
					入力中の学習データは削除していません。取得済みの主要画面へ戻り、通信復帰後にこのURLをもう一度開いてください。
				</p>
				<a className="button button--primary" href="/today">
					今日のCoreへ戻る
				</a>
			</div>
		</AppShell>
	);
}

function UnknownRoute() {
	return <OfflineHelp unknownPath />;
}

function RouteEffects() {
	const location = useLocation();
	const initialRender = useRef(true);
	useEffect(() => {
		const routeName: Record<string, string> = {
			'/today': '今日',
			'/curriculum': `${AVAILABLE_CURRICULUM_TOTAL_DAYS}日の地図`,
			'/reviews': '期限が来た復習',
			'/voice': '会話AIへ持っていく',
			'/import': '会話結果JSONを取込',
			'/settings': '設定',
			'/backup': 'バックアップと復元',
			'/sessions': 'セッション履歴',
			'/assessment': 'Stage Assessment',
		};
		document.title = `${routeName[location.pathname] ?? 'Trellune'} · Trellune`;
		const timer = window.setTimeout(() => {
			if (initialRender.current) {
				initialRender.current = false;
				return;
			}
			document.querySelector<HTMLElement>('main h1')?.focus();
		}, 0);
		return () => window.clearTimeout(timer);
	}, [location.pathname]);
	return null;
}

export default function App() {
	return (
		<>
			<RouteEffects />
			<Routes>
				<Route path="/onboarding" element={<Onboarding />} />
				<Route
					path="/*"
					element={
						<RequireOnboarding>
							<Routes>
								<Route path="/" element={<Navigate to="/today" replace />} />
								<Route path="/baseline" element={<Baseline />} />
								<Route path="/assessment" element={<StageAssessmentPage />} />
								<Route path="/today" element={<Today />} />
								<Route path="/curriculum" element={<Curriculum />} />
								<Route path="/curriculum/:day" element={<CurriculumDetail />} />
								<Route path="/grammar" element={<Grammar />} />
								<Route path="/vocabulary" element={<Library kind="vocabulary" />} />
								<Route path="/phrases" element={<Library kind="phrases" />} />
								<Route path="/reviews" element={<Reviews />} />
								<Route path="/mistakes" element={<Mistakes />} />
								<Route path="/voice" element={<Voice />} />
								<Route path="/import" element={<SessionImport />} />
								<Route path="/sessions" element={<Sessions />} />
								<Route path="/sessions/:sessionId" element={<SessionDetail />} />
								<Route path="/analytics" element={<Analytics />} />
								<Route path="/boost" element={<Boost />} />
								<Route path="/backup" element={<Backup />} />
								<Route path="/settings" element={<Settings />} />
								<Route path="/offline" element={<OfflineHelp />} />
								<Route path="*" element={<UnknownRoute />} />
							</Routes>
						</RequireOnboarding>
					}
				/>
			</Routes>
		</>
	);
}
