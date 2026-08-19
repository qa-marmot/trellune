import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import type { ZodType } from 'zod';
import {
	BaselineAssessmentImportRequestSchema,
	ChangeQuerySchema,
	DailyProgressPatchSchema,
	DateQuerySchema,
	ReviewEventMutationRequestSchema,
	SessionImportRequestSchema,
	StageAssessmentImportRequestSchema,
} from '../lib/schemas';
import { parseStrictJson } from '../lib/strictJson';
import { SyncDeletionRequestSchema, SyncMutationSchema } from '../sync/contracts';
import { authenticateLearner } from './auth';
import {
	AcquisitionLimitError,
	BoostContextError,
	BoostPreviewContextError,
	CurriculumDayUnavailableError,
	CurriculumInactiveError,
	EnglishOsRepository,
	ImportConflictError,
	MutationReplayMismatchError,
	ProgressContextError,
	ReviewStateError,
	SessionContextError,
	SyncVersionConflictError,
	VersionConflictError,
	type D1DatabaseLike,
} from './d1';

export interface WorkerBindings {
	DB: D1DatabaseLike;
	ALLOW_LOCAL_AUTH?: string;
	ACCESS_TEAM_DOMAIN?: string;
	ACCESS_AUD?: string;
}

type Variables = { learnerId: string; correlationId: string };
const MAX_JSON_BYTES = 1_000_000;

export const app = new Hono<{ Bindings: WorkerBindings; Variables: Variables }>();

app.use('*', secureHeaders());
app.use('/api/v1/*', async (context, next) => {
	const correlationId = crypto.randomUUID();
	context.set('correlationId', correlationId);
	await next();
	context.header('x-correlation-id', correlationId);
});
app.use('/api/v1/*', async (context, next) => {
	if (context.req.path === '/api/v1/health') return next();
	const identity = await authenticateLearner(context.req.raw, context.env);
	if (!identity) {
		return context.json(
			{ error: { code: 'unauthorized', message: 'Cloudflare Access authentication is required.' } },
			401,
		);
	}
	await new EnglishOsRepository(context.env.DB).ensureLearner(
		identity.learnerId,
		identity.accessSubject,
		new Date().toISOString(),
	);
	context.set('learnerId', identity.learnerId);
	return next();
});

app.get('/api/v1/health', (context) =>
	context.json({ status: 'ok', service: 'english-os', apiVersion: 1 }),
);

app.get('/api/v1/today', async (context) => {
	const parameters = new URL(context.req.url).searchParams;
	const query = parseExternal(DateQuerySchema, { date: parameters.get('date') });
	if (!query.success) return context.json(query.error, 400);
	const data = await repository(context).getToday(context.get('learnerId'), query.data.date);
	return context.json({ data });
});

app.post('/api/v1/session-imports/preview', async (context) => {
	const body = await parseJsonBody(context.req.raw, SessionImportRequestSchema);
	if (!body.success) return context.json(body.error, body.status);
	try {
		const preview = await repository(context).previewSession(context.get('learnerId'), body.data);
		return context.json({ data: preview });
	} catch (error) {
		if (error instanceof CurriculumDayUnavailableError) {
			return context.json(
				{
					error: {
						code: 'curriculum_day_unavailable',
						message: error.message,
						activeTotalDays: error.activeTotalDays,
					},
				},
				422,
			);
		}
		throw error;
	}
});

app.post('/api/v1/session-imports', async (context) => {
	const body = await parseJsonBody(context.req.raw, SessionImportRequestSchema);
	if (!body.success) return context.json(body.error, body.status);
	try {
		const stored = await repository(context).importSession(
			context.get('learnerId'),
			body.data,
			new Date().toISOString(),
		);
		return context.json({ data: stored }, stored.replayed ? 200 : 201);
	} catch (error) {
		if (error instanceof CurriculumDayUnavailableError) {
			return context.json(
				{
					error: {
						code: 'curriculum_day_unavailable',
						message: error.message,
						activeTotalDays: error.activeTotalDays,
					},
				},
				422,
			);
		}
		if (error instanceof CurriculumInactiveError) {
			return context.json(
				{
					error: {
						code:
							error.status === 'before-start' ? 'curriculum_not_started' : 'curriculum_graduated',
						message: error.message,
						startDate: error.startDate,
					},
				},
				422,
			);
		}
		if (error instanceof BoostContextError) {
			return context.json(
				{
					error: {
						code: 'boost_context_mismatch',
						message: error.message,
						expectedStudyDate: error.expectedStudyDate,
						expectedCurriculumDay: error.expectedCurriculumDay,
					},
				},
				422,
			);
		}
		if (error instanceof BoostPreviewContextError) {
			return context.json(
				{ error: { code: 'boost_preview_context_mismatch', message: error.message } },
				422,
			);
		}
		if (error instanceof SessionContextError) {
			return context.json(
				{
					error: {
						code: 'core_session_context_mismatch',
						message: error.message,
						expectedStudyDate: error.expectedStudyDate,
						expectedCurriculumDay: error.expectedCurriculumDay,
					},
				},
				422,
			);
		}
		if (error instanceof AcquisitionLimitError) {
			return context.json(
				{
					error: {
						code: 'daily_acquisition_limit',
						message: error.message,
						details: error.preview.limits,
					},
				},
				422,
			);
		}
		if (error instanceof ImportConflictError) {
			return context.json({ error: { code: 'import_conflict', message: error.message } }, 409);
		}
		if (error instanceof MutationReplayMismatchError) {
			return context.json(
				{ error: { code: 'mutation_replay_mismatch', message: error.message } },
				409,
			);
		}
		if (error instanceof SyncVersionConflictError) {
			return context.json(
				{
					error: {
						code: 'session_version_conflict',
						message: error.message,
						current: error.current,
						version: error.version,
					},
				},
				409,
			);
		}
		throw error;
	}
});

app.patch('/api/v1/daily-progress/:date', async (context) => {
	const params = parseExternal(DateQuerySchema, { date: context.req.param('date') });
	if (!params.success) return context.json(params.error, 400);
	const body = await parseJsonBody(context.req.raw, DailyProgressPatchSchema);
	if (!body.success) return context.json(body.error, body.status);
	try {
		const result = await repository(context).patchProgress(
			context.get('learnerId'),
			params.data.date,
			body.data,
			new Date().toISOString(),
		);
		return context.json({ data: result });
	} catch (error) {
		if (error instanceof CurriculumDayUnavailableError) {
			return context.json(
				{
					error: {
						code: 'curriculum_day_unavailable',
						message: error.message,
						activeTotalDays: error.activeTotalDays,
					},
				},
				422,
			);
		}
		if (error instanceof CurriculumInactiveError) {
			return context.json(
				{
					error: {
						code:
							error.status === 'before-start' ? 'curriculum_not_started' : 'curriculum_graduated',
						message: error.message,
						startDate: error.startDate,
					},
				},
				422,
			);
		}
		if (error instanceof ProgressContextError) {
			return context.json(
				{
					error: {
						code: 'progress_context_required',
						message: error.message,
						expectedCurriculumDay: error.expectedCurriculumDay,
					},
				},
				422,
			);
		}
		if (error instanceof MutationReplayMismatchError) {
			return context.json(
				{ error: { code: 'mutation_replay_mismatch', message: error.message } },
				409,
			);
		}
		if (error instanceof VersionConflictError) {
			return context.json(
				{
					error: {
						code: 'version_conflict',
						message: error.message,
						current: error.current,
						version: error.version,
					},
				},
				409,
			);
		}
		throw error;
	}
});

app.post('/api/v1/review-events', async (context) => {
	const body = await parseJsonBody(context.req.raw, ReviewEventMutationRequestSchema);
	if (!body.success) return context.json(body.error, body.status);
	try {
		const data = await repository(context).gradeReview(
			context.get('learnerId'),
			body.data,
			new Date().toISOString(),
		);
		return context.json({ data }, data.replayed ? 200 : 201);
	} catch (error) {
		if (error instanceof CurriculumDayUnavailableError) {
			return context.json(
				{
					error: {
						code: 'curriculum_day_unavailable',
						message: error.message,
						activeTotalDays: error.activeTotalDays,
					},
				},
				422,
			);
		}
		if (error instanceof CurriculumInactiveError) {
			return context.json(
				{
					error: {
						code:
							error.status === 'before-start' ? 'curriculum_not_started' : 'curriculum_graduated',
						message: error.message,
						startDate: error.startDate,
					},
				},
				422,
			);
		}
		if (error instanceof SessionContextError) {
			return context.json(
				{
					error: {
						code: 'review_context_mismatch',
						message: error.message,
						expectedStudyDate: error.expectedStudyDate,
						expectedCurriculumDay: error.expectedCurriculumDay,
					},
				},
				422,
			);
		}
		if (error instanceof ReviewStateError) {
			return context.json({ error: { code: 'review_state_invalid', message: error.message } }, 422);
		}
		if (error instanceof MutationReplayMismatchError) {
			return context.json(
				{ error: { code: 'mutation_replay_mismatch', message: error.message } },
				409,
			);
		}
		if (error instanceof SyncVersionConflictError) {
			return context.json(
				{
					error: {
						code: 'review_version_conflict',
						message: error.message,
						current: error.current,
						version: error.version,
					},
				},
				409,
			);
		}
		throw error;
	}
});

app.put('/api/v1/assessments/baseline', async (context) => {
	const body = await parseJsonBody(context.req.raw, BaselineAssessmentImportRequestSchema);
	if (!body.success) return context.json(body.error, body.status);
	try {
		const data = await repository(context).importBaselineAssessment(
			context.get('learnerId'),
			body.data,
			new Date().toISOString(),
		);
		return context.json({ data }, data.replayed ? 200 : 201);
	} catch (error) {
		if (error instanceof MutationReplayMismatchError) {
			return context.json(
				{ error: { code: 'mutation_replay_mismatch', message: error.message } },
				409,
			);
		}
		if (error instanceof SyncVersionConflictError) {
			return context.json(
				{
					error: {
						code: 'assessment_version_conflict',
						message: error.message,
						current: error.current,
						version: error.version,
					},
				},
				409,
			);
		}
		throw error;
	}
});

app.put('/api/v1/assessments/stage', async (context) => {
	const body = await parseJsonBody(context.req.raw, StageAssessmentImportRequestSchema);
	if (!body.success) return context.json(body.error, body.status);
	try {
		const data = await repository(context).importStageAssessment(
			context.get('learnerId'),
			body.data,
			new Date().toISOString(),
		);
		return context.json({ data }, data.replayed ? 200 : 201);
	} catch (error) {
		if (error instanceof CurriculumDayUnavailableError) {
			return context.json(
				{
					error: {
						code: 'curriculum_day_unavailable',
						message: error.message,
						activeTotalDays: error.activeTotalDays,
					},
				},
				422,
			);
		}
		if (error instanceof MutationReplayMismatchError) {
			return context.json(
				{ error: { code: 'mutation_replay_mismatch', message: error.message } },
				409,
			);
		}
		if (error instanceof SyncVersionConflictError) {
			return context.json(
				{
					error: {
						code: 'assessment_version_conflict',
						message: error.message,
						current: error.current,
						version: error.version,
					},
				},
				409,
			);
		}
		throw error;
	}
});

app.post('/api/v1/sync/mutations', async (context) => {
	const body = await parseJsonBody(context.req.raw, SyncMutationSchema);
	if (!body.success) return context.json(body.error, body.status);
	try {
		const data = await repository(context).applySyncMutation(
			context.get('learnerId'),
			body.data,
			new Date().toISOString(),
		);
		return context.json({ data }, data.replayed ? 200 : 201);
	} catch (error) {
		if (error instanceof CurriculumDayUnavailableError) {
			return context.json(
				{
					error: {
						code: 'curriculum_day_unavailable',
						message: error.message,
						activeTotalDays: error.activeTotalDays,
					},
				},
				422,
			);
		}
		if (error instanceof MutationReplayMismatchError) {
			return context.json(
				{ error: { code: 'mutation_replay_mismatch', message: error.message } },
				409,
			);
		}
		if (error instanceof SyncVersionConflictError) {
			return context.json(
				{
					error: {
						code: 'sync_version_conflict',
						message: error.message,
						current: error.current,
						version: error.version,
					},
				},
				409,
			);
		}
		throw error;
	}
});

app.post('/api/v1/sync/deletions', async (context) => {
	const body = await parseJsonBody(context.req.raw, SyncDeletionRequestSchema);
	if (!body.success) return context.json(body.error, body.status);
	try {
		const data = await repository(context).tombstoneSyncEntity(
			context.get('learnerId'),
			body.data,
			new Date().toISOString(),
		);
		return context.json({ data }, data.replayed ? 200 : 201);
	} catch (error) {
		if (error instanceof CurriculumDayUnavailableError) {
			return context.json(
				{
					error: {
						code: 'curriculum_day_unavailable',
						message: error.message,
						activeTotalDays: error.activeTotalDays,
					},
				},
				422,
			);
		}
		if (error instanceof MutationReplayMismatchError) {
			return context.json(
				{ error: { code: 'mutation_replay_mismatch', message: error.message } },
				409,
			);
		}
		if (error instanceof SyncVersionConflictError) {
			return context.json(
				{
					error: {
						code: 'sync_delete_version_conflict',
						message: error.message,
						current: error.current,
						version: error.version,
					},
				},
				409,
			);
		}
		throw error;
	}
});

app.get('/api/v1/sync/bootstrap', async (context) => {
	const data = await repository(context).bootstrapSync(context.get('learnerId'));
	return context.json({ data });
});

app.get('/api/v1/sync/changes', async (context) => {
	const parameters = new URL(context.req.url).searchParams;
	const query = parseExternal(ChangeQuerySchema, {
		cursor: parameters.get('cursor') ?? undefined,
		limit: parameters.get('limit') ?? undefined,
	});
	if (!query.success) return context.json(query.error, 400);
	const data = await repository(context).pullChanges(
		context.get('learnerId'),
		query.data.cursor,
		query.data.limit,
	);
	return context.json({ data });
});

app.notFound((context) =>
	context.json(
		{ error: { code: 'not_found', message: 'The requested endpoint does not exist.' } },
		404,
	),
);

app.onError((error, context) => {
	console.error('Unhandled API error', {
		correlationId: context.get('correlationId'),
		errorName: error instanceof Error ? error.name : 'UnknownError',
	});
	return context.json(
		{
			error: {
				code: 'internal_error',
				message: 'The request could not be completed.',
				correlationId: context.get('correlationId'),
			},
		},
		500,
	);
});

function repository(context: { env: WorkerBindings }) {
	return new EnglishOsRepository(context.env.DB);
}

function parseExternal<T>(schema: ZodType<T>, input: unknown) {
	const result = schema.safeParse(input);
	if (result.success) return result;
	return {
		success: false as const,
		error: {
			error: {
				code: 'validation_error',
				message: 'External input did not match the required schema.',
				issues: result.error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
			},
		},
	};
}

async function parseJsonBody<T>(
	request: Request,
	schema: ZodType<T>,
): Promise<
	| { success: true; data: T }
	| {
			success: false;
			status: 400 | 413 | 415;
			error: { error: { code: string; message: string; issues?: unknown } };
	  }
> {
	const mediaType = request.headers
		.get('content-type')
		?.split(';', 1)[0]
		.trim()
		.toLocaleLowerCase('en-US');
	if (mediaType !== 'application/json') {
		return {
			success: false,
			status: 415,
			error: {
				error: {
					code: 'unsupported_media_type',
					message: 'Content-Type must be application/json.',
				},
			},
		};
	}
	const declaredLength = Number(request.headers.get('content-length') ?? 0);
	if (declaredLength > MAX_JSON_BYTES) {
		return {
			success: false,
			status: 413,
			error: {
				error: { code: 'payload_too_large', message: 'JSON input exceeds 1,000,000 bytes.' },
			},
		};
	}
	const text = await request.text();
	if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) {
		return {
			success: false,
			status: 413,
			error: {
				error: { code: 'payload_too_large', message: 'JSON input exceeds 1,000,000 bytes.' },
			},
		};
	}
	let value: unknown;
	try {
		value = parseStrictJson(text);
	} catch {
		return {
			success: false,
			status: 400,
			error: { error: { code: 'invalid_json', message: 'The request body is not valid JSON.' } },
		};
	}
	const parsed = parseExternal(schema, value);
	if (parsed.success) return parsed;
	return { success: false, status: 400, error: parsed.error };
}

export default app;
