import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = process.cwd();
const defaultTarget = resolve(root, '..', 'trellune-public-export');
const target = resolve(process.argv[2] ?? process.env.TRELLUNE_PUBLIC_EXPORT_DIR ?? defaultTarget);

if (target === root || root.startsWith(`${target}\\`) || root.startsWith(`${target}/`)) {
	throw new Error('Public export target must be outside the source repository.');
}
if (existsSync(target) && readdirSync(target).length > 0) {
	throw new Error(`Public export target must be absent or empty: ${target}`);
}
mkdirSync(target, { recursive: true });

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
	encoding: 'utf8',
})
	.split(/\r?\n/u)
	.filter(Boolean);

for (const file of files) {
	const source = resolve(root, file);
	if (!existsSync(source) || !statSync(source).isFile()) continue;
	const destination = resolve(target, file);
	mkdirSync(dirname(destination), { recursive: true });
	cpSync(source, destination, { force: false, errorOnExist: true });
}

execFileSync('git', ['init', '--initial-branch=main'], { cwd: target, stdio: 'inherit' });
execFileSync('git', ['add', '--all'], { cwd: target, stdio: 'inherit' });
const stagedStatus = execFileSync('git', ['status', '--short'], { cwd: target, encoding: 'utf8' })
	.split(/\r?\n/u)
	.filter(Boolean);
if (!stagedStatus.length) throw new Error('Public snapshot unexpectedly contains no staged files.');
execFileSync('node', ['scripts/check-public-tree.mjs'], { cwd: target, stdio: 'inherit' });
execFileSync('node', ['scripts/check-markdown-links.mjs'], { cwd: target, stdio: 'inherit' });

const copied = files.filter((file) => existsSync(resolve(target, file))).length;
console.log(
	`Created clean public snapshot at ${target} (${copied} files; git status reports ${stagedStatus.length} staged additions).`,
);
