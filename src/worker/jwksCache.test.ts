import { beforeAll, describe, expect, it, vi } from 'vitest';
import { JwksCache, type AccessJwk } from './jwksCache';

let cloudflarePublicKey: AccessJwk;
let cloudflarePreviousKey: AccessJwk;

async function makePublicKey(kid: string): Promise<AccessJwk> {
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
	const publicKey = await crypto.subtle.exportKey('jwk', pair.publicKey);
	return {
		...publicKey,
		kid,
		kty: 'RSA',
		alg: 'RS256',
		use: 'sig',
	} as AccessJwk;
}

function responseFor(body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'cache-control': 'public, max-age=300' },
	});
}

function without(key: AccessJwk, property: keyof AccessJwk): Record<string, unknown> {
	const clone = { ...key } as Record<string, unknown>;
	delete clone[property];
	return clone;
}

beforeAll(async () => {
	cloudflarePublicKey = await makePublicKey('current-key');
	cloudflarePreviousKey = await makePublicKey('previous-key');
});

describe('Cloudflare Access JWKS response contract', () => {
	it('accepts the official certificate envelope while selecting only validated JWK keys', async () => {
		const fetcher = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						keys: [cloudflarePublicKey],
						public_cert: {
							kid: 'current-key',
							cert: '-----BEGIN CERTIFICATE----- current -----END CERTIFICATE-----',
						},
						public_certs: [
							{
								kid: 'current-key',
								cert: '-----BEGIN CERTIFICATE----- current -----END CERTIFICATE-----',
							},
						],
					}),
				),
		);
		const cache = new JwksCache(fetcher);

		await expect(cache.getKeys('https://access.test/certs', 'current-key')).resolves.toEqual([
			cloudflarePublicKey,
		]);
	});

	it('accepts every supported Cloudflare top-level variant and ignores unrelated additions', async () => {
		const currentCert = {
			kid: 'current-key',
			cert: '-----BEGIN CERTIFICATE----- current -----END CERTIFICATE-----',
		};
		const previousCert = {
			kid: 'previous-key',
			cert: '-----BEGIN CERTIFICATE----- previous -----END CERTIFICATE-----',
		};
		const variants = [
			{ keys: [cloudflarePublicKey] },
			{ keys: [cloudflarePublicKey], public_cert: currentCert },
			{ keys: [cloudflarePublicKey], public_certs: [currentCert] },
			{
				keys: [cloudflarePublicKey],
				public_cert: currentCert,
				public_certs: [previousCert, currentCert],
			},
			{
				keys: [cloudflarePublicKey],
				public_cert: currentCert,
				public_certs: [currentCert],
				future_non_security_metadata: { ignored: true },
			},
		];

		for (const [index, variant] of variants.entries()) {
			const cache = new JwksCache(async () => responseFor(variant));
			await expect(
				cache.getKeys(`https://access.test/certs/${index}`, 'current-key'),
			).resolves.toEqual([cloudflarePublicKey]);
		}
	});

	it('retains current and previous validated keys and serves both from one fetch', async () => {
		const fetcher = vi.fn(async () =>
			responseFor({ keys: [cloudflarePublicKey, cloudflarePreviousKey] }),
		);
		const cache = new JwksCache(fetcher);

		await expect(cache.getKeys('https://access.test/certs', 'current-key')).resolves.toHaveLength(
			2,
		);
		await expect(cache.getKeys('https://access.test/certs', 'previous-key')).resolves.toHaveLength(
			2,
		);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('rejects missing, empty, wrongly typed, or cryptographically malformed key sets', async () => {
		const invalidBodies: Array<[string, unknown]> = [
			['empty object', {}],
			['missing keys', { public_cert: { kid: 'current-key', cert: 'ignored' } }],
			['null keys', { keys: null }],
			['object keys', { keys: {} }],
			['empty keys', { keys: [] }],
			['missing kid', { keys: [without(cloudflarePublicKey, 'kid')] }],
			['invalid kty', { keys: [{ ...cloudflarePublicKey, kty: 'EC' }] }],
			['missing alg', { keys: [without(cloudflarePublicKey, 'alg')] }],
			['invalid alg', { keys: [{ ...cloudflarePublicKey, alg: 'HS256' }] }],
			['missing use', { keys: [without(cloudflarePublicKey, 'use')] }],
			['invalid use', { keys: [{ ...cloudflarePublicKey, use: 'enc' }] }],
			['missing modulus', { keys: [without(cloudflarePublicKey, 'n')] }],
			['missing exponent', { keys: [without(cloudflarePublicKey, 'e')] }],
			['short modulus', { keys: [{ ...cloudflarePublicKey, n: 'AQAB' }] }],
			['malformed modulus', { keys: [{ ...cloudflarePublicKey, n: `${cloudflarePublicKey.n}!` }] }],
			['malformed exponent', { keys: [{ ...cloudflarePublicKey, e: 'AQ==' }] }],
			['invalid key operations', { keys: [{ ...cloudflarePublicKey, key_ops: ['sign'] }] }],
		];

		for (const [label, body] of invalidBodies) {
			const cache = new JwksCache(async () => responseFor(body));
			await expect(
				cache.getKeys(`https://access.test/certs/${encodeURIComponent(label)}`, 'current-key'),
			).rejects.toThrow();
		}
	});
});
