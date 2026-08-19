import { describe, expect, it } from 'vitest';
import { parseStrictJson } from './strictJson';

describe('parseStrictJson', () => {
	it('parses a normal nested JSON document', () => {
		expect(parseStrictJson('{"a":1,"nested":{"ok":true},"items":[null,"日本語"]}')).toEqual({
			a: 1,
			nested: { ok: true },
			items: [null, '日本語'],
		});
	});

	it('rejects duplicate keys at every object level', () => {
		expect(() => parseStrictJson('{"a":1,"a":2}')).toThrow(/同じJSONキー/);
		expect(() => parseStrictJson('{"outer":{"x":1,"x":2}}')).toThrow(/同じJSONキー/);
	});

	it('does not mutate prototypes for special keys', () => {
		const value = parseStrictJson('{"__proto__":{"polluted":true}}') as Record<string, unknown>;
		expect(value).toHaveProperty('__proto__');
		expect(Object.prototype).not.toHaveProperty('polluted');
	});

	it('rejects trailing input and excessive nesting', () => {
		expect(() => parseStrictJson('{} {}')).toThrow(/余分な文字/);
		expect(() => parseStrictJson('[[[0]]]', 1)).toThrow(/入れ子/);
	});
});
