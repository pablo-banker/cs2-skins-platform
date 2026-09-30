import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			/**
			 * A long-lived Node process, deliberately.
			 *
			 * The architecture is built around a cached grouped catalog index —
			 * 21k upstream rows collapsed into ~2k products — plus process-local
			 * bounded caches and in-flight deduplication. On ephemeral functions
			 * that index would be rebuilt on cold starts across instances, which
			 * is both slow and a quota cost. A single container amortises it.
			 *
			 * `PORT` and `HOST` come from the environment at runtime, so the
			 * image runs unchanged on any container host.
			 */
			adapter: adapter(),

			/**
			 * Content Security Policy.
			 *
			 * `auto` lets SvelteKit hash or nonce the framework's own inline
			 * script and style, so the policy can stay strict without
			 * `unsafe-inline`.
			 *
			 * The allowlists below are the origins the application actually
			 * uses, and nothing else: catalog artwork comes from CS2Cap's CDN,
			 * fonts are bundled locally by Fontsource rather than fetched from
			 * a font service, and the browser talks only to this origin — it
			 * never reaches CS2Cap directly.
			 */
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					/**
					 * `unsafe-inline` here, and only here.
					 *
					 * SvelteKit's own route-change announcer — the visually
					 * hidden `#svelte-announcer` that tells a screen reader
					 * which page was navigated to — carries a `style`
					 * attribute. Style attributes cannot be hashed or nonced
					 * (the browser says so explicitly), so the alternatives
					 * are this or removing an accessibility feature from the
					 * framework.
					 *
					 * The boundary that matters stays intact: `script-src` is
					 * `'self'` with no inline escape, which is what stops
					 * injected code. A permissive style-src risks CSS-based
					 * data inference, which is a far narrower problem.
					 */
					'style-src': ['self', 'unsafe-inline'],
					// `data:` covers the inline SVG placeholder a failed image
					// falls back to; `blob:` is not needed and stays out.
					'img-src': ['self', 'data:', 'https://cdn.cs2c.app'],
					// `data:` is required, not precautionary: Vite inlines font
					// subsets under its asset limit, so some Fontsource faces
					// arrive as data URIs from our own stylesheet.
					'font-src': ['self', 'data:'],
					// Same-origin only. The server talks to CS2Cap; the browser
					// talks to this application.
					'connect-src': ['self'],
					'object-src': ['none'],
					'base-uri': ['self'],
					'form-action': ['self'],
					'frame-ancestors': ['none'],
					'frame-src': ['none'],
					'worker-src': ['self']
				}
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				// Component tests: jsdom + Testing Library.
				extends: './vite.config.ts',
				resolve: { conditions: ['browser'] },
				test: {
					name: 'client',
					environment: 'jsdom',
					setupFiles: ['./vitest-setup-client.ts'],
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				// Unit tests: plain modules, node environment.
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
