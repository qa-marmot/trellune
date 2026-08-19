import {
	createContext,
	type PropsWithChildren,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from 'react';
import {
	applyAppPatch,
	deleteLocalLearnerData,
	initializePersistence,
	loadAppData,
	persistCoreStep,
	persistBaselineAssessment,
	persistStageAssessment,
	persistImportedSession,
	persistReviewGrade,
	persistenceFailureMessage,
	seedDemoData,
	subscribeToPersistenceChanges,
} from '../storage/db';
import { isDemoMode } from '../demo';
import { DEFAULT_DATA, type AppData, type CoreStep, type ImportedSession } from '../domain/appData';
import {
	hydrateFromRemoteIfEmpty,
	syncNow,
	verifyRemoteCurriculumCompatibility,
} from '../sync/service';
import type { BaselineAssessment } from '../lib/schemas';
import type { StageAssessment } from '../domain/assessment';

export type { AppData, CoreStep, ImportedSession, MistakeItem } from '../domain/appData';

export interface CommandResult {
	ok: boolean;
	message: string;
}

interface AppStateValue {
	data: AppData;
	operationError: string;
	editorDirty: boolean;
	setEditorDirty: (dirty: boolean) => void;
	update: (patch: Partial<AppData>) => Promise<CommandResult>;
	completeStep: (step: CoreStep) => Promise<CommandResult>;
	importSession: (session: ImportedSession) => Promise<CommandResult>;
	gradeReview: (
		cardId: string,
		grade: 'again' | 'hard' | 'good' | 'easy',
	) => Promise<CommandResult>;
	recordBaseline: (assessment: BaselineAssessment) => Promise<CommandResult>;
	recordStageAssessment: (assessment: StageAssessment) => Promise<CommandResult>;
	deleteDeviceData: () => Promise<CommandResult>;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: PropsWithChildren) {
	const [data, setData] = useState<AppData | null>(null);
	const [startupError, setStartupError] = useState('');
	const [operationError, setOperationError] = useState('');
	const [editorDirty, setEditorDirty] = useState(false);

	const refresh = useCallback(async () => {
		setData(await loadAppData());
	}, []);

	useEffect(() => {
		let active = true;
		void (async () => {
			const result = await initializePersistence();
			if (!active) return;
			if (result.status === 'recovery-required') {
				if (result.remoteRecoveryRecommended && (await hydrateFromRemoteIfEmpty(true))) {
					const recovered = await loadAppData();
					if (active) setData(recovered);
					return;
				}
				setStartupError(result.message ?? '端末内データを安全に確認できませんでした。');
				return;
			}
			let next = result.data ?? DEFAULT_DATA;
			if (isDemoMode) {
				if (!next.onboarded) next = await seedDemoData();
				if (active) setData(next);
				return;
			}
			if (next.onboarded) {
				await verifyRemoteCurriculumCompatibility();
				next = await loadAppData();
			} else if (await hydrateFromRemoteIfEmpty()) next = await loadAppData();
			if (active) setData(next);
		})().catch((error: unknown) => {
			if (active) setStartupError(persistenceFailureMessage(error));
		});
		return () => {
			active = false;
		};
	}, []);

	useEffect(() => {
		if (!data) return;
		const root = document.documentElement;
		if (data.reduceMotion) root.dataset.reduceMotion = 'true';
		else delete root.dataset.reduceMotion;
		return () => {
			delete root.dataset.reduceMotion;
		};
	}, [data?.reduceMotion]);

	useEffect(() => {
		if (!data?.syncEnabled) return;
		let active = true;
		const execute = () => {
			void syncNow().catch(() => {
				if (active)
					setOperationError('D1同期を完了できませんでした。端末内の学習データは保存済みです。');
			});
		};
		execute();
		const timer = window.setInterval(execute, 30_000);
		const syncWhenForegrounded = () => {
			if (document.visibilityState === 'visible') execute();
		};
		window.addEventListener('online', execute);
		window.addEventListener('focus', syncWhenForegrounded);
		document.addEventListener('visibilitychange', syncWhenForegrounded);
		return () => {
			active = false;
			window.clearInterval(timer);
			window.removeEventListener('online', execute);
			window.removeEventListener('focus', syncWhenForegrounded);
			document.removeEventListener('visibilitychange', syncWhenForegrounded);
		};
	}, [data?.syncEnabled]);

	useEffect(() => {
		if (!data) return;
		const unsubscribe = subscribeToPersistenceChanges(() => {
			void refresh().catch((error: unknown) => setOperationError(persistenceFailureMessage(error)));
		});
		const refreshWhenVisible = () => {
			if (document.visibilityState === 'visible') {
				void refresh().catch((error: unknown) =>
					setOperationError(persistenceFailureMessage(error)),
				);
			}
		};
		document.addEventListener('visibilitychange', refreshWhenVisible);
		window.addEventListener('focus', refreshWhenVisible);
		return () => {
			unsubscribe();
			document.removeEventListener('visibilitychange', refreshWhenVisible);
			window.removeEventListener('focus', refreshWhenVisible);
		};
	}, [data, refresh]);

	const run = useCallback(
		async (operation: () => Promise<void>, successMessage: string): Promise<CommandResult> => {
			setOperationError('');
			try {
				await operation();
				await refresh();
				return { ok: true, message: successMessage };
			} catch (error) {
				const message = persistenceFailureMessage(error);
				setOperationError(message);
				return { ok: false, message };
			}
		},
		[refresh],
	);

	const update = useCallback(
		(patch: Partial<AppData>) => run(() => applyAppPatch(patch), '端末へ保存しました。'),
		[run],
	);

	const completeStep = useCallback(
		(step: CoreStep) => run(() => persistCoreStep(step), '学習状況を保存しました。'),
		[run],
	);

	const importSession = useCallback(
		async (session: ImportedSession): Promise<CommandResult> => {
			setOperationError('');
			try {
				const outcome = await persistImportedSession(session);
				if (outcome === 'duplicate') {
					return {
						ok: false,
						message: '同じsessionIdは取り込み済みです。内容は変更していません。',
					};
				}
				await refresh();
				return { ok: true, message: 'セッションを保存しました。' };
			} catch (error) {
				const message = persistenceFailureMessage(error);
				setOperationError(message);
				return { ok: false, message };
			}
		},
		[refresh],
	);

	const gradeReview = useCallback(
		(cardId: string, grade: 'again' | 'hard' | 'good' | 'easy') =>
			run(() => persistReviewGrade(cardId, grade), '復習結果を保存しました。'),
		[run],
	);

	const recordBaseline = useCallback(
		async (assessment: BaselineAssessment): Promise<CommandResult> => {
			setOperationError('');
			try {
				const outcome = await persistBaselineAssessment(assessment);
				if (outcome === 'duplicate') {
					return {
						ok: false,
						message: '同じベースライン評価は保存済みです。内容は変更していません。',
					};
				}
				await refresh();
				return { ok: true, message: 'ベースライン評価を保存しました。' };
			} catch (error) {
				const message = persistenceFailureMessage(error);
				setOperationError(message);
				return { ok: false, message };
			}
		},
		[refresh],
	);

	const recordStageAssessment = useCallback(
		async (assessment: StageAssessment): Promise<CommandResult> => {
			setOperationError('');
			try {
				const outcome = await persistStageAssessment(assessment);
				if (outcome === 'duplicate') {
					return {
						ok: false,
						message: '同じattemptIdの評価は保存済みです。内容は変更していません。',
					};
				}
				await refresh();
				return { ok: true, message: 'Stage Assessmentを保存しました。' };
			} catch (error) {
				const message = persistenceFailureMessage(error);
				setOperationError(message);
				return { ok: false, message };
			}
		},
		[refresh],
	);

	const deleteDeviceData = useCallback(async (): Promise<CommandResult> => {
		setOperationError('');
		try {
			await deleteLocalLearnerData();
			setData(DEFAULT_DATA);
			return { ok: true, message: 'この端末の学習データを削除しました。' };
		} catch (error) {
			const message = persistenceFailureMessage(error);
			setOperationError(message);
			return { ok: false, message };
		}
	}, []);

	const value = useMemo(
		() => ({
			data: data ?? DEFAULT_DATA,
			operationError,
			editorDirty,
			setEditorDirty,
			update,
			completeStep,
			importSession,
			gradeReview,
			recordBaseline,
			recordStageAssessment,
			deleteDeviceData,
		}),
		[
			completeStep,
			data,
			deleteDeviceData,
			editorDirty,
			gradeReview,
			importSession,
			operationError,
			recordBaseline,
			recordStageAssessment,
			update,
		],
	);

	if (startupError) {
		return (
			<main className="app-loading" role="alert">
				<h1>保存データの確認が必要です</h1>
				<p>{startupError}</p>
				<p>元データは上書きしていません。バックアップを保管したまま復旧してください。</p>
			</main>
		);
	}

	if (!data) {
		return (
			<main className="app-loading" aria-busy="true" aria-live="polite">
				<h1>Trellune</h1>
				<p>端末内の学習データを確認しています…</p>
			</main>
		);
	}

	return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
	const value = useContext(AppStateContext);
	if (!value) throw new Error('useAppState must be used inside AppStateProvider');
	return value;
}
