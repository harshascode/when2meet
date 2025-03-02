<script lang="ts">
	import { onMount } from 'svelte';

	interface Event {
		id: string;
		name: string;
		createdAt: string;
	}

	let events: Event[] = $state([]);

	onMount(async () => {
		// Try to get events from localStorage first
		const storedEvents = localStorage.getItem('createdEvents');
		if (storedEvents) {
			events = JSON.parse(storedEvents);
		}

		try {
			// Fetch events from the API
			const response = await fetch('/api/events');
			if (response.ok) {
				const apiEvents = await response.json();
				// Update localStorage with the latest events
				localStorage.setItem('createdEvents', JSON.stringify(apiEvents));
				events = apiEvents;
			}
		} catch (error) {
			console.error('Failed to fetch events:', error);
		}

		// Sort events by creation date, most recent first
		events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	});
</script>

<div class="container mx-auto h-[70vh] px-4 py-8">
	<h1 class="mb-6 text-3xl font-bold">Event History</h1>

	{#if events.length === 0}
		<div class="py-8 text-center">
			<p class="text-gray-600">No events created yet</p>
		</div>
	{:else}
		<div class="grid gap-4">
			{#each events as event}
				<a
					href="/events/{event.id}"
					class="block rounded-lg bg-white p-4 shadow transition-shadow duration-200 hover:shadow-md"
				>
					<div class="flex items-center justify-between">
						<div>
							<h2 class="text-xl font-semibold text-gray-800">{event.name}</h2>
							<p class="text-sm text-gray-500">
								Created: {new Date(event.createdAt).toLocaleDateString()}
							</p>
						</div>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-6 w-6 text-gray-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5l7 7-7 7"
							/>
						</svg>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>

<style>
	.container {
		max-width: 800px;
	}
</style>
