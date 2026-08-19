export class StrictJsonError extends Error {
	constructor(
		message: string,
		public readonly position: number,
	) {
		super(`${message}（位置 ${position}）`);
		this.name = 'StrictJsonError';
	}
}

class StrictJsonParser {
	private index = 0;

	constructor(
		private readonly source: string,
		private readonly maxDepth: number,
	) {}

	parse(): unknown {
		this.skipWhitespace();
		const value = this.parseValue(0);
		this.skipWhitespace();
		if (this.index !== this.source.length) this.fail('JSONの後ろに余分な文字があります');
		return value;
	}

	private parseValue(depth: number): unknown {
		if (depth > this.maxDepth) this.fail('JSONの入れ子が深すぎます');
		this.skipWhitespace();
		const token = this.source[this.index];
		if (token === '{') return this.parseObject(depth + 1);
		if (token === '[') return this.parseArray(depth + 1);
		if (token === '"') return this.parseString();
		if (token === '-' || (token >= '0' && token <= '9')) return this.parseNumber();
		if (this.source.startsWith('true', this.index)) {
			this.index += 4;
			return true;
		}
		if (this.source.startsWith('false', this.index)) {
			this.index += 5;
			return false;
		}
		if (this.source.startsWith('null', this.index)) {
			this.index += 4;
			return null;
		}
		this.fail('JSONの値が不正です');
	}

	private parseObject(depth: number): Record<string, unknown> {
		this.index += 1;
		const value = Object.create(null) as Record<string, unknown>;
		const keys = new Set<string>();
		this.skipWhitespace();
		if (this.source[this.index] === '}') {
			this.index += 1;
			return value;
		}
		while (this.index < this.source.length) {
			this.skipWhitespace();
			if (this.source[this.index] !== '"') this.fail('オブジェクトのキーが不正です');
			const key = this.parseString();
			if (keys.has(key)) this.fail(`同じJSONキー「${key}」が複数あります`);
			keys.add(key);
			this.skipWhitespace();
			if (this.source[this.index] !== ':') this.fail('キーの後ろに「:」が必要です');
			this.index += 1;
			Object.defineProperty(value, key, {
				value: this.parseValue(depth),
				enumerable: true,
				configurable: true,
				writable: true,
			});
			this.skipWhitespace();
			if (this.source[this.index] === '}') {
				this.index += 1;
				return value;
			}
			if (this.source[this.index] !== ',') this.fail('オブジェクト項目の区切りが不正です');
			this.index += 1;
		}
		this.fail('オブジェクトが閉じられていません');
	}

	private parseArray(depth: number): unknown[] {
		this.index += 1;
		const value: unknown[] = [];
		this.skipWhitespace();
		if (this.source[this.index] === ']') {
			this.index += 1;
			return value;
		}
		while (this.index < this.source.length) {
			value.push(this.parseValue(depth));
			this.skipWhitespace();
			if (this.source[this.index] === ']') {
				this.index += 1;
				return value;
			}
			if (this.source[this.index] !== ',') this.fail('配列項目の区切りが不正です');
			this.index += 1;
		}
		this.fail('配列が閉じられていません');
	}

	private parseString(): string {
		const start = this.index;
		this.index += 1;
		while (this.index < this.source.length) {
			const char = this.source[this.index];
			if (char === '"') {
				this.index += 1;
				try {
					return JSON.parse(this.source.slice(start, this.index)) as string;
				} catch {
					this.fail('文字列のエスケープが不正です');
				}
			}
			if (char === '\\') {
				this.index += 2;
				continue;
			}
			if (char.charCodeAt(0) < 0x20) this.fail('文字列に制御文字があります');
			this.index += 1;
		}
		this.fail('文字列が閉じられていません');
	}

	private parseNumber(): number {
		const match = this.source
			.slice(this.index)
			.match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
		if (!match) this.fail('数値が不正です');
		this.index += match[0].length;
		const value = Number(match[0]);
		if (!Number.isFinite(value)) this.fail('有限でない数値は使用できません');
		return value;
	}

	private skipWhitespace(): void {
		while (/\s/u.test(this.source[this.index] ?? '')) this.index += 1;
	}

	private fail(message: string): never {
		throw new StrictJsonError(message, this.index);
	}
}

export function parseStrictJson(source: string, maxDepth = 100): unknown {
	return new StrictJsonParser(source, maxDepth).parse();
}
