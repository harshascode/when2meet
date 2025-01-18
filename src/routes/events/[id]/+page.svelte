<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import Header from '$lib/Header.svelte';
	import Footer from '$lib/Footer.svelte';

	const eventId = $page.params.id;
	let event: any = null;
	let loading = true;
	let error: string | null = null;

	onMount(async () => {
		try {
			// Fetch event details from your API
			const response = await fetch(`/api/events/${eventId}`);
			if (!response.ok) throw new Error('Event not found');
			event = await response.json();
		} catch (e) {
			error = (e as Error).message;
		} finally {
			loading = false;
		}
	});
</script>

<div class="flex min-h-screen flex-col">
	<Header />

	<main class="container mx-auto max-w-4xl flex-1 py-8">
		{#if loading}
			<div>Loading...</div>
		{:else if error}
			<div class="text-red-500">{error}</div>
		{:else}
			<div class="grid gap-8">
				<h1 class="text-2xl font-bold">{event.name}</h1>
				<!-- Add your event viewing/response interface here -->
				<!-- This is where participants will select their availability -->
			</div>
		{/if}
	</main>

	<Footer />
</div>
