<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import PageContainer from '$lib/components/layout/PageContainer.svelte';
	import { Button } from '$lib/components/ui/button';
	import { pageTitle } from '$lib/config/site';

	/**
	 * Deliberately generic. Errors are mapped to a short, calm sentence rather
	 * than rendering `page.error.message`, which can carry internal detail we
	 * have no reason to show a visitor.
	 */
	const titles: Record<number, string> = {
		404: 'Page not found',
		403: 'You cannot open this page',
		500: 'Something went wrong'
	};

	const heading = $derived(titles[page.status] ?? 'Something went wrong');
	const body = $derived(
		page.status === 404
			? 'The page you asked for does not exist, or it has moved.'
			: 'The page could not be loaded. Try again in a moment.'
	);
</script>

<svelte:head>
	<title>{pageTitle(heading)}</title>
</svelte:head>

<PageContainer>
	<div class="max-w-lg">
		<p class="text-sm font-medium text-muted-foreground">{page.status}</p>
		<h1 class="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
			{heading}
		</h1>
		<p class="mt-3 text-base text-muted-foreground">{body}</p>
		<Button href={resolve('/')} class="mt-6">Back to home</Button>
	</div>
</PageContainer>
