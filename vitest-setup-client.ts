import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/svelte';
import { afterEach } from 'vitest';

/**
 * jsdom implements no layout, so it has no `scrollIntoView`. Components that
 * keep a selected item in view — the command palette, dropdowns — call it, and
 * without this they throw in tests for a reason that has nothing to do with
 * them.
 */
if (!Element.prototype.scrollIntoView) {
	Element.prototype.scrollIntoView = () => {};
}

afterEach(() => {
	cleanup();
});
