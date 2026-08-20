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
import { localizeUiMessage, useLocale } from './i18n';
import { usePwaUpdate, type PwaUpdateStatus } from './pwa/update';

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
const coreSteps: Array<{
	key: CoreDisplayStep;
	titleKey: 'core.reviews' | 'core.grammar' | 'core.conversationImport';
	detail: (locale: 'ja' | 'en') => string;
	to: string;
	tone: string;
}> = [
	{
		key: 'reviews',
		titleKey: 'core.reviews',
		detail: (locale) => (locale === 'ja' ? '7枚 · 約5分' : '7 cards · about 5 min'),
		to: '/reviews',
		tone: 'cyan',
	},
	{
		key: 'grammar',
		titleKey: 'core.grammar',
		detail: (locale) => (locale === 'ja' ? 'be動詞で自己紹介' : 'Introduce yourself with be'),
		to: '/grammar',
		tone: 'pear',
	},
	{
		key: 'import',
		titleKey: 'core.conversationImport',
		detail: (locale) =>
			locale === 'ja' ? '話した結果JSONを取り込む' : 'Import your conversation result JSON',
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
	const { locale, setLocale, t } = useLocale();
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
				<label className="onboarding-locale-select">
					<span>{t('language.label')}</span>
					<select
						value={locale}
						onChange={(event) => setLocale(event.target.value as typeof locale)}
					>
						<option value="ja">{t('language.ja')}</option>
						<option value="en">{t('language.en')}</option>
					</select>
				</label>
				<span className="wordmark wordmark--standalone">
					<span className="wordmark__mark">TL</span>Trellune
				</span>
				<h1 tabIndex={-1}>{t('onboarding.heading')}</h1>
				<p>{t('onboarding.description')}</p>
				<ul className="onboarding-facts" aria-label={t('onboarding.factsLabel')}>
					<li>{t('onboarding.fact.local')}</li>
					<li>{t('onboarding.fact.privacy')}</li>
					<li>{t('onboarding.fact.ai')}</li>
					<li>{t('onboarding.fact.offline')}</li>
				</ul>
				<div className="onboarding-track" aria-label={t('onboarding.trackLabel')}>
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
									field === 'learnerName'
										? locale === 'ja'
											? '呼ばれたい名前を入力してください。'
											: 'Enter a name to use in the app.'
										: field === 'timeZone'
											? locale === 'ja'
												? '有効なIANAタイムゾーンを入力してください。'
												: 'Enter a valid IANA time zone.'
											: locale === 'ja'
												? '開始日を入力してください。'
												: 'Choose a start date.';
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
				<h2>{t('onboarding.setup')}</h2>
				<label className="field">
					<span>{t('onboarding.name')}</span>
					<input
						value={name}
						onChange={(event) => {
							setName(event.target.value);
							setErrors((current) => ({ ...current, learnerName: '' }));
						}}
						placeholder={locale === 'ja' ? '例: Alex' : 'For example: Alex'}
						autoComplete="name"
						aria-invalid={Boolean(errors.learnerName)}
						aria-describedby="learner-name-help learner-name-error"
					/>
					<small id="learner-name-help">{t('onboarding.nameHelp')}</small>
					{errors.learnerName ? (
						<small id="learner-name-error" className="field-error">
							{errors.learnerName}
						</small>
					) : null}
				</label>
				<fieldset className="choice-group">
					<legend>{t('onboarding.minutes')}</legend>
					{[10, 20, 30].map((value) => (
						<label key={value} className={minutes === value ? 'choice is-selected' : 'choice'}>
							<input
								type="radio"
								name="minutes"
								value={value}
								checked={minutes === value}
								onChange={() => setMinutes(value)}
							/>
							<span>{locale === 'ja' ? `${value}分` : `${value} min`}</span>
						</label>
					))}
				</fieldset>
				<label className="field">
					<span>{t('onboarding.timezone')}</span>
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
					<small id="time-zone-help">{t('onboarding.timezoneHelp')}</small>
					{errors.timeZone ? (
						<small id="time-zone-error" className="field-error">
							{errors.timeZone}
						</small>
					) : null}
				</label>
				<label className="field">
					<span>{t('onboarding.startDate')}</span>
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
					<small id="start-date-help">{t('onboarding.startDateHelp')}</small>
					{errors.startDate ? (
						<small id="start-date-error" className="field-error">
							{errors.startDate}
						</small>
					) : null}
				</label>
				<button className="button button--primary" type="submit">
					{t('onboarding.start')}
					<Icon name="arrow" />
				</button>
				<p className="form-note">
					{locale === 'ja'
						? 'アカウント作成はありません。学習データはこの端末から始まります。'
						: 'No account is created. Learning data starts on this device.'}
				</p>
				{operationError ? (
					<p className="feedback is-error" role="alert">
						{localizeUiMessage(operationError, locale)}
					</p>
				) : null}
			</form>
		</main>
	);
}

function Baseline() {
	const navigate = useNavigate();
	const { recordBaseline, setEditorDirty } = useAppState();
	const { formatNumber, locale, t } = useLocale();
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
				title={locale === 'ja' ? '話し始める前の記録' : 'A record before you begin speaking'}
				description={
					locale === 'ja'
						? '今の自分を測るだけ。点数でコースを短くしたり長くしたりはしません。'
						: 'This simply records where you are now. Scores never make the course shorter or longer.'
				}
			/>
			<section className="split-panel">
				<div className="surface surface--cyan">
					<h2>{locale === 'ja' ? '会話AIで8分話す' : 'Talk with Conversation AI for 8 minutes'}</h2>
					<ol className="plain-steps">
						<li>{locale === 'ja' ? '自己紹介' : 'Introduce yourself'}</li>
						<li>{locale === 'ja' ? '昨日したこと' : 'Talk about yesterday'}</li>
						<li>{locale === 'ja' ? '来週したいこと' : 'Say what you want to do next week'}</li>
						<li>
							{locale === 'ja'
								? '分からない時の聞き返し'
								: 'Ask for clarification when you do not understand'}
						</li>
					</ol>
					<button className="button" type="button" onClick={() => navigate('/voice?mode=baseline')}>
						{locale === 'ja' ? 'ベースライン用プロンプト' : 'Baseline prompt'}
					</button>
				</div>
				<form
					className="surface"
					onSubmit={(event) => {
						event.preventDefault();
						validate();
					}}
				>
					<h2>
						{locale === 'ja'
							? '評価JSONを確認して取り込む'
							: 'Validate and import the assessment JSON'}
					</h2>
					<p>
						{locale === 'ja'
							? 'Voice終了後に表示されたベースラインJSONを貼り付けます。SESSION_JSONとは別です。'
							: 'Paste the baseline JSON shown after Voice. It is separate from SESSION_JSON.'}
					</p>
					<label className="field" htmlFor="baseline-json">
						<span>
							{locale === 'ja'
								? '会話AIが返したベースラインJSON'
								: 'Baseline JSON returned by your Conversation AI'}
						</span>
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
							{locale === 'ja' ? '入力上限 1MB（現在 ' : 'Input limit 1 MB (currently '}
							{formatNumber(byteLength)} / {formatNumber(MAX_SESSION_SOURCE_BYTES)} bytes
							{locale === 'ja' ? '）' : ')'}
						</small>
					</label>
					<button className="button button--primary" type="submit">
						{t('assessment.preview')}
					</button>
					<div id="baseline-feedback" aria-live="polite">
						{result?.errors.length ? (
							<div className="error-box" role="alert">
								<strong>{t('error.cannotSave')}</strong>
								<ul>
									{result.errors.map((error) => (
										<li key={error}>{localizeUiMessage(error, locale)}</li>
									))}
								</ul>
							</div>
						) : result?.assessment ? (
							<div className="preview-data">
								<p>
									{locale === 'ja'
										? '5観点と自己評価を確認しました。保存前は端末データを変更していません。'
										: 'Five measures and self-confidence are ready to review. Nothing has changed on this device yet.'}
								</p>
								<dl>
									<dt>{locale === 'ja' ? '自信' : 'Confidence'}</dt>
									<dd>{result.assessment.confidence}/5</dd>
									<dt>
										{locale === 'ja'
											? '課題達成 / 文法 / 語彙 / 流暢さ / やり取り'
											: 'Task completion / grammar / vocabulary / fluency / interaction'}
									</dt>
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
									{locale === 'ja' ? '評価を保存してDay 1へ' : 'Save assessment and go to Day 1'}
								</button>
							</div>
						) : null}
					</div>
					<button className="button" type="button" onClick={() => navigate('/today')}>
						{locale === 'ja' ? 'Day 1を始める（今回はスキップ）' : 'Start Day 1 (skip for now)'}
					</button>
					{message ? (
						<p
							className={`feedback${messageIsError ? ' is-error' : ' is-success'}`}
							role={messageIsError ? 'alert' : 'status'}
						>
							{localizeUiMessage(message, locale)}
						</p>
					) : null}
				</form>
			</section>
		</AppShell>
	);
}

const assessmentSkillLabelsJa: Record<AssessmentSkill, string> = {
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

const assessmentSkillLabelsEn: Record<AssessmentSkill, string> = {
	grammar: 'Grammar',
	vocabulary: 'Vocabulary',
	speaking: 'Speaking',
	fluency: 'Fluency',
	interaction: 'Interaction',
	listening: 'Listening',
	pronunciation: 'Pronunciation',
	reading: 'Reading',
	writing: 'Writing',
};

function assessmentSkillLabel(skill: AssessmentSkill, locale: 'ja' | 'en'): string {
	return (locale === 'ja' ? assessmentSkillLabelsJa : assessmentSkillLabelsEn)[skill];
}

const assessmentResultLabels = {
	pass: 'Pass',
	provisional: '暫定評価',
	'reinforcement-recommended': '補強を推奨',
} as const;

function assessmentResultLabel(
	result: keyof typeof assessmentResultLabels,
	locale: 'ja' | 'en',
): string {
	if (locale === 'ja') return assessmentResultLabels[result];
	return result === 'pass'
		? 'Pass'
		: result === 'provisional'
			? 'Provisional'
			: 'Reinforcement recommended';
}

function StageAssessmentPage() {
	const { data, recordStageAssessment, setEditorDirty } = useAppState();
	const { formatDateTime, formatNumber, locale, t } = useLocale();
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
				title={t('assessment.title')}
				description={
					locale === 'ja'
						? 'Stageごとのtask evidenceを保存します。Graduationは8技能を統合して推定し、正式なCEFR認定やCoreのlockには使いません。'
						: 'Save task evidence for each stage. Graduation combines evidence across eight skills; it is neither formal CEFR certification nor a Core lock.'
				}
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
					{locale === 'ja' ? '評価対象' : 'Skills assessed'}:{' '}
					{definition.requiredSkills
						.map((skill) => assessmentSkillLabel(skill, locale))
						.join(locale === 'ja' ? '・' : ' · ')}
				</p>
				{definition.skillRubrics ? (
					<details className="assessment-rubric">
						<summary>
							{locale === 'ja'
								? '1–5 rubricとCEFR推定条件を確認'
								: 'Review the 1–5 rubric and CEFR estimate conditions'}
						</summary>
						<div className="assessment-rubric__content">
							{definition.requiredSkills.map((skill) => (
								<section key={skill}>
									<h3>{assessmentSkillLabel(skill, locale)}</h3>
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
									<strong>{locale === 'ja' ? 'Profile guardrail' : 'Profile guardrail'}</strong>
									<p>
										{locale === 'ja'
											? `B2-entryは全skill ${definition.cefrEstimateGuardrails.b2EntryMinimumScore}/5以上、B2はpassかつ全skill ${definition.cefrEstimateGuardrails.b2MinimumScore}/5以上が必要です。平均点で弱いskillを隠しません。`
											: `B2-entry requires every skill at ${definition.cefrEstimateGuardrails.b2EntryMinimumScore}/5 or above. B2 requires a pass and every skill at ${definition.cefrEstimateGuardrails.b2MinimumScore}/5 or above; an average cannot hide a weak skill.`}
									</p>
								</div>
							) : null}
						</div>
					</details>
				) : null}
				{definition.cefrEstimateScope === 'spoken' ? (
					<p>
						{locale === 'ja'
							? 'このAssessmentのCEFR推定は会話・Listening中心です。Reading/Writingを含むfull CEFRの認定・保証には使用しません。'
							: 'This CEFR estimate is centred on conversation and listening. It is not evidence for, or a guarantee of, full CEFR attainment including Reading and Writing.'}
					</p>
				) : definition.cefrEstimateScope === 'integrated' ? (
					<p>
						{locale === 'ja'
							? 'Reading・Writing・Listening・会話のtask evidenceを統合して推定します。日数やpassだけでは判定せず、正式なCEFR認定でもありません。'
							: 'This combines task evidence for Reading, Writing, Listening, and conversation. It is not determined by days or a pass alone, and it is not formal CEFR certification.'}
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
					{attemptId
						? locale === 'ja'
							? '新しいAssessmentを開始'
							: 'Start a new assessment'
						: locale === 'ja'
							? 'Assessmentを開始'
							: 'Start assessment'}
				</button>
			</section>
			{prompt ? (
				<section className="prompt-panel">
					<div className="prompt-panel__head">
						<div>
							<span>{t('voice.copyOnly')}</span>
							<h2>Stage Assessment prompt</h2>
						</div>
						<button className="button" type="button" onClick={() => void copyPrompt()}>
							<Icon name="copy" />{' '}
							{copyStatus === 'copied' ? t('voice.copied') : t('assessment.copyPrompt')}
						</button>
					</div>
					<pre>{prompt}</pre>
					<p>
						{locale === 'ja'
							? '先にこのテキストを送信し、その後Voiceを開始します。終了後にASSESSMENT_JSONを明示的に依頼してください。'
							: 'Send this text first, then start Voice. Afterward, explicitly request ASSESSMENT_JSON.'}
					</p>
					{copyStatus === 'failed' ? (
						<p className="feedback is-error">
							{locale === 'ja' ? 'コピーできませんでした。' : 'Could not copy.'}
						</p>
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
				<h2>
					{locale === 'ja'
						? 'ASSESSMENT_JSONを確認して取り込む'
						: 'Validate and import ASSESSMENT_JSON'}
				</h2>
				<label className="field" htmlFor="assessment-json">
					<span>{t('assessment.resultJson')}</span>
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
						{locale === 'ja' ? '入力上限 1MB（現在 ' : 'Input limit 1 MB (currently '}
						{formatNumber(byteLength)} / {formatNumber(MAX_ASSESSMENT_SOURCE_BYTES)} bytes
						{locale === 'ja' ? '）' : ')'}
					</small>
				</label>
				<button className="button button--primary" type="submit">
					{t('assessment.preview')}
				</button>
				<div id="assessment-feedback" aria-live="polite">
					{result?.warnings.map((warning) => (
						<p key={warning}>{localizeUiMessage(warning, locale)}</p>
					))}
					{result?.errors.length ? (
						<div className="error-box" role="alert">
							<strong>{t('error.cannotSave')}</strong>
							<ul>
								{result.errors.map((error) => (
									<li key={error}>{localizeUiMessage(error, locale)}</li>
								))}
							</ul>
						</div>
					) : result?.assessment ? (
						<div className="preview-data">
							<dl>
								<dt>{t('assessment.result')}</dt>
								<dd>{assessmentResultLabel(result.assessment.result, locale)}</dd>
								{result.assessment.cefrEstimate ? (
									<>
										<dt>
											{result.assessment.cefrEstimateScope === 'integrated'
												? locale === 'ja'
													? '統合8技能CEFR推定（認定ではありません）'
													: 'Integrated eight-skill CEFR estimate (not a certification)'
												: locale === 'ja'
													? '会話・Listening中心の推定（full CEFR認定ではありません）'
													: 'Conversation and listening estimate (not a full CEFR certification)'}
										</dt>
										<dd>{result.assessment.cefrEstimate}</dd>
									</>
								) : null}
								<dt>{t('assessment.skills')}</dt>
								<dd>
									{(Object.entries(result.assessment.scores) as Array<[AssessmentSkill, number]>)
										.map(([skill, score]) => `${assessmentSkillLabel(skill, locale)} ${score}/5`)
										.join(' · ')}
								</dd>
								<dt>{t('assessment.strengths')}</dt>
								<dd>
									{result.assessment.strengths.join(' / ') || (locale === 'ja' ? 'なし' : 'None')}
								</dd>
								<dt>{t('assessment.targets')}</dt>
								<dd>
									{result.assessment.reinforcementTargets.join(' / ') ||
										(locale === 'ja' ? 'なし' : 'None')}
								</dd>
								<dt>{t('assessment.evidence')}</dt>
								<dd>
									{result.assessment.evidence.map((item) => item.note).join(' / ') ||
										(locale === 'ja' ? 'なし' : 'None')}
								</dd>
								<dt>{t('assessment.nextTargets')}</dt>
								<dd>
									{result.assessment.nextTargets.join(' / ') || (locale === 'ja' ? 'なし' : 'None')}
								</dd>
							</dl>
							<button className="button button--primary" type="button" onClick={() => void save()}>
								{t('assessment.save')}
							</button>
						</div>
					) : null}
				</div>
				{message ? (
					<p
						className={`feedback${messageIsError ? ' is-error' : ' is-success'}`}
						role={messageIsError ? 'alert' : 'status'}
					>
						{localizeUiMessage(message, locale)}
					</p>
				) : null}
			</form>
			<section className="session-list" aria-labelledby="assessment-history-title">
				<h2 id="assessment-history-title">{t('assessment.history')}</h2>
				{data.stageAssessments.length ? (
					data.stageAssessments.map((assessment) => (
						<article key={assessment.attemptId}>
							<div>
								<strong>{assessmentResultLabel(assessment.result, locale)}</strong>
								{assessment.cefrEstimate ? (
									<span>
										{assessment.cefrEstimateScope === 'integrated'
											? locale === 'ja'
												? '統合8技能CEFR推定'
												: 'Integrated eight-skill CEFR estimate'
											: locale === 'ja'
												? '会話・Listening中心の推定'
												: 'Conversation and listening estimate'}{' '}
										{assessment.cefrEstimate}
										{locale === 'ja' ? '（認定ではありません）' : ' (not a certification)'}
									</span>
								) : null}
								<p>
									{formatDateTime(assessment.completedAt)} ·{' '}
									{Object.keys(assessment.scores)
										.map((skill) => assessmentSkillLabel(skill as AssessmentSkill, locale))
										.join('・')}
								</p>
							</div>
							<strong>
								{assessment.strengths.join(' / ') || (locale === 'ja' ? '記録済み' : 'Recorded')}
							</strong>
						</article>
					))
				) : (
					<div className="empty-state">
						<p>{t('assessment.noHistory')}</p>
					</div>
				)}
			</section>
		</AppShell>
	);
}

function Today() {
	const { data } = useAppState();
	const { locale, t } = useLocale();
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
					title={t('today.beforeStart')}
					description={t('today.beforeStartDescription', {
						date: data.startDate ?? t('settings.title'),
					})}
				/>
			</AppShell>
		);
	}
	if (data.studyStatus === 'graduated') {
		const canBoostToday = Object.values(data.core).every(Boolean);
		return (
			<AppShell>
				<PageHeader
					title={t('today.graduated', { days: AVAILABLE_CURRICULUM_TOTAL_DAYS })}
					description={t('today.graduatedDescription')}
				/>
				{canBoostToday ? (
					<button className="button button--dark" type="button" onClick={() => navigate('/boost')}>
						{t('today.chooseFinalBoost', { days: AVAILABLE_CURRICULUM_TOTAL_DAYS })}
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
								? locale === 'ja'
									? `Core ${minuteRange(currentStage.timeGuidance.minimumCoreMinutes)}分 · 推奨 ${minuteRange(currentStage.timeGuidance.recommendedMinutes)}分`
									: `Core ${minuteRange(currentStage.timeGuidance.minimumCoreMinutes)} min · Recommended ${minuteRange(currentStage.timeGuidance.recommendedMinutes)} min`
								: t('today.minutes', { count: data.dailyMinutes })}
						</span>
						<span>{t('today.streak', { count: data.streak })}</span>
					</div>
					{nextCoreStep ? (
						<button
							className="button button--primary today-next-action"
							type="button"
							onClick={() => navigate(nextCoreStep.to)}
						>
							{t('today.next')} · {t(nextCoreStep.titleKey)}
						</button>
					) : null}
				</div>
				<ProgressRing value={percent} label="Core" />
			</section>
			<section className="core-section">
				<div className="section-heading">
					<div>
						<h2>{t('today.core')}</h2>
						<p>{t('today.coreDescription')}</p>
					</div>
					<strong>{completed}/3</strong>
				</div>
				<div className="core-list">
					{coreSteps.map((step, index) => (
						<button
							key={step.key}
							className={`core-step tone-${step.tone}${data.core[step.key] ? ' is-complete' : ''}`}
							type="button"
							aria-label={`${t(step.titleKey)} · ${data.core[step.key] ? t('core.completed') : t('core.incomplete')}`}
							onClick={() => navigate(step.to)}
						>
							<span className="core-step__number">
								{data.core[step.key] ? <Icon name="check" /> : index + 1}
							</span>
							<span>
								<strong>{t(step.titleKey)}</strong>
								<small>
									{step.key === 'grammar' && currentPracticeMinutes > 0
										? `${current.grammar.title} · ${t('curriculum.practiceDescription')} ${t('curriculum.minutes', { count: currentPracticeMinutes })}`
										: step.detail(locale)}
								</small>
							</span>
							<Icon name="arrow" className="core-step__arrow" />
						</button>
					))}
				</div>
			</section>
			<section className="boost-strip">
				<div>
					<h2>{percent === 100 ? t('today.boostReady') : t('today.boostAfter')}</h2>
					<p>{t('today.boostDescription')}</p>
				</div>
				<button
					className="button button--dark"
					type="button"
					disabled={percent !== 100}
					onClick={() => navigate('/boost')}
				>
					{t('today.chooseBoost')}
				</button>
			</section>
		</AppShell>
	);
}

function Curriculum() {
	const { data } = useAppState();
	const { locale, t } = useLocale();
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
				title={t('curriculum.title', { days: AVAILABLE_CURRICULUM_TOTAL_DAYS })}
				description={t('curriculum.description')}
				action={
					<button className="button" type="button" onClick={() => navigate('/assessment')}>
						Stage Assessment
					</button>
				}
			/>
			<div className="phase-tabs" role="tablist" aria-label={t('curriculum.stage')}>
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
					{locale === 'ja'
						? `Core ${minuteRange(stage.timeGuidance.minimumCoreMinutes)}分 · 推奨${minuteRange(stage.timeGuidance.recommendedMinutes)}分 · Boost込み最大${stage.timeGuidance.maximumWithBoostMinutes}分`
						: `Core ${minuteRange(stage.timeGuidance.minimumCoreMinutes)} min · Recommended ${minuteRange(stage.timeGuidance.recommendedMinutes)} min · Up to ${stage.timeGuidance.maximumWithBoostMinutes} min with Boost`}
				</p>
				{selectedStageContainsCurrentDay ? (
					<button
						className="button curriculum-current-action"
						type="button"
						onClick={() => navigate(`/curriculum/${data.currentDay}`)}
					>
						{t('curriculum.backToDay', { day: data.currentDay })}
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
								<span>
									{containsCurrentDay ? t('curriculum.currentUnit') : t('curriculum.open')}
								</span>
							</summary>
							<div className="curriculum-unit__days">
								{CURRICULUM.filter((day) => unit.startDay <= day.day && day.day <= unit.endDay).map(
									(day) => {
										const statusKey = data.completedDays.includes(day.day)
											? 'complete'
											: day.day === data.currentDay
												? 'today'
												: data.previewedDays.includes(day.day)
													? 'previewed'
													: 'not-started';
										const status =
											statusKey === 'complete'
												? t('curriculum.completed')
												: statusKey === 'today'
													? t('curriculum.today')
													: statusKey === 'previewed'
														? t('curriculum.previewed')
														: t('curriculum.notStarted');
										return (
											<button
												key={day.day}
												className={`curriculum-row status-${statusKey}`}
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
	const { locale, t } = useLocale();
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
					<h2>{t('curriculum.vocabulary')}</h2>
					<p>{day.vocabulary.map((item) => item.text).join(' · ')}</p>
				</article>
				<article className="surface">
					<h2>{t('curriculum.phrases')}</h2>
					<ul>
						{day.phrases.map((item) => (
							<li key={item.id}>{item.text}</li>
						))}
					</ul>
				</article>
				<article className="surface surface--coral">
					<h2>{t('curriculum.voiceTask')}</h2>
					<p>{day.voiceTask}</p>
				</article>
			</div>
			{lesson?.practiceBlocks.length ? (
				<section className="practice-library" aria-labelledby="practice-library-title">
					<div className="section-heading">
						<div>
							<p className="eyebrow">{t('curriculum.practiceDescription')}</p>
							<h2 id="practice-library-title">{t('curriculum.practice')}</h2>
						</div>
						<p>
							{t('curriculum.minutes', {
								count: lesson.practiceBlocks.reduce(
									(sum, block) => sum + block.estimatedMinutes,
									0,
								),
							})}
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
													{locale === 'ja'
														? `英語 ${prompt.output.minimumWords}〜${prompt.output.maximumWords}語`
														: `${prompt.output.minimumWords}–${prompt.output.maximumWords} English words`}
												</small>
											) : null}
										</li>
									))}
								</ol>
								{block.output ? (
									<p className="practice-meta">
										{locale === 'ja'
											? `英語 ${block.output.minimumWords}〜${block.output.maximumWords}語 · ${block.estimatedMinutes}分`
											: `${block.output.minimumWords}–${block.output.maximumWords} English words · ${block.estimatedMinutes} min`}
									</p>
								) : null}
							</article>
						))}
					</div>
				</section>
			) : null}
			{day.day > data.currentDay ? (
				<p className="feedback">{t('curriculum.futurePreview')}</p>
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
	const { locale, t } = useLocale();
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
		? locale === 'ja'
			? '入力後に答えを確認します。'
			: 'Enter an answer, then check it.'
		: !correct
			? `${t('grammar.incorrect')} ${day.grammar.expectedAnswer}`
			: practiceBlocks.length > 0 && !practiceVisible
				? locale === 'ja'
					? '正解です。続けて、下の練習で自分の英文を作ります。'
					: 'Correct. Continue below and create your own English.'
				: practiceBlocks.length > 0 && !practiceInputsReady
					? practiceAttempted
						? locale === 'ja'
							? '未入力の欄、または語数を確認してください。練習文は端末へ保存されません。'
							: 'Complete each response and check the word count. Practice responses are not saved on this device.'
						: locale === 'ja'
							? '各課題へ英語で答え、語数を確認してから完了します。'
							: 'Answer each task in English and check the word count before continuing.'
					: practiceBlocks.length > 0 && !practiceReviewed
						? locale === 'ja'
							? '回答後にフィードバックを開き、要点とrubricを自己点検してください。必要なら同じ欄で修正できます。'
							: 'Open feedback after answering, compare key points and the rubric, and revise in the same field if useful.'
						: saving
							? `${t('grammar.correct')} ${t('grammar.saving')}`
							: saveResult?.ok
								? locale === 'ja'
									? '正解です。次は声に出して3回。'
									: 'Correct. Say it aloud three times next.'
								: saveResult
									? localizeUiMessage(saveResult.message, locale)
									: t('error.generic');
	return (
		<AppShell>
			<PageHeader title={day.grammar.title} description={day.grammar.focus} />
			<section className="lesson-layout">
				<article className="lesson-note">
					<h2>{t('grammar.usedInConversation')}</h2>
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
					<h2>{t('grammar.checkForm')}</h2>
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
															{locale === 'ja'
																? `${promptWords}語 / ${prompt.output.minimumWords}〜${prompt.output.maximumWords}語`
																: `${promptWords} words / ${prompt.output.minimumWords}–${prompt.output.maximumWords} words`}
														</small>
													) : null}
													{practiceFeedbackRevealed[prompt.id] ? (
														<section
															className="practice-feedback"
															aria-label={
																locale === 'ja'
																	? `${index + 1}のフィードバック`
																	: `Feedback for question ${index + 1}`
															}
														>
															<div className="practice-feedback__head">
																<div>
																	<p className="eyebrow">Step 3 / 3 · Compare & retry</p>
																	<h4>{t('grammar.compareRetry')}</h4>
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
																	{practiceCopyId === prompt.id
																		? t('grammar.copied')
																		: t('grammar.copyFeedback')}
																</button>
															</div>
															{practiceInitialResponses[prompt.id] !== promptResponse ? (
																<details>
																	<summary>
																		{locale === 'ja'
																			? '最初の回答と修正版を比較'
																			: 'Compare your first response and revision'}
																	</summary>
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
																	<strong>{locale === 'ja' ? '本文のclue' : 'Text clue'}:</strong>{' '}
																	{prompt.feedback.evidenceClue}
																</p>
															) : null}
															{prompt.feedback.commonErrors?.length ? (
																<details>
																	<summary>
																		{locale === 'ja' ? 'よくある見落とし' : 'Common things to miss'}
																	</summary>
																	<ul>
																		{prompt.feedback.commonErrors.map((error) => (
																			<li key={error}>{error}</li>
																		))}
																	</ul>
																</details>
															) : null}
															<fieldset className="practice-checklist">
																<legend>{t('grammar.selfCheck')}</legend>
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
																	<span>{t('grammar.reviewed')}</span>
																</label>
															</fieldset>
															<p className="practice-meta">{t('grammar.editRetry')}</p>
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
															{t('grammar.viewFeedback')}
														</button>
													)}
												</div>
											);
										})}
										{block.output ? (
											<p className={`practice-meta${invalid ? ' is-error' : ''}`}>
												{locale === 'ja'
													? `${words}語 / ${block.output.minimumWords}〜${block.output.maximumWords}語`
													: `${words} words / ${block.output.minimumWords}–${block.output.maximumWords} words`}
											</p>
										) : null}
									</article>
								);
							})}
						</div>
					) : null}
					<button className="button button--primary" type="submit" disabled={saving}>
						{saving
							? t('grammar.saving')
							: practiceVisible
								? t('grammar.completeAndSave')
								: t('grammar.checkAnswer')}
					</button>
				</form>
			</section>
		</AppShell>
	);
}

function Library({ kind }: { kind: 'vocabulary' | 'phrases' }) {
	const { data } = useAppState();
	const { locale, t } = useLocale();
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
				title={kind === 'vocabulary' ? t('curriculum.vocabulary') : t('curriculum.phrases')}
				description={
					kind === 'vocabulary'
						? locale === 'ja'
							? '能動語彙600–800語を、会話の場面と一緒に覚えます。'
							: 'Build 600–800 active words alongside the situations where you can use them.'
						: locale === 'ja'
							? '会話を止めない150表現を集めます。'
							: 'Collect 150 useful phrases that keep a conversation moving.'
				}
			/>
			<label className="search-field">
				<span>{t('library.search')}</span>
				<input
					type="search"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder={locale === 'ja' ? '英語またはテーマ' : 'English or topic'}
				/>
			</label>
			<label className="search-field">
				<span>{t('library.status')}</span>
				<select value={status} onChange={(event) => setStatus(event.target.value)}>
					<option value="all">{t('library.all')}</option>
					<option value="curriculum">{t('library.notAcquired')}</option>
					<option value="previewed">{t('library.previewed')}</option>
					<option value="new">{t('library.new')}</option>
					<option value="learning">{t('library.learning')}</option>
					<option value="learned">{t('library.learned')}</option>
				</select>
			</label>
			<p className="result-count" aria-live="polite">
				{locale === 'ja' ? `${filtered.length}件` : `${filtered.length} items`}
			</p>
			<div className="library-list">
				{filtered.map((item, index) => (
					<article key={`${item.day}-${item.term}-${index}`}>
						<span>{item.day ? `DAY ${item.day}` : 'VOICE'}</span>
						<strong>{item.term}</strong>
						<small>{item.note}</small>
						<small>
							{t('library.status')}: {item.status}
						</small>
					</article>
				))}
			</div>
		</AppShell>
	);
}

function Reviews() {
	const { data, completeStep, gradeReview } = useAppState();
	const { locale, t } = useLocale();
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
				title={t('reviews.title')}
				description={
					locale === 'ja'
						? `${data.reviewCount}枚 · 間隔反復は少ない量を、忘れる直前に戻します。`
						: `${data.reviewCount} cards · Spaced retrieval brings a small amount back just before you forget it.`
				}
			/>
			<section className="review-workspace">
				{card ? (
					<button
						className={`review-card${revealed ? ' is-revealed' : ''}`}
						type="button"
						onClick={() => setRevealed(true)}
						aria-label={
							revealed
								? `${locale === 'ja' ? '答え' : 'Answer'}: ${card.back}`
								: `${locale === 'ja' ? '問題' : 'Question'}: ${card.front}. ${t('reviews.tapReveal')}`
						}
					>
						<span>{revealed ? 'ANSWER' : 'QUESTION'}</span>
						<strong>{revealed ? card.back : card.front}</strong>
						<small>{revealed ? t('reviews.gradePrompt') : t('reviews.tapReveal')}</small>
					</button>
				) : (
					<p className="feedback is-success" role="status">
						{locale === 'ja'
							? '今日が期限のカードはありません。復習は完了です。'
							: 'There are no cards due today. Your reviews are complete.'}
					</p>
				)}
				{card && revealed ? (
					<div className="grade-row">
						<button type="button" onClick={() => void grade('again')}>
							{locale === 'ja' ? 'もう一度' : 'Again'}
						</button>
						<button type="button" onClick={() => void grade('hard')}>
							{locale === 'ja' ? '難しい' : 'Hard'}
						</button>
						<button type="button" onClick={() => void grade('good')}>
							{locale === 'ja' ? 'できた' : 'Good'}
						</button>
						<button type="button" onClick={() => void grade('easy')}>
							{locale === 'ja' ? '簡単' : 'Easy'}
						</button>
					</div>
				) : null}
			</section>
		</AppShell>
	);
}

function Mistakes() {
	const { data } = useAppState();
	const { locale, t } = useLocale();
	return (
		<AppShell>
			<PageHeader
				title={t('mistakes.title')}
				description={
					locale === 'ja'
						? '同じミスが3回以上なら、次のBoostでWeakness Attackを優先します。'
						: 'When the same mistake appears three times or more, your next Boost prioritizes Weakness Attack.'
				}
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
							{locale === 'ja' ? `${item.repetitions}回` : `${item.repetitions} times`}
						</span>
					</article>
				))}
			</div>
		</AppShell>
	);
}

function Voice() {
	const { data } = useAppState();
	const { locale, t } = useLocale();
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
				title={t('voice.title')}
				description={
					locale === 'ja'
						? '自動送信はしません。プロンプトをコピーし、自分で選ぶ会話AIで練習します。'
						: 'Nothing is sent automatically. Copy the prompt and practise with the Conversation AI you choose.'
				}
			/>
			<div className="bridge-layout">
				<aside
					className="mode-list"
					aria-label={locale === 'ja' ? 'プロンプトの種類' : 'Prompt type'}
				>
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
									? locale === 'ja'
										? 'Core会話'
										: 'Core conversation'
									: item === 'study'
										? 'Study Mode'
										: item === 'weekly'
											? locale === 'ja'
												? '週次評価'
												: 'Weekly review'
											: item.replace('boost-', 'Boost ')}
								{item.startsWith('boost') ? (locale === 'ja' ? '分' : ' min') : ''}
							</button>
						),
					)}
				</aside>
				<section className="prompt-panel">
					<label className="field">
						<span>{t('voice.provider')}</span>
						<select
							value={providerId}
							onChange={(event) => setProviderId(event.target.value as ConversationProviderId)}
						>
							{CONVERSATION_PROVIDER_PRESETS.map((preset) => (
								<option key={preset.id} value={preset.id}>
									{preset.label} (
									{preset.testedStatus === 'tested'
										? locale === 'ja'
											? '確認済み'
											: 'tested'
										: locale === 'ja'
											? '未検証'
											: 'unverified'}
									)
								</option>
							))}
						</select>
						<small>{provider.setupNoteJa}</small>
					</label>
					{(mode === 'core' || mode.startsWith('boost-')) &&
					provider.capabilities.voiceConversation !== 'tested' ? (
						<p className="feedback">
							{locale === 'ja'
								? 'このプリセットのVoice対応は未検証です。Voiceを使えない場合、会話・Listeningを含むCoreの代替にはなりません。'
								: 'Voice support for this preset is unverified. Without Voice, it does not substitute for Core practice that includes conversation and listening.'}
						</p>
					) : null}
					<div className="prompt-panel__head">
						<div>
							<span>{t('voice.copyOnly')}</span>
							<h2>
								{mode === 'core'
									? locale === 'ja'
										? '今日のCore会話'
										: "Today's Core conversation"
									: mode === 'study'
										? locale === 'ja'
											? '通常チャット用Study Mode'
											: 'Study Mode for a normal chat'
										: mode === 'weekly'
											? locale === 'ja'
												? '週次評価'
												: 'Weekly review'
											: mode === 'baseline'
												? locale === 'ja'
													? 'ベースライン評価'
													: 'Baseline assessment'
												: mode.replace('-', ' ')}
							</h2>
						</div>
						<button className="button" type="button" onClick={copy}>
							<Icon name="copy" />
							{copyStatus === 'copied' ? t('voice.copied') : t('voice.copyPrompt')}
						</button>
					</div>
					{copyStatus === 'failed' ? (
						<p className="feedback is-error" role="alert">
							{locale === 'ja'
								? 'クリップボードへコピーできませんでした。下のプロンプトを選択して手動でコピーしてください。'
								: 'Could not copy to the clipboard. Select the prompt below and copy it manually.'}
						</p>
					) : null}
					<pre
						tabIndex={0}
						aria-label={
							locale === 'ja' ? 'コピーする会話AIプロンプト' : 'Conversation AI prompt to copy'
						}
					>
						{prompt}
					</pre>
					{mode === 'core' || mode.startsWith('boost-') ? (
						<>
							<p>
								{locale === 'ja'
									? '会話AIのテキスト欄へ先に貼り付けて送信し、その後Voiceを開始してください。Voice終了後に明示的に「SESSION_JSONを出力」と送り、返ったJSONだけを取込画面へ貼ります。'
									: 'Paste and send this in your Conversation AI text chat first, then start Voice. After Voice ends, explicitly ask it to output SESSION_JSON and paste only the returned JSON into the import screen.'}
							</p>
							<a className="button button--primary" href="/import">
								{t('voice.importResult')}
							</a>
						</>
					) : (
						<p>
							{locale === 'ja'
								? 'プロンプトをテキストとして先に送信してください。この補助評価ではSESSION_JSONを生成・取込しません。'
								: 'Send the prompt as text first. This supporting assessment does not create or import SESSION_JSON.'}
						</p>
					)}
				</section>
			</div>
		</AppShell>
	);
}

function SessionImport() {
	const { importSession, setEditorDirty } = useAppState();
	const { formatNumber, locale, t } = useLocale();
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
				title={t('import.title')}
				description={
					locale === 'ja'
						? '元の貼り付け内容は保持したまま、検証結果を別に表示します。'
						: 'Keep your original pasted text while showing validation separately.'
				}
			/>
			<section className="import-layout">
				<div className="import-editor">
					<label className="field">
						<span>{t('import.resultJson')}</span>
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
							{locale === 'ja' ? '入力上限 1MB（現在 ' : 'Input limit 1 MB (currently '}
							{formatNumber(sourceBytes)} / {formatNumber(MAX_SESSION_SOURCE_BYTES)} bytes
							{locale === 'ja'
								? '）。上限を超えても入力は消えず、保存前の検証で拒否します。'
								: '). Text remains visible if it is over the limit and validation rejects it before saving.'}
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
									setMessage(
										locale === 'ja'
											? '合成SESSION_JSONを読み込みました。検証してから取り込めます。'
											: 'Loaded a synthetic SESSION_JSON. Validate it before importing.',
									);
									setMessageIsError(false);
								}}
							>
								{locale === 'ja' ? '合成サンプルを読み込む' : 'Load synthetic sample'}
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
									setMessage(
										locale === 'ja'
											? 'クリップボードから読み込みました。内容を確認してください。'
											: 'Loaded from the clipboard. Review the content.',
									);
									setMessageIsError(false);
								} catch {
									setMessage(
										locale === 'ja'
											? 'クリップボードを読み込めませんでした。入力欄は変更していません。直接貼り付けてください。'
											: 'Could not read the clipboard. The input was not changed; paste directly instead.',
									);
									setMessageIsError(true);
								}
							}}
						>
							{locale === 'ja' ? 'クリップボード読込' : 'Read clipboard'}
						</button>
						<button className="button button--primary" type="button" onClick={preview}>
							{t('import.preview')}
						</button>
					</div>
				</div>
				<aside id="session-import-feedback" className="import-preview" aria-live="polite">
					<h2>{t('import.previewTitle')}</h2>
					{result?.errors.length ? (
						<div className="error-box">
							<strong>{t('import.notSaved')}</strong>
							<ul>
								{result.errors.map((error) => (
									<li key={error}>{localizeUiMessage(error, locale)}</li>
								))}
							</ul>
						</div>
					) : result?.session && structured?.success ? (
						<div className="preview-data">
							{result.warnings.length ? (
								<div className="feedback" role="status">
									{result.warnings.map((warning) => localizeUiMessage(warning, locale)).join(' ')}
								</div>
							) : null}
							<dl>
								<dt>{t('sessions.type')}</dt>
								<dd>{result.session.kind}</dd>
								<dt>{locale === 'ja' ? '時間' : 'Duration'}</dt>
								<dd>
									{locale === 'ja'
										? `${result.session.durationMinutes}分`
										: `${result.session.durationMinutes} min`}
								</dd>
								<dt>{locale === 'ja' ? 'スコア' : 'Score'}</dt>
								<dd>{result.session.score}</dd>
								<dt>{locale === 'ja' ? '要約' : 'Summary'}</dt>
								<dd>{result.session.summary}</dd>
								<dt>{locale === 'ja' ? '新規単語' : 'New vocabulary'}</dt>
								<dd>
									{locale === 'ja'
										? `${structured.data.newVocabulary.length}件`
										: structured.data.newVocabulary.length}
								</dd>
								<dt>{locale === 'ja' ? '新規定型表現' : 'New phrases'}</dt>
								<dd>
									{locale === 'ja'
										? `${structured.data.newPhrases.length}件`
										: structured.data.newPhrases.length}
								</dd>
								<dt>{locale === 'ja' ? '文法予習' : 'Grammar preview'}</dt>
								<dd>
									{locale === 'ja'
										? `${structured.data.previewGrammar.length}件`
										: structured.data.previewGrammar.length}
								</dd>
								<dt>{locale === 'ja' ? '間違い' : 'Mistakes'}</dt>
								<dd>
									{locale === 'ja'
										? `${structured.data.mistakes.length}件`
										: structured.data.mistakes.length}
								</dd>
								<dt>{locale === 'ja' ? '復習カード' : 'Review cards'}</dt>
								<dd>
									{locale === 'ja'
										? `${structured.data.reviewCards.length}件`
										: structured.data.reviewCards.length}
								</dd>
							</dl>
							<button className="button button--primary" type="button" onClick={() => void save()}>
								{locale === 'ja' ? 'この内容を保存' : 'Save this result'}
							</button>
						</div>
					) : (
						<p className="empty-copy">{t('import.noPreview')}</p>
					)}
					{message ? (
						<p
							className={`feedback ${messageIsError ? 'is-error' : 'is-success'}`}
							role={messageIsError ? 'alert' : 'status'}
						>
							{localizeUiMessage(message, locale)}
						</p>
					) : null}
				</aside>
			</section>
		</AppShell>
	);
}

function Sessions() {
	const { data } = useAppState();
	const { formatDateTime, locale, t } = useLocale();
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
			<PageHeader title={t('sessions.title')} description={t('sessions.description')} />
			<form
				className="session-filters"
				aria-label={locale === 'ja' ? 'セッション履歴の絞り込み' : 'Filter session history'}
			>
				<label className="field">
					<span>{t('sessions.type')}</span>
					<select value={kind} onChange={(event) => updateFilter('kind', event.target.value)}>
						<option value="all">{t('library.all')}</option>
						<option value="core">Core</option>
						<option value="boost">Boost</option>
					</select>
				</label>
				<label className="field">
					<span>{t('sessions.date')}</span>
					<input
						type="date"
						value={date}
						onChange={(event) => updateFilter('date', event.target.value)}
					/>
				</label>
				<label className="field">
					<span>{locale === 'ja' ? 'Boostモード' : 'Boost mode'}</span>
					<select value={mode} onChange={(event) => updateFilter('mode', event.target.value)}>
						<option value="">{t('library.all')}</option>
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
					{locale === 'ja' ? '絞り込みを解除' : 'Clear filters'}
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
									{formatDateTime(session.completedAt)} ·{' '}
									{locale === 'ja'
										? `${session.durationMinutes}分`
										: `${session.durationMinutes} min`}
								</p>
							</div>
							<div className="session-list__actions">
								<strong>{session.score}</strong>
								<a className="button" href={`/sessions/${encodeURIComponent(session.sessionId)}`}>
									{locale === 'ja' ? '詳細' : 'Details'}
								</a>
							</div>
						</article>
					))}
				</div>
			) : (
				<div className="empty-state">
					<h2>
						{data.sessions.length
							? locale === 'ja'
								? '条件に一致するセッションがありません'
								: 'No sessions match these filters'
							: locale === 'ja'
								? 'まだセッションがありません'
								: 'No sessions yet'}
					</h2>
					<p>
						{data.sessions.length
							? locale === 'ja'
								? '絞り込みを解除するか、条件を変更してください。'
								: 'Clear the filters or change the criteria.'
							: locale === 'ja'
								? 'Core Voiceの結果JSONを取り込むと、ここに履歴が残ります。'
								: 'Import a Core Voice result JSON to keep its history here.'}
					</p>
					{!data.sessions.length ? (
						<a className="button" href="/voice">
							{locale === 'ja' ? '会話準備へ' : 'Prepare a conversation'}
						</a>
					) : null}
				</div>
			)}
		</AppShell>
	);
}

function SessionDetail() {
	const { data } = useAppState();
	const { formatDateTime, locale, t } = useLocale();
	const { sessionId = '' } = useParams();
	const parsedId = z.string().min(1).max(128).safeParse(sessionId);
	const session = parsedId.success
		? data.sessions.find((item) => item.sessionId === parsedId.data)
		: undefined;
	if (!session) {
		return (
			<AppShell>
				<PageHeader
					title={locale === 'ja' ? 'セッションが見つかりません' : 'Session not found'}
					description={
						locale === 'ja'
							? '削除済みか、URLが正しくありません。'
							: 'It may have been deleted or the URL is incorrect.'
					}
				/>
				<a className="button" href="/sessions">
					{locale === 'ja' ? 'セッション履歴へ戻る' : 'Back to session history'}
				</a>
			</AppShell>
		);
	}
	const payload = SessionJsonSchema.safeParse(session.payload);
	return (
		<AppShell>
			<PageHeader
				title={session.summary}
				description={
					locale === 'ja'
						? '保存済みの検証済みセッションです。'
						: 'This is a saved, validated session.'
				}
			/>
			<article className="surface session-detail">
				<dl>
					<dt>{t('sessions.type')}</dt>
					<dd>{session.kind === 'core' ? 'Core' : 'Boost'}</dd>
					<dt>{locale === 'ja' ? '実施日時' : 'Completed at'}</dt>
					<dd>{formatDateTime(session.completedAt, { timeZone: data.timeZone })}</dd>
					<dt>{locale === 'ja' ? '時間' : 'Duration'}</dt>
					<dd>
						{locale === 'ja' ? `${session.durationMinutes}分` : `${session.durationMinutes} min`}
					</dd>
					<dt>{locale === 'ja' ? 'スコア' : 'Score'}</dt>
					<dd>{session.score}</dd>
					<dt>{locale === 'ja' ? '間違い' : 'Mistakes'}</dt>
					<dd>{locale === 'ja' ? `${session.mistakes.length}件` : session.mistakes.length}</dd>
					{payload.success ? (
						<>
							<dt>{locale === 'ja' ? 'カリキュラム日' : 'Curriculum day'}</dt>
							<dd>Day {payload.data.curriculumDay}</dd>
							{payload.data.boost ? (
								<>
									<dt>{locale === 'ja' ? 'Boostモード' : 'Boost mode'}</dt>
									<dd>{payload.data.boost.mode}</dd>
								</>
							) : null}
							<dt>{locale === 'ja' ? '評価コメント' : 'Evaluation note'}</dt>
							<dd>{payload.data.evaluation.commentJa}</dd>
						</>
					) : null}
				</dl>
			</article>
			<a className="button" href="/sessions">
				{locale === 'ja' ? 'セッション履歴へ戻る' : 'Back to session history'}
			</a>
		</AppShell>
	);
}

function Analytics() {
	const { data } = useAppState();
	const { locale, t } = useLocale();
	const coreRate = Math.round((data.completedDays.length / Math.max(1, data.currentDay)) * 100);
	const today = studyDateAt(new Date(), data.timeZone);
	const completedDates = new Set(data.completedStudyDates);
	const recentDates = Array.from({ length: 7 }, (_, index) => addStudyDays(today, index - 6));
	return (
		<AppShell>
			<PageHeader title={t('analytics.title')} description={t('analytics.description')} />
			<div className="analytics-grid">
				<article className="metric metric--wide">
					<span>{locale === 'ja' ? 'CORE完了率' : 'CORE completion'}</span>
					<strong>{coreRate}%</strong>
					<div className="bar">
						<i style={{ transform: `scaleX(${coreRate / 100})` }} />
					</div>
				</article>
				<article className="metric">
					<span>{locale === 'ja' ? '連続日数' : 'Streak'}</span>
					<strong>
						{data.streak}
						<small>{locale === 'ja' ? '日' : 'days'}</small>
					</strong>
				</article>
				<article className="metric">
					<span>Voice</span>
					<strong>
						{data.sessions.length}
						<small>{locale === 'ja' ? '回' : 'sessions'}</small>
					</strong>
				</article>
				<article className="metric">
					<span>Core / Boost</span>
					<strong>
						{data.activity.coreSessions} / {data.activity.boostSessions}
					</strong>
				</article>
				<article className="metric">
					<span>{locale === 'ja' ? '復習イベント' : 'Review events'}</span>
					<strong>{data.activity.reviewEvents}</strong>
				</article>
				<article className="metric">
					<span>{locale === 'ja' ? '獲得 単語 / 表現' : 'Acquired words / phrases'}</span>
					<strong>
						{data.activity.acquiredWords} / {data.activity.acquiredPhrases}
					</strong>
				</article>
				<article className="metric">
					<span>{locale === 'ja' ? '文法進捗' : 'Grammar progress'}</span>
					<strong>{data.activity.grammarProgress}</strong>
				</article>
				<article className="metric metric--chart">
					<span>{locale === 'ja' ? '直近7日' : 'Last 7 days'}</span>
					<div
						className="mini-bars"
						role="img"
						aria-label={
							locale === 'ja' ? '直近7日のCore実績' : 'Core activity over the last 7 days'
						}
					>
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
	const { locale, t } = useLocale();
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
			<PageHeader title={t('boost.title')} description={t('boost.description')} />
			<section className="boost-builder">
				<p className="feedback" role="status">
					{locale === 'ja'
						? `おすすめ: ${boostModes.find((item) => item.id === recommended)?.label}（${recommendation.reason}）`
						: `Recommended: ${boostModes.find((item) => item.id === recommended)?.label}. Selected from your due reviews and recent learning signals.`}
				</p>
				<div>
					<h2>{locale === 'ja' ? '時間を選ぶ' : 'Choose time'}</h2>
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
								<span>{locale === 'ja' ? '分' : 'min'}</span>
							</button>
						))}
					</div>
				</div>
				<div>
					<h2>{locale === 'ja' ? 'モードを選ぶ' : 'Choose a mode'}</h2>
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
					{locale === 'ja' ? 'Boostプロンプトを作る' : 'Create a Boost prompt'}
				</button>
			</section>
		</AppShell>
	);
}

function Backup() {
	const { formatDateTime, locale, t } = useLocale();
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
			setMessage(
				locale === 'ja'
					? '改ざん検知情報を含むバックアップを作成しました。'
					: 'Created a backup with tamper-detection information.',
			);
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
			setMessage(
				locale === 'ja'
					? '検証に成功しました。まだ端末内データは変更していません。'
					: 'Validation succeeded. No data on this device has changed yet.',
			);
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
			setMessage(
				locale === 'ja'
					? 'バックアップを復元し、保存後の件数も確認しました。'
					: 'Backup restored and saved record counts verified.',
			);
		} catch (error) {
			setIsError(true);
			setMessage(backupFailureMessage(error));
		} finally {
			setBusy(false);
		}
	};
	const impactRows = preview
		? [
				[locale === 'ja' ? 'セッション' : 'Sessions', preview.impact.sessions],
				[locale === 'ja' ? '間違い' : 'Mistakes', preview.impact.mistakes],
				[locale === 'ja' ? '学習項目' : 'Learning items', preview.impact.learningItems],
				[locale === 'ja' ? '復習カード' : 'Review cards', preview.impact.reviewCards],
				[locale === 'ja' ? '日次進捗' : 'Daily progress', preview.impact.dailyProgress],
			]
		: [];
	return (
		<AppShell>
			<PageHeader
				title={t('backup.title')}
				description={
					locale === 'ja'
						? '端末内データをJSONとして保存します。音声は含みません。'
						: 'Save this device’s data as JSON. Audio is not included.'
				}
			/>
			<div className="detail-grid">
				<article className="surface surface--pear">
					<h2>{t('backup.export')}</h2>
					<p>
						{locale === 'ja'
							? '現在の設定、進捗、履歴、間違いノートを書き出します。'
							: 'Export current settings, progress, history, and mistake notes.'}
					</p>
					<p>
						{locale === 'ja'
							? 'JSONは暗号化されません。共有フォルダーや公開リンクを避け、自分だけがアクセスできる場所へ安全に保管してください。'
							: 'JSON backups are not encrypted. Avoid shared folders and public links; store them somewhere only you can access.'}
					</p>
					<button
						className="button button--primary"
						type="button"
						disabled={busy}
						onClick={() => void download()}
					>
						{t('backup.export')}
					</button>
				</article>
				<article className="surface">
					<h2>{t('backup.restore')}</h2>
					<p>{t('backup.restoreDescription')}</p>
					<label className="field" htmlFor="backup-restore-file">
						<span>
							{locale === 'ja' ? 'Trelluneバックアップ（JSON）' : 'Trellune backup (JSON)'}
						</span>
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
					<h2 id="backup-preview-title">{t('backup.preview')}</h2>
					<p>
						{locale === 'ja' ? '作成日時' : 'Created'}: {formatDateTime(preview.envelope.createdAt)}{' '}
						·{locale === 'ja' ? 'SHA-256確認済み' : 'SHA-256 verified'}
					</p>
					<table>
						<thead>
							<tr>
								<th scope="col">{locale === 'ja' ? '対象' : 'Data'}</th>
								<th scope="col">{locale === 'ja' ? '復元後' : 'After restore'}</th>
								<th scope="col">{locale === 'ja' ? '追加' : 'Add'}</th>
								<th scope="col">{locale === 'ja' ? '更新' : 'Update'}</th>
								<th scope="col">{locale === 'ja' ? '削除' : 'Remove'}</th>
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
						<span>
							{locale === 'ja'
								? '現在の端末内データを、このプレビュー内容で置き換えることを確認しました'
								: 'I confirm that the current data on this device will be replaced by this preview.'}
						</span>
					</label>
					<button
						className="button button--primary"
						type="button"
						disabled={!confirmed || busy}
						onClick={() => void apply()}
					>
						{t('backup.confirmRestore')}
					</button>
				</section>
			) : null}
			{message ? (
				<p className={`feedback${isError ? ' is-error' : ''}`} role={isError ? 'alert' : 'status'}>
					{localizeUiMessage(message, locale)}
				</p>
			) : null}
		</AppShell>
	);
}

function Settings() {
	const { data, deleteDeviceData, update } = useAppState();
	const { formatDateTime, locale, setLocale, t } = useLocale();
	const pwaUpdate = usePwaUpdate();
	const [syncStatus, setSyncStatus] = useState<SyncStatusSummary | null>(null);
	const [syncMessage, setSyncMessage] = useState('');
	const [syncBusy, setSyncBusy] = useState(false);
	const [deleteAcknowledged, setDeleteAcknowledged] = useState(false);
	const [deleteConfirmation, setDeleteConfirmation] = useState('');
	const [deleteBusy, setDeleteBusy] = useState(false);
	const [deleteMessage, setDeleteMessage] = useState('');
	const pwaStatusMessage = (status: PwaUpdateStatus): string => {
		switch (status) {
			case 'checking':
				return t('update.checking');
			case 'ready':
				return t('update.ready');
			case 'available':
				return t('update.available');
			case 'offline':
				return t('update.offline');
			case 'unsupported':
				return t('update.unsupported');
			case 'error':
				return t('update.error');
			case 'idle':
				return '';
		}
	};
	const refreshSyncStatus = async () => setSyncStatus(await getSyncStatus());
	const syncMessageFor = (result: SyncRunResult): string => {
		switch (result.status) {
			case 'completed':
				return locale === 'ja' ? '同期を完了しました。' : 'Sync completed.';
			case 'busy':
				return locale === 'ja'
					? '別の同期処理が実行中です。少し待ってから状態を確認してください。'
					: 'Another sync is running. Wait a moment and check the status again.';
			case 'offline':
				return locale === 'ja'
					? 'オフラインのため同期していません。接続後にもう一度実行してください。'
					: 'Sync did not run while offline. Reconnect and try again.';
			case 'blocked':
				return result.conflicts
					? locale === 'ja'
						? '同期は一部停止しています。下の競合を確認して、採用するデータを選んでください。'
						: 'Some sync is blocked. Review the conflicts below and choose which data to keep.'
					: locale === 'ja'
						? '同期できない操作があります。「停止中の操作を再試行」またはエラー表示を確認してください。'
						: 'Some operations cannot sync. Retry blocked operations or check the error shown.';
			case 'failed':
				return locale === 'ja'
					? '同期に失敗しました。端末内の学習データは保存されています。接続とエラー表示を確認してください。'
					: 'Sync failed. Your learning data remains on this device. Check the connection and error details.';
		}
	};
	useEffect(() => {
		void refreshSyncStatus();
		const timer = window.setInterval(() => void refreshSyncStatus(), 2_000);
		return () => window.clearInterval(timer);
	}, []);
	return (
		<AppShell>
			<PageHeader title={t('settings.title')} description={t('settings.description')} />
			<div className="settings-list">
				<section>
					<div>
						<h2>{t('settings.languageTitle')}</h2>
						<p>{t('settings.languageDescription')}</p>
					</div>
					<select
						value={locale}
						onChange={(event) => setLocale(event.target.value as typeof locale)}
						aria-label={t('language.label')}
					>
						<option value="ja">{t('language.ja')}</option>
						<option value="en">{t('language.en')}</option>
					</select>
				</section>
				<section>
					<div>
						<h2>{t('settings.updates')}</h2>
						<p>{t('settings.updatesDescription')}</p>
						{pwaUpdate.status !== 'idle' ? (
							<p
								className={pwaUpdate.status === 'error' ? 'feedback is-error' : undefined}
								aria-live="polite"
							>
								{pwaStatusMessage(pwaUpdate.status)}
							</p>
						) : null}
					</div>
					<button
						className="button"
						type="button"
						disabled={pwaUpdate.status === 'checking' || pwaUpdate.status === 'unsupported'}
						onClick={() => void pwaUpdate.check()}
					>
						{pwaUpdate.status === 'checking' ? t('update.checking') : t('update.check')}
					</button>
				</section>
				<section>
					<div>
						<h2>{t('settings.dailyMinutes')}</h2>
						<p>{t('settings.dailyMinutesDescription')}</p>
					</div>
					<select
						value={data.dailyMinutes}
						onChange={(event) => void update({ dailyMinutes: Number(event.target.value) })}
						aria-label={locale === 'ja' ? '1日の学習時間' : 'Daily study time'}
					>
						{[10, 20, 30, 45].map((value) => (
							<option key={value} value={value}>
								{locale === 'ja' ? `${value}分` : `${value} min`}
							</option>
						))}
					</select>
				</section>
				<section className="sync-detail">
					<div>
						<h2>{t('settings.syncStatus')}</h2>
						<p aria-live="polite">
							{t('sync.pending')} {syncStatus?.pending ?? 0} · {t('sync.syncing')}{' '}
							{syncStatus?.syncing ?? 0} · {t('sync.blocked')} {syncStatus?.blocked ?? 0} ·{' '}
							{t('sync.conflicts')} {syncStatus?.conflicts.length ?? 0}
						</p>
						<p>
							{t('sync.lastSuccess')}:{' '}
							{syncStatus?.lastSuccessAt
								? formatDateTime(syncStatus.lastSuccessAt)
								: t('sync.never')}
						</p>
						<p>
							{t('sync.lastAttempt')}:{' '}
							{syncStatus?.lastAttemptAt
								? `${formatDateTime(syncStatus.lastAttemptAt)} (${syncStatus.lastAttemptStatus ?? (locale === 'ja' ? '不明' : 'unknown')})`
								: t('sync.never')}
						</p>
						{syncStatus?.lastErrorCode ? (
							<p className="feedback is-error">
								{locale === 'ja' ? 'エラー' : 'Error'}: {syncStatus.lastErrorCode}
							</p>
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
									setSyncMessage(
										locale === 'ja'
											? '同期に失敗しました。端末内の学習データは保存されています。'
											: 'Sync failed. Learning data remains on this device.',
									);
								} finally {
									setSyncBusy(false);
									await refreshSyncStatus();
								}
							}}
						>
							{syncBusy ? t('settings.syncing') : t('settings.syncNow')}
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
							{t('sync.retryBlocked')}
						</button>
						<button
							className="button"
							type="button"
							disabled={!syncStatus || syncStatus.blocked <= syncStatus.conflicts.length}
							onClick={async () => {
								if (
									!window.confirm(
										locale === 'ja'
											? '競合として統合できない停止操作だけを送信待ちから外します。端末内データは削除しません。続けますか？'
											: 'Remove only blocked operations that cannot be reconciled as conflicts from the sync queue? Data on this device will not be deleted.',
									)
								)
									return;
								await discardUnresolvableBlockedSync();
								await refreshSyncStatus();
							}}
						>
							{locale === 'ja'
								? '停止操作を待機列から除外'
								: 'Remove unreconcilable blocked operations from the queue'}
						</button>
					</div>
					{syncMessage ? (
						<p className="feedback" role="status">
							{localizeUiMessage(syncMessage, locale)}
						</p>
					) : null}
				</section>
				{syncStatus?.conflicts.map((conflict) => (
					<section key={conflict.id} className="sync-conflict">
						<div>
							<h2>{t('sync.conflict')}</h2>
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
								{t('sync.resolveLocal')}
							</button>
							<button
								className="button"
								type="button"
								onClick={async () => {
									await resolveSyncConflict(conflict.id, 'use-server');
									await refreshSyncStatus();
								}}
							>
								{t('sync.resolveServer')}
							</button>
						</div>
					</section>
				))}
				<section>
					<div>
						<h2>D1 {t('settings.syncEnable')}</h2>
						<p>{t('settings.syncDescription')}</p>
					</div>
					<label className="switch">
						<input
							type="checkbox"
							checked={data.syncEnabled}
							onChange={(event) => void update({ syncEnabled: event.target.checked })}
						/>
						<span>{t('settings.syncEnable')}</span>
					</label>
				</section>
				<section>
					<div>
						<h2>{t('settings.reduceMotion')}</h2>
						<p>
							{locale === 'ja'
								? 'OS設定に加えて、アプリ内の空間的な動きを抑えます。'
								: 'Reduce in-app spatial motion in addition to your operating-system preference.'}
						</p>
					</div>
					<label className="switch">
						<input
							type="checkbox"
							checked={data.reduceMotion}
							onChange={(event) => void update({ reduceMotion: event.target.checked })}
						/>
						<span>{locale === 'ja' ? '低減' : 'Reduced'}</span>
					</label>
				</section>
				<section className="danger-zone">
					<div>
						<h2>{t('settings.deleteData')}</h2>
						<p id="local-delete-description">
							{locale === 'ja'
								? 'プロフィール、設定、進捗、履歴、復習、バックアップ復元情報、未送信同期操作をこの端末から削除します。Cloudflare D1の同期済みデータは削除しません。'
								: 'This deletes the profile, settings, progress, history, reviews, backup-restore information, and unsent sync operations from this device. It does not delete data already synced to Cloudflare D1.'}
						</p>
						<p>{t('settings.deleteDescription')}</p>
						<label className="switch delete-confirmation">
							<input
								type="checkbox"
								checked={deleteAcknowledged}
								onChange={(event) => setDeleteAcknowledged(event.target.checked)}
							/>
							<span>{t('settings.deleteAcknowledged')}</span>
						</label>
						<label className="field" htmlFor="local-delete-confirmation">
							<span>
								{t('settings.deleteConfirm', {
									text: locale === 'ja' ? '端末データを削除' : 'DELETE DEVICE DATA',
								})}
							</span>
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
								deleteConfirmation !== (locale === 'ja' ? '端末データを削除' : 'DELETE DEVICE DATA')
							}
							onClick={async () => {
								setDeleteBusy(true);
								const result = await deleteDeviceData();
								setDeleteMessage(result.message);
								setDeleteBusy(false);
							}}
						>
							{deleteBusy
								? locale === 'ja'
									? '削除しています…'
									: 'Deleting…'
								: t('settings.deleteButton')}
						</button>
						{deleteMessage ? <p role="status">{localizeUiMessage(deleteMessage, locale)}</p> : null}
						<p>
							{locale === 'ja'
								? '同期済みデータを含む削除は、本人確認と本番操作承認が必要なため自動実行しません。'
								: 'Deleting synced data requires identity verification and production-operation approval, so this app does not do it automatically.'}
						</p>
					</div>
				</section>
			</div>
			<nav className="settings-links">
				<a href="/baseline">
					{locale === 'ja' ? 'ベースライン評価を再開' : 'Resume baseline assessment'}
				</a>
				<a href="/assessment">Stage Assessment</a>
				<a href="/sessions">{t('sessions.title')}</a>
				<a href="/mistakes">{t('mistakes.title')}</a>
				<a href="/analytics">{locale === 'ja' ? '進捗分析' : 'Progress analytics'}</a>
				<a href="/backup">{t('backup.title')}</a>
				<a href="/vocabulary">{t('curriculum.vocabulary')}</a>
				<a href="/phrases">{t('curriculum.phrases')}</a>
			</nav>
			<footer className="statement-footer">
				<p>{t('app.tagline')}</p>
				<div>
					<span>Trellune</span>
					<span>Local-first · no AI API</span>
				</div>
			</footer>
		</AppShell>
	);
}

function OfflineHelp({ unknownPath = false }: { unknownPath?: boolean }) {
	const { locale, t } = useLocale();
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
				<h1>{t('offline.loading')}</h1>
			</main>
		);
	}
	return (
		<AppShell>
			<PageHeader
				title={
					online && unknownPath
						? locale === 'ja'
							? 'ページが見つかりません'
							: 'Page not found'
						: locale === 'ja'
							? 'このページはまだオフラインで使えません'
							: 'This page is not available offline yet'
				}
				description={
					online && unknownPath
						? locale === 'ja'
							? 'URLを確認するか、取得済みの画面へ戻ってください。'
							: 'Check the URL or return to a screen already available on this device.'
						: locale === 'ja'
							? 'オンライン時に一度開くと、次回から利用できる場合があります。'
							: 'Open it once while online to make it available on a later visit.'
				}
			/>
			<div className="empty-state">
				<h2>{t('offline.help')}</h2>
				<p>
					{locale === 'ja'
						? '入力中の学習データは削除していません。取得済みの主要画面へ戻り、通信復帰後にこのURLをもう一度開いてください。'
						: 'Your in-progress learning data has not been deleted. Return to an available core screen and open this URL again after your connection returns.'}
				</p>
				<a className="button button--primary" href="/today">
					{locale === 'ja' ? '今日のCoreへ戻る' : "Return to today's Core"}
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
	const { t } = useLocale();
	const initialRender = useRef(true);
	useEffect(() => {
		const routeName: Record<string, string> = {
			'/today': t('nav.today'),
			'/curriculum': t('curriculum.title', { days: AVAILABLE_CURRICULUM_TOTAL_DAYS }),
			'/reviews': t('reviews.title'),
			'/voice': t('voice.title'),
			'/import': t('import.title'),
			'/settings': t('settings.title'),
			'/backup': t('backup.title'),
			'/sessions': t('sessions.title'),
			'/assessment': t('assessment.title'),
		};
		document.title = `${routeName[location.pathname] ?? t('app.name')} · ${t('app.name')}`;
		const timer = window.setTimeout(() => {
			if (initialRender.current) {
				initialRender.current = false;
				return;
			}
			document.querySelector<HTMLElement>('main h1')?.focus();
		}, 0);
		return () => window.clearTimeout(timer);
	}, [location.pathname, t]);
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
