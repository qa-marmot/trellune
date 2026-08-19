import { z } from 'zod';

const MAX_JWKS_BYTES = 128 * 1024;
const DEFAULT_TTL_MS = 5 * 60 * 1_000;
const MAX_TTL_MS = 60 * 60 * 1_000;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;

const RsaJwkSchema = z
	.object({
		kid: z.string().min(1).max(256),
		kty: z.literal('RSA'),
		alg: z.literal('RS256'),
		use: z.literal('sig'),
		n: z.string().min(342).max(16_384).regex(BASE64URL_PATTERN),
		e: z.string().min(2).max(32).regex(BASE64URL_PATTERN),
		key_ops: z.tuple([z.literal('verify')]).optional(),
		ext: z.boolean().optional(),
	})
	.passthrough();

const JwksSchema = z
	.object({
		keys: z.array(RsaJwkSchema).min(1).max(32),
	})
	.strip()
	.superRefine(({ keys }, context) => {
		const keyIds = new Set<string>();
		for (const key of keys) {
			if (keyIds.has(key.kid)) {
				context.addIssue({
					code: 'custom',
					message: `Duplicate JWKS kid: ${key.kid}`,
				});
			}
			keyIds.add(key.kid);
		}
	});

export type AccessJwk = z.infer<typeof RsaJwkSchema>;

interface CacheEntry {
	keys: AccessJwk[];
	expiresAt: number;
}

type JwksFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function cacheTtlMilliseconds(cacheControl: string | null): number {
	if (!cacheControl) return DEFAULT_TTL_MS;
	if (/(?:^|,)\s*(?:no-store|no-cache)\s*(?:,|$)/i.test(cacheControl)) return 0;
	const match = /(?:^|,)\s*max-age\s*=\s*"?(\d+)"?/i.exec(cacheControl);
	if (!match) return DEFAULT_TTL_MS;
	const seconds = Number(match[1]);
	if (!Number.isSafeInteger(seconds)) return DEFAULT_TTL_MS;
	return Math.min(seconds * 1_000, MAX_TTL_MS);
}

export class JwksCache {
	private readonly entries = new Map<string, CacheEntry>();
	private readonly inFlight = new Map<string, Promise<CacheEntry>>();

	constructor(
		private readonly fetcher: JwksFetcher = (input, init) => fetch(input, init),
		private readonly now: () => number = Date.now,
	) {}

	clear(): void {
		this.entries.clear();
		this.inFlight.clear();
	}

	async getKeys(uri: string, requiredKid: string): Promise<AccessJwk[]> {
		const now = this.now();
		const cached = this.entries.get(uri);
		if (cached && cached.expiresAt > now && cached.keys.some(({ kid }) => kid === requiredKid)) {
			return cached.keys;
		}

		const fresh = await this.fetch(uri);
		return fresh.keys;
	}

	private async fetch(uri: string): Promise<CacheEntry> {
		const pending = this.inFlight.get(uri);
		if (pending) return pending;

		const request = this.fetchAndValidate(uri);
		this.inFlight.set(uri, request);
		try {
			return await request;
		} finally {
			this.inFlight.delete(uri);
		}
	}

	private async fetchAndValidate(uri: string): Promise<CacheEntry> {
		const response = await this.fetcher(uri, {
			headers: { accept: 'application/json' },
		});
		if (!response.ok) throw new Error('Cloudflare Access JWKS fetch failed');

		const declaredLength = Number(response.headers.get('content-length'));
		if (Number.isFinite(declaredLength) && declaredLength > MAX_JWKS_BYTES) {
			throw new Error('Cloudflare Access JWKS response is too large');
		}
		const body = await response.text();
		if (new TextEncoder().encode(body).byteLength > MAX_JWKS_BYTES) {
			throw new Error('Cloudflare Access JWKS response is too large');
		}

		let decoded: unknown;
		try {
			decoded = JSON.parse(body);
		} catch {
			throw new Error('Cloudflare Access JWKS response is not valid JSON');
		}
		const keys = JwksSchema.parse(decoded).keys;
		const entry = {
			keys,
			expiresAt: this.now() + cacheTtlMilliseconds(response.headers.get('cache-control')),
		};
		if (entry.expiresAt > this.now()) this.entries.set(uri, entry);
		else this.entries.delete(uri);
		return entry;
	}
}

export const accessJwksCache = new JwksCache();
