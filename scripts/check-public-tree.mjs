import { existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
	encoding: 'utf8',
})
	.split(/\r?\n/u)
	.filter(Boolean);
const forbiddenPath =
	/(?:^|\/)(?:\.dev\.vars|wrangler\.local\.jsonc|\.env|backups|learner-data)(?:$|\/)|\.(?:sqlite(?:3)?|db|bak)$/iu;
const failures = tracked.filter((file) => forbiddenPath.test(file) && file !== '.env.example');
const personalMarkers = [
	['personal fixture identifier', /\bYabu\b/iu],
	['personal Windows path', /C:\\Users\\yabu(?:\\|\/|$)/iu],
	['personal macOS path', /\/Users\/yabu(?:\/|$)/iu],
	['personal Linux path', /\/home\/yabu(?:\/|$)/iu],
];
const personalMarkerExceptions = new Set(['scripts/check-public-tree.mjs']);
const textFiles = tracked.filter((file) => {
	try {
		return (
			statSync(file).size <= 2_000_000 &&
			/\.(?:md|txt|jsonc?|ya?ml|ts|tsx|js|mjs|html|svg)$/iu.test(file)
		);
	} catch {
		return false;
	}
});

for (const file of textFiles) {
	const text = readFileSync(file, 'utf8');
	if (/"database_id"\s*:\s*"[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}"/iu.test(text)) {
		failures.push(`${file}: literal D1 UUID`);
	}
	if (
		/\b(?:sk|pk)_[A-Za-z0-9_-]{16,}\b/u.test(text) ||
		/-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/u.test(text)
	) {
		failures.push(`${file}: credential-like material`);
	}
	if (!personalMarkerExceptions.has(file)) {
		for (const [label, pattern] of personalMarkers) {
			if (pattern.test(text)) failures.push(`${file}: ${label}`);
		}
	}
}

const localSources = ['wrangler.local.jsonc', '.dev.vars'].filter(existsSync);
const privateTokens = new Set();
for (const source of localSources) {
	const text = readFileSync(source, 'utf8');
	const candidates = [
		...text.matchAll(/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}|\b[a-f0-9]{32}\b/giu),
		...text.matchAll(
			/"(?:database_id|account_id|ACCESS_TEAM_DOMAIN|pattern)"\s*:\s*"([^"\s]+)"/giu,
		),
		...text.matchAll(/^\s*ACCESS_TEAM_DOMAIN=([^\s#]+)/gmu),
	];
	for (const token of candidates) {
		const value = (token[1] ?? token[0]).toLowerCase();
		if (
			!value.includes('your-') &&
			!value.endsWith('.example') &&
			!value.endsWith('.cloudflareaccess.com') &&
			!['example.com', 'cloudflareaccess.com', 'localhost', 'local'].includes(value)
		) {
			privateTokens.add(value);
		}
	}
}
if (privateTokens.size) {
	for (const file of textFiles) {
		const lower = readFileSync(file, 'utf8').toLowerCase();
		for (const token of privateTokens) {
			if (lower.includes(token))
				failures.push(`${file}: value copied from ignored local configuration`);
		}
	}
}

const brandExceptions = new Set([
	'docs/NAMING.md',
	'docs/LEGACY_IDENTIFIERS.md',
	'scripts/check-public-tree.mjs',
]);
for (const file of textFiles) {
	if (brandExceptions.has(file)) continue;
	if (/English OS|EnglishOS/u.test(readFileSync(file, 'utf8'))) {
		failures.push(`${file}: stale public brand`);
	}
}

if (failures.length) {
	console.error('Public-tree safety check failed:');
	for (const failure of [...new Set(failures)]) console.error(`- ${failure}`);
	process.exitCode = 1;
} else {
	console.log(
		`Public-tree safety check passed (${tracked.length} public-candidate files; ${localSources.length} local configuration source(s) checked).`,
	);
}
