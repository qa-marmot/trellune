import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { sign } from 'hono/jwt';
import { accessSubjectFromClaims, authenticateLearner } from './auth';
import { accessJwksCache, JwksCache, type AccessJwk } from './jwksCache';

const accessDomain = 'example.cloudflareaccess.com';
const accessAudience = 'english-os-audience';
type SigningJwk = JsonWebKey & { kid: string; alg: 'RS256'; use: 'sig' };

let privateKeyOne: SigningJwk;
let publicKeyOne: AccessJwk;
let privateKeyTwo: SigningJwk;
let publicKeyTwo: AccessJwk;

async function makeKeyPair(kid: string): Promise<{ privateKey: SigningJwk; publicKey: AccessJwk }> {
	const pair = (await crypto.subtle.generateKey(
		{
			name: 'RSASSA-PKCS1-v1_5',
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: 'SHA-256',
		},
		true,
		['sign', 'verify'],
	)) as CryptoKeyPair;
	const privateKey = await crypto.subtle.exportKey('jwk', pair.privateKey);
	const publicKey = await crypto.subtle.exportKey('jwk', pair.publicKey);
	return {
		privateKey: { ...privateKey, kid, alg: 'RS256', use: 'sig' } as SigningJwk,
		publicKey: { ...publicKey, kid, kty: 'RSA', alg: 'RS256', use: 'sig' } as AccessJwk,
	};
}

async function accessToken(
	privateKey: SigningJwk,
	overrides: Record<string, unknown> = {},
): Promise<string> {
	const now = Math.floor(Date.now() / 1_000);
	return sign(
		{
			sub: 'learner@example.com',
			exp: now + 300,
			iat: now - 1,
			iss: `https://${accessDomain}`,
			aud: accessAudience,
			...overrides,
		},
		privateKey,
		'RS256',
	);
}

function requestWithToken(token: string): Request {
	return new Request('https://app.example.test/api/profile', {
		headers: { 'cf-access-jwt-assertion': token },
	});
}

beforeAll(async () => {
	({ privateKey: privateKeyOne, publicKey: publicKeyOne } = await makeKeyPair('key-one'));
	({ privateKey: privateKeyTwo, publicKey: publicKeyTwo } = await makeKeyPair('key-two'));
});

afterEach(() => {
	accessJwksCache.clear();
	vi.unstubAllGlobals();
});

describe('Cloudflare Access claim boundary', () => {
	it('requires a future exp claim and a non-empty verified subject', () => {
		expect(accessSubjectFromClaims({ sub: 'learner@example.com' }, 100)).toBeNull();
		expect(accessSubjectFromClaims({ sub: 'learner@example.com', exp: 100 }, 100)).toBeNull();
		expect(accessSubjectFromClaims({ sub: '  Learner@Example.COM ', exp: 101 }, 100)).toBe(
			'learner@example.com',
		);
		expect(accessSubjectFromClaims({ email: 'mail@example.com', exp: 101 }, 100)).toBe(
			'mail@example.com',
		);
		expect(accessSubjectFromClaims({ sub: '   ', exp: 101 }, 100)).toBeNull();
	});
});

describe('bounded Cloudflare Access JWKS cache', () => {
	it('uses a fresh matching key, refreshes an unknown kid, and expires by max-age', async () => {
		let now = 1_000;
		const responses = [[publicKeyOne], [publicKeyTwo], [publicKeyTwo]];
		const fetcher = vi.fn(
			async () =>
				new Response(JSON.stringify({ keys: responses.shift() }), {
					status: 200,
					headers: { 'cache-control': 'public, max-age=2' },
				}),
		);
		const cache = new JwksCache(fetcher, () => now);

		expect(await cache.getKeys('https://access.test/certs', 'key-one')).toEqual([publicKeyOne]);
		expect(await cache.getKeys('https://access.test/certs', 'key-one')).toEqual([publicKeyOne]);
		expect(fetcher).toHaveBeenCalledTimes(1);

		expect(await cache.getKeys('https://access.test/certs', 'key-two')).toEqual([publicKeyTwo]);
		expect(fetcher).toHaveBeenCalledTimes(2);

		now += 2_001;
		expect(await cache.getKeys('https://access.test/certs', 'key-two')).toEqual([publicKeyTwo]);
		expect(fetcher).toHaveBeenCalledTimes(3);
	});

	it('deduplicates concurrent fetches and never reuses expired keys after a failure', async () => {
		let now = 1_000;
		let resolveFetch: ((response: Response) => void) | undefined;
		const fetcher = vi.fn(
			() =>
				new Promise<Response>((resolve) => {
					resolveFetch = resolve;
				}),
		);
		const cache = new JwksCache(fetcher, () => now);
		const first = cache.getKeys('https://access.test/certs', 'key-one');
		const second = cache.getKeys('https://access.test/certs', 'key-one');
		resolveFetch?.(
			new Response(JSON.stringify({ keys: [publicKeyOne] }), {
				headers: { 'cache-control': 'max-age=1' },
			}),
		);
		expect(await Promise.all([first, second])).toEqual([[publicKeyOne], [publicKeyOne]]);
		expect(fetcher).toHaveBeenCalledTimes(1);

		now += 1_001;
		fetcher.mockImplementationOnce(async () => new Response('unavailable', { status: 503 }));
		await expect(cache.getKeys('https://access.test/certs', 'key-one')).rejects.toThrow(
			'JWKS fetch failed',
		);
	});

	it('rejects malformed, oversized, and duplicate-key responses', async () => {
		const cases = [
			new Response('{', { status: 200 }),
			new Response(JSON.stringify({ keys: [publicKeyOne, publicKeyOne] }), { status: 200 }),
			new Response('x', { status: 200, headers: { 'content-length': '131073' } }),
		];
		const cache = new JwksCache(async () => cases.shift()!);
		for (const kid of ['invalid-json', 'duplicate', 'oversized']) {
			await expect(cache.getKeys('https://access.test/certs', kid)).rejects.toThrow();
		}
	});
});

describe('Cloudflare Access authentication', () => {
	it('accepts both current and previous Cloudflare keys without a second fetch', async () => {
		const fetcher = vi.fn(
			async () =>
				new Response(JSON.stringify({ keys: [publicKeyOne, publicKeyTwo] }), {
					headers: { 'cache-control': 'max-age=300' },
				}),
		);
		vi.stubGlobal('fetch', fetcher);
		const environment = { ACCESS_TEAM_DOMAIN: accessDomain, ACCESS_AUD: accessAudience };

		expect(
			await authenticateLearner(requestWithToken(await accessToken(privateKeyOne)), environment),
		).not.toBeNull();
		expect(
			await authenticateLearner(requestWithToken(await accessToken(privateKeyTwo)), environment),
		).not.toBeNull();
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('verifies RS256, issuer, audience and expiry while reusing a cached key', async () => {
		const fetcher = vi.fn(
			async () =>
				new Response(JSON.stringify({ keys: [publicKeyOne] }), {
					headers: { 'cache-control': 'max-age=300' },
				}),
		);
		vi.stubGlobal('fetch', fetcher);
		const environment = { ACCESS_TEAM_DOMAIN: accessDomain, ACCESS_AUD: accessAudience };
		const valid = await accessToken(privateKeyOne);

		expect(await authenticateLearner(requestWithToken(valid), environment)).toMatchObject({
			learnerId: expect.stringMatching(/^learner-[0-9a-f]{32}$/),
		});
		expect(await authenticateLearner(requestWithToken(valid), environment)).not.toBeNull();
		expect(fetcher).toHaveBeenCalledTimes(1);

		for (const claims of [
			{ aud: 'wrong-audience' },
			{ iss: 'https://wrong.cloudflareaccess.com' },
			{ exp: Math.floor(Date.now() / 1_000) - 1 },
			{ nbf: Math.floor(Date.now() / 1_000) + 300 },
			{ exp: undefined },
		]) {
			const token = await accessToken(privateKeyOne, claims);
			expect(await authenticateLearner(requestWithToken(token), environment)).toBeNull();
		}
	});

	it('refreshes for key rotation and fails closed for an unknown kid or fetch failure', async () => {
		const responses: Response[] = [
			new Response(JSON.stringify({ keys: [publicKeyOne] }), {
				headers: { 'cache-control': 'max-age=300' },
			}),
			new Response(JSON.stringify({ keys: [publicKeyTwo] }), {
				headers: { 'cache-control': 'max-age=300' },
			}),
			new Response(JSON.stringify({ keys: [publicKeyTwo] }), {
				headers: { 'cache-control': 'max-age=300' },
			}),
			new Response('unavailable', { status: 503 }),
		];
		const fetcher = vi.fn(async () => responses.shift()!);
		vi.stubGlobal('fetch', fetcher);
		const environment = { ACCESS_TEAM_DOMAIN: accessDomain, ACCESS_AUD: accessAudience };

		expect(
			await authenticateLearner(requestWithToken(await accessToken(privateKeyOne)), environment),
		).not.toBeNull();
		expect(
			await authenticateLearner(requestWithToken(await accessToken(privateKeyTwo)), environment),
		).not.toBeNull();

		const unknown = { ...privateKeyOne, kid: 'never-published' };
		expect(
			await authenticateLearner(requestWithToken(await accessToken(unknown)), environment),
		).toBeNull();
		accessJwksCache.clear();
		expect(
			await authenticateLearner(requestWithToken(await accessToken(privateKeyOne)), environment),
		).toBeNull();
		expect(fetcher).toHaveBeenCalledTimes(4);
	});

	it('fails closed for missing, malformed, unsigned, mismatched, or locally spoofed identity', async () => {
		const fetcher = vi.fn(
			async () =>
				new Response(JSON.stringify({ keys: [publicKeyOne] }), {
					headers: { 'cache-control': 'max-age=300' },
				}),
		);
		vi.stubGlobal('fetch', fetcher);
		const environment = { ACCESS_TEAM_DOMAIN: accessDomain, ACCESS_AUD: accessAudience };
		const missingHeader = new Request('https://app.example.test/api/profile');
		const emptyHeader = requestWithToken('');
		const malformedHeader = requestWithToken('not-a-jwt');
		const noneHeader = btoa(JSON.stringify({ alg: 'none', kid: 'key-one', typ: 'JWT' }))
			.replace(/=/gu, '')
			.replace(/\+/gu, '-')
			.replace(/\//gu, '_');
		const nonePayload = btoa(
			JSON.stringify({
				sub: 'learner@example.com',
				exp: Math.floor(Date.now() / 1_000) + 300,
			}),
		)
			.replace(/=/gu, '')
			.replace(/\+/gu, '-')
			.replace(/\//gu, '_');
		const unsigned = requestWithToken(`${noneHeader}.${nonePayload}.`);
		const mismatchedPrivateKey = { ...privateKeyTwo, kid: 'key-one' };
		const badSignature = requestWithToken(await accessToken(mismatchedPrivateKey));
		const unknownKid = requestWithToken(
			await accessToken({ ...privateKeyOne, kid: 'never-published' }),
		);
		const localSpoof = new Request('https://app.example.test/api/profile', {
			headers: { 'x-english-os-local-user': 'remote-spoof' },
		});

		for (const request of [
			missingHeader,
			emptyHeader,
			malformedHeader,
			unsigned,
			badSignature,
			unknownKid,
			localSpoof,
		]) {
			expect(
				await authenticateLearner(request, {
					...environment,
					ALLOW_LOCAL_AUTH: 'false',
				}),
			).toBeNull();
		}
	});

	it('permits the explicit local fallback only on loopback requests', async () => {
		const environment = { ALLOW_LOCAL_AUTH: 'true' };
		expect(
			await authenticateLearner(
				new Request('http://127.0.0.1:8787/api/v1/today', {
					headers: { 'x-english-os-local-user': 'local-fixture' },
				}),
				environment,
			),
		).toMatchObject({ learnerId: expect.stringMatching(/^learner-[0-9a-f]{32}$/) });
		expect(
			await authenticateLearner(
				new Request('https://app.example.test/api/v1/today', {
					headers: { 'x-english-os-local-user': 'remote-spoof' },
				}),
				environment,
			),
		).toBeNull();
	});
});
