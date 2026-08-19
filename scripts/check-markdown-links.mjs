import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const markdownFiles = execFileSync(
	'git',
	['ls-files', '--cached', '--others', '--exclude-standard', '--', '*.md'],
	{
		encoding: 'utf8',
	},
)
	.split(/\r?\n/u)
	.filter(Boolean);
const linkPattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+['"][^)]*['"])?\)/gu;
const failures = [];

for (const file of markdownFiles) {
	const text = readFileSync(resolve(root, file), 'utf8');
	for (const match of text.matchAll(linkPattern)) {
		const rawTarget = match[1].replace(/^<|>$/gu, '');
		if (
			rawTarget.startsWith('#') ||
			rawTarget.startsWith('/') ||
			/^(?:https?:|mailto:|tel:|data:)/u.test(rawTarget)
		) {
			continue;
		}
		const target = decodeURIComponent(rawTarget.split(/[?#]/u, 1)[0]);
		if (!target) continue;
		const resolved = resolve(root, dirname(file), target);
		const candidates = extname(resolved)
			? [resolved]
			: [resolved, `${resolved}.md`, resolve(resolved, 'README.md')];
		if (!candidates.some(existsSync)) {
			failures.push(`${file}: ${rawTarget}`);
		}
	}
}

if (failures.length) {
	console.error('Broken relative Markdown links:');
	for (const failure of failures) console.error(`- ${failure}`);
	process.exitCode = 1;
} else {
	console.log(`Markdown relative-link check passed (${markdownFiles.length} files).`);
}
