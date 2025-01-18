<script lang="ts">
	import Footer from '$lib/Footer.svelte';
	import Header from '$lib/Header.svelte';

	let eventName = '';
	let startDate = new Date(2025, 0, 12);

	const today = () => {
		startDate = new Date();
	};
</script>

<div class="flex min-h-screen flex-col">
	<!-- Header -->
	<Header />

	<!-- Main Content -->
	<main class="container mx-auto max-w-4xl flex-1 py-8">
		<div class="grid gap-8">
			<!-- Event Name Input -->
			<div class="text-center">
				<input
					type="text"
					placeholder="New Event Name"
					class="mx-auto w-full max-w-md rounded-md border border-gray-300 px-4 py-2 text-center text-xl font-medium"
					bind:value={eventName}
				/>
			</div>

			<div class="grid gap-8 md:grid-cols-2">
				<!-- Dates Section -->
				<div class="space-y-4">
					<h2 class="text-center text-lg font-medium">What dates might work?</h2>
					<div class="space-y-2 text-center text-sm text-gray-500">
						<p>Click and drag dates to choose possibilities.</p>
						<p>Click and drag labels to shift the calendar.</p>
					</div>
					<div class="flex items-center justify-center gap-2">
						<span class="text-sm">Survey using:</span>
						<select class="w-[180px] rounded-md border border-gray-300 px-2 py-1">
							<option value="specific">Specific Dates</option>
							<option value="weekday">Weekday Patterns</option>
						</select>
					</div>
					<!-- Replace CalendarGrid -->
					<div class="rounded-md border bg-gray-100 p-4 text-center">
						Calendar Placeholder (Add your calendar here)
					</div>
					<div class="text-center">
						<button class="rounded-md border px-4 py-2 text-sm hover:bg-gray-100" on:click={today}>
							Today
						</button>
					</div>
				</div>

				<!-- Times Section -->
				<div class="space-y-4">
					<h2 class="text-center text-lg font-medium">What times might work?</h2>
					<!-- Replace TimeSelector -->
					<div class="rounded-md border bg-gray-100 p-4 text-center">
						Time Selector Placeholder (Add your time selector here)
					</div>
				</div>
			</div>

			<!-- Submit Button -->
			<div class="space-y-4 text-center">
				<div class="flex items-center justify-center gap-2">
					<span class="text-lg font-medium">Ready?</span>
					<button
						type="submit"
						class="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700"
					>
						Create Event
					</button>
				</div>
			</div>
		</div>
	</main>

	<!-- Footer -->
	<Footer />
</div>
