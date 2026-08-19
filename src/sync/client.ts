import type { z } from 'zod';
import { parseStrictJson } from '../lib/strictJson';
import {
	ApiErrorResponseSchema,
	BaselineAssessmentMutationResponseSchema,
	DailyProgressMutationResponseSchema,
	SessionImportMutationResponseSchema,
	ReviewEventMutationResponseSchema,
	SyncBootstrapResponseSchema,
	SyncChangesResponseSchema,
	SyncDeletionResponseSchema,
	SyncMutationResponseSchema,
	SessionPreviewResponseSchema,
	StageAssessmentMutationResponseSchema,
	TodayResponseSchema,
	type SyncMutation,
	type SyncDeletionRequest,
} from './contracts';
import type {
	BaselineAssessmentImportRequest,
	DailyProgressPatch,
	ReviewEventMutationRequest,
	SessionImportRequest,
	StageAssessmentImportRequest,
} from '../lib/schemas';

export type SyncClientErrorKind =
	'auth' | 'conflict' | 'validation' | 'rate-limit' | 'server' | 'network' | 'timeout' | 'protocol';

export class SyncClientError extends Error {
	constructor(
		public readonly kind: SyncClientErrorKind,
		message: string,
		public readonly status?: number,
		public readonly code?: string,
		public readonly retryAfterMs?: number,
		public readonly details?: unknown,
	) {
		super(message);
		this.name = 'SyncClientError';
	}
}

const REQUEST_TIMEOUT_MS = 10_000;

function errorKind(status: number): SyncClientErrorKind {
	if (status === 401 || status === 403) return 'auth';
	if (status === 409) return 'conflict';
	if (status === 400 || status === 413 || status === 415 || status === 422) return 'validation';
	if (status === 429) return 'rate-limit';
	return status >= 500 ? 'server' : 'protocol';
}

function retryAfter(response: Response): number | undefined {
	const value = response.headers.get('retry-after');
	if (!value) return undefined;
	const seconds = Number(value);
	if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
	const instant = Date.parse(value);
	return Number.isFinite(instant) ? Math.max(0, instant - Date.now()) : undefined;
}

async function parseResponseBody(response: Response): Promise<unknown> {
	const text = await response.text();
	if (!text) return null;
	try {
		return parseStrictJson(text);
	} catch (error) {
		throw new SyncClientError(
			'protocol',
			'同期APIのJSON応答を安全に解析できませんでした。',
			response.status,
			'invalid_response_json',
			undefined,
			error,
		);
	}
}

async function request<T>(path: string, init: RequestInit, schema: z.ZodType<T>): Promise<T> {
	const controller = new AbortController();
	const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	let response: Response;
	try {
		response = await fetch(path, {
			...init,
			credentials: 'same-origin',
			signal: controller.signal,
			headers: {
				accept: 'application/json',
				...(init.body ? { 'content-type': 'application/json' } : {}),
				...init.headers,
			},
		});
	} catch (error) {
		if (controller.signal.aborted) {
			throw new SyncClientError(
				'timeout',
				'同期APIが時間内に応答しませんでした。',
				undefined,
				'timeout',
			);
		}
		throw new SyncClientError(
			'network',
			'同期APIへ接続できませんでした。',
			undefined,
			'network_error',
			undefined,
			error,
		);
	} finally {
		window.clearTimeout(timeout);
	}
	const body = await parseResponseBody(response);
	if (!response.ok) {
		const parsedError = ApiErrorResponseSchema.safeParse(body);
		throw new SyncClientError(
			errorKind(response.status),
			parsedError.success ? parsedError.data.error.message : '同期APIがエラーを返しました。',
			response.status,
			parsedError.success ? parsedError.data.error.code : 'unknown_api_error',
			retryAfter(response),
			parsedError.success ? parsedError.data.error : body,
		);
	}
	const parsed = schema.safeParse(body);
	if (!parsed.success) {
		throw new SyncClientError(
			'protocol',
			'同期APIの応答形式が契約と一致しません。',
			response.status,
			'invalid_response_schema',
			undefined,
			parsed.error.issues,
		);
	}
	return parsed.data;
}

export async function pushMutation(mutation: SyncMutation) {
	return request(
		'/api/v1/sync/mutations',
		{ method: 'POST', body: JSON.stringify(mutation) },
		SyncMutationResponseSchema,
	);
}

export async function pushDeletion(requestBody: SyncDeletionRequest) {
	return request(
		'/api/v1/sync/deletions',
		{ method: 'POST', body: JSON.stringify(requestBody) },
		SyncDeletionResponseSchema,
	);
}

export async function pushDailyProgress(studyDate: string, patch: DailyProgressPatch) {
	return request(
		`/api/v1/daily-progress/${encodeURIComponent(studyDate)}`,
		{ method: 'PATCH', body: JSON.stringify(patch) },
		DailyProgressMutationResponseSchema,
	);
}

export async function pushSessionImport(requestBody: SessionImportRequest) {
	return request(
		'/api/v1/session-imports',
		{ method: 'POST', body: JSON.stringify(requestBody) },
		SessionImportMutationResponseSchema,
	);
}

export async function previewSessionImport(requestBody: SessionImportRequest) {
	return request(
		'/api/v1/session-imports/preview',
		{ method: 'POST', body: JSON.stringify(requestBody) },
		SessionPreviewResponseSchema,
	);
}

export async function fetchToday(studyDate: string) {
	return request(
		`/api/v1/today?${new URLSearchParams({ date: studyDate }).toString()}`,
		{ method: 'GET' },
		TodayResponseSchema,
	);
}

export async function pushReviewEvent(requestBody: ReviewEventMutationRequest) {
	return request(
		'/api/v1/review-events',
		{ method: 'POST', body: JSON.stringify(requestBody) },
		ReviewEventMutationResponseSchema,
	);
}

export async function pushBaselineAssessment(requestBody: BaselineAssessmentImportRequest) {
	return request(
		'/api/v1/assessments/baseline',
		{ method: 'PUT', body: JSON.stringify(requestBody) },
		BaselineAssessmentMutationResponseSchema,
	);
}

export async function pushStageAssessment(requestBody: StageAssessmentImportRequest) {
	return request(
		'/api/v1/assessments/stage',
		{ method: 'PUT', body: JSON.stringify(requestBody) },
		StageAssessmentMutationResponseSchema,
	);
}

export async function fetchBootstrap() {
	return request('/api/v1/sync/bootstrap', { method: 'GET' }, SyncBootstrapResponseSchema);
}

export async function fetchChanges(cursor: number, limit = 100) {
	const query = new URLSearchParams({ cursor: String(cursor), limit: String(limit) });
	return request(
		`/api/v1/sync/changes?${query.toString()}`,
		{ method: 'GET' },
		SyncChangesResponseSchema,
	);
}
