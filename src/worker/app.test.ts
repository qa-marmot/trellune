import { describe, expect, it } from 'vitest';
import { app } from './app';

describe('Worker API boundary', () => {
	it('exposes public health without touching D1', async () => {
		const response = await app.request('/api/v1/health', {}, {} as never);
		expect(response.status).toBe(200);
		expect(response.headers.get('x-correlation-id')).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
		);
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		await expect(response.json()).resolves.toMatchObject({ status: 'ok', service: 'english-os' });
	});

	it('accepts parameterized JSON but rejects JSONP media types', async () => {
		const statement = {
			bind: () => statement,
			first: async () => null,
			all: async () => ({ success: true, results: [] }),
			run: async () => ({ success: true }),
		};
		const environment = {
			ALLOW_LOCAL_AUTH: 'true',
			DB: {
				prepare: () => statement,
				batch: async (statements: (typeof statement)[]) =>
					statements.map(() => ({ success: true, meta: { changes: 1 } })),
			},
		};
		const request = (contentType: string) =>
			app.request(
				'/api/v1/session-imports/preview',
				{
					method: 'POST',
					headers: {
						'content-type': contentType,
						'x-english-os-local-user': 'media-type-test',
					},
					body: '{}',
				},
				environment as never,
			);
		await expect(request('application/json; charset=utf-8')).resolves.toMatchObject({
			status: 400,
		});
		await expect(request('application/jsonp')).resolves.toMatchObject({ status: 415 });
		await expect(request('application/json-patch+json')).resolves.toMatchObject({ status: 415 });
	});

	it('fails closed without Access configuration', async () => {
		const response = await app.request('/api/v1/today?date=2026-08-06', {}, {} as never);
		expect(response.status).toBe(401);
	});

	it('rejects duplicate JSON keys before a sync mutation reaches D1', async () => {
		const statement = {
			bind: () => statement,
			first: async () => null,
			all: async () => ({ success: true, results: [] }),
			run: async () => ({ success: true }),
		};
		const environment = {
			ALLOW_LOCAL_AUTH: 'true',
			DB: {
				prepare: () => statement,
				batch: async (statements: (typeof statement)[]) =>
					statements.map(() => ({ success: true, meta: { changes: 1 } })),
			},
		};
		const response = await app.request(
			'/api/v1/sync/mutations',
			{
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'x-english-os-local-user': 'strict-json-test',
				},
				body: '{"operationId":"11111111-1111-4111-8111-111111111111","operationId":"22222222-2222-4222-8222-222222222222"}',
			},
			environment as never,
		);
		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({ error: { code: 'invalid_json' } });
	});
});
