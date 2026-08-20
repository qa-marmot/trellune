import { decode, verifyWithJwks } from 'hono/jwt';
import { accessJwksCache } from './jwksCache';

export interface AuthEnvironment {
	ALLOW_LOCAL_AUTH?: string;
	ACCESS_TEAM_DOMAIN?: string;
	ACCESS_AUD?: string;
}

export interface LearnerIdentity {
	learnerId: string;
	accessSubject: string;
}

function isLoopbackRequest(request: Request): boolean {
	try {
		return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname);
	} catch {
		return false;
	}
}

export function accessSubjectFromClaims(
	claims: Record<string, unknown>,
	nowSeconds = Math.floor(Date.now() / 1_000),
): string | null {
	if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || claims.exp <= nowSeconds) {
		return null;
	}
	const subject =
		typeof claims.sub === 'string'
			? claims.sub
			: typeof claims.email === 'string'
				? claims.email
				: null;
	return subject?.trim().toLocaleLowerCase('en-US') || null;
}

async function sha256(value: string): Promise<string> {
	const bytes = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function authenticateLearner(
	request: Request,
	environment: AuthEnvironment,
): Promise<LearnerIdentity | null> {
	const accessAssertion = request.headers.get('cf-access-jwt-assertion');
	let subject: string | null = null;

	if (accessAssertion && environment.ACCESS_TEAM_DOMAIN && environment.ACCESS_AUD) {
		const domain = environment.ACCESS_TEAM_DOMAIN.trim()
			.toLocaleLowerCase('en-US')
			.replace(/^https:\/\//, '')
			.replace(/\/$/, '');
		if (!/^[a-z0-9.-]+\.cloudflareaccess\.com$/.test(domain)) return null;
		try {
			const { header } = decode(accessAssertion);
			if (header.alg !== 'RS256' || !header.kid || header.kid.length > 256) return null;
			const keys = await accessJwksCache.getKeys(
				`https://${domain}/cdn-cgi/access/certs`,
				header.kid,
			);
			const payload = await verifyWithJwks(accessAssertion, {
				keys,
				verification: { iss: `https://${domain}`, aud: environment.ACCESS_AUD },
				allowedAlgorithms: ['RS256'],
			});
			const claims = payload as Record<string, unknown>;
			subject = accessSubjectFromClaims(claims);
		} catch {
			return null;
		}
	} else if (environment.ALLOW_LOCAL_AUTH === 'true' && isLoopbackRequest(request)) {
		subject = request.headers.get('x-english-os-local-user')?.trim() || 'local-development-only';
	}

	if (!subject || subject.length > 320) return null;
	const accessSubject = await sha256(subject);
	return { learnerId: `learner-${accessSubject.slice(0, 32)}`, accessSubject };
}
