import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the boundary that the whole architecture rests on: product components
 * render normalized domain types and nothing else.
 *
 * This is checked against the sources rather than at runtime because the
 * failure it prevents is an *import* — one `$lib/server` reference would pull
 * the CS2Cap client, and with it the API key, toward the browser bundle.
 * SvelteKit would reject that at build time, but a test names the rule and
 * fails faster.
 */
const DOMAIN_DIRS = ['skin', 'market', 'kit', 'layout'] as const;

function componentSources(): { file: string; source: string }[] {
	return DOMAIN_DIRS.flatMap((dir) => {
		const path = join('src/lib/components', dir);

		return readdirSync(path)
			.filter((name) => name.endsWith('.svelte'))
			.map((name) => ({
				file: `${dir}/${name}`,
				source: readFileSync(join(path, name), 'utf8')
			}));
	});
}

const sources = componentSources();

describe('domain component boundary', () => {
	it('finds the components it is meant to be guarding', () => {
		expect(sources.length).toBeGreaterThan(10);
	});

	it('never imports server-only code', () => {
		for (const { file, source } of sources) {
			expect(source, file).not.toContain('$lib/server');
			expect(source, file).not.toContain('$env/static/private');
			expect(source, file).not.toContain('$env/dynamic/private');
		}
	});

	it('never mentions a raw CS2Cap field name', () => {
		// Components speak Skin, SkinVariant, MarketQuote and MarketProvider.
		const upstreamFields = [
			'lowest_ask',
			'market_hash_name',
			'is_stattrak',
			'is_souvenir',
			'rarity_name',
			'rarity_color',
			'item_id',
			'last_updated'
		];

		for (const { file, source } of sources) {
			for (const field of upstreamFields) {
				expect(source, `${file} references ${field}`).not.toContain(field);
			}
		}
	});

	it('never fetches its own data', () => {
		for (const { file, source } of sources) {
			expect(source, file).not.toMatch(/\bfetch\s*\(/);
			expect(source, file).not.toContain('@tanstack/svelte-query');
			expect(source, file).not.toContain('services/');
		}
	});

	it('uses the shared currency formatter rather than dividing by 100', () => {
		for (const { file, source } of sources) {
			expect(source, file).not.toMatch(/\/\s*100\b/);
			expect(source, file).not.toContain('toFixed(');
		}
	});

	it('does not inline an upstream rarity colour as a style', () => {
		for (const { file, source } of sources) {
			expect(source, file).not.toMatch(/style=.*rarity\?*\.color/);
		}
	});

	it('does not reach for GSAP', () => {
		for (const { file, source } of sources) {
			expect(source, file).not.toContain('gsap');
		}
	});
});
