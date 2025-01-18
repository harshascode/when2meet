<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import Header from '$lib/Header.svelte';
	import Footer from '$lib/Footer.svelte';
	import { format } from 'date-fns';

	const eventId = $page.params.id;
	let event: any = null;
	let loading = true;
	let error: string | null = null;
	let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	let participantName = '';
	let availability: { [key: string]: { [key: string]: boolean } } = {};

	// Get all available timezones
	const timezones = Intl.supportedValuesOf('timeZone');

	onMount(async () => {
		try {
			const response = await fetch(`/api/events/${eventId}`);
			if (!response.ok) throw new Error('Event not found');
			event = await response.json();

			// Initialize availability grid
			event.dates.forEach((date: string) => {
				availability[date] = {};
				event.timeSlots.forEach((timeSlot: string) => {
					availability[date][timeSlot] = false;
				});
			});
		} catch (e) {
			error = (e as Error).message;
		} finally {
			loading = false;
		}
	});

	function formatDate(dateStr: string) {
		const date = new Date(dateStr);
		return format(date, 'MMM d\nEEE');
	}

	function toggleAvailability(date: string, timeSlot: string) {
		availability[date][timeSlot] = !availability[date][timeSlot];
		saveAvailability();
	}

	// Update the saveAvailability function
	async function saveAvailability() {
		if (!participantName) {
			alert('Please enter your name before selecting availability');
			return;
		}

		try {
			const response = await fetch(`/api/events/${eventId}/responses`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					participantName,
					availability
				})
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to save availability');
			}

			// Show success message
			const successMessage = document.createElement('div');
			successMessage.className =
				'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow';
			successMessage.textContent = 'Availability saved successfully!';
			document.body.appendChild(successMessage);
			setTimeout(() => successMessage.remove(), 3000);

			// Refresh the event data to show updated group availability
			const eventResponse = await fetch(`/api/events/${eventId}`);
			if (eventResponse.ok) {
				event = await eventResponse.json();
			}
		} catch (error: any) {
			console.error('Error saving availability:', error);
			alert(error.message || 'Failed to save your availability. Please try again.');
		}
	}

	// Function to get group availability percentage for a specific slot
	function getGroupAvailability(date: string, timeSlot: string): number {
		if (!event?.responses) return 0;
		const responsesForSlot = event.responses.filter(
			(r: any) => r.date === date && r.time_slot === timeSlot
		);
		return (responsesForSlot.length / (event.responses.length || 1)) * 100;
	}
</script>

<div class="flex min-h-screen flex-col">
	<Header />

	<main class="container mx-auto max-w-6xl flex-1 px-4 py-8">
		{#if loading}
			<div class="text-center">Loading...</div>
		{:else if error}
			<div class="text-center text-red-500">{error}</div>
		{:else}
			<div class="grid gap-8">
				<div>
					<h1 class="mb-4 text-3xl font-bold">{event.name}</h1>
					<p class="mb-4">
						Share this event:
						<a href={`${window.location.href}`} class="text-blue-600 underline">
							{window.location.href}
						</a>
					</p>
				</div>

				<div class="mb-6 space-y-4">
					<div>
						<label for="participantName" class="mb-2 block font-semibold">Your Name: </label>
						<input
							type="text"
							id="participantName"
							bind:value={participantName}
							class="w-full max-w-md rounded border border-gray-300 px-3 py-2"
							placeholder="Enter your name"
						/>
					</div>

					<div>
						<label for="timezone" class="mb-2 block font-semibold">Your Time Zone: </label>
						<select
							id="timezone"
							bind:value={timezone}
							class="w-full max-w-md rounded border border-gray-300 px-3 py-2"
						>
							{#each timezones as tz}
								<option value={tz}>{tz}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="grid gap-8 md:grid-cols-2">
					<!-- Individual's Availability -->
					<div>
						<h2 class="mb-4 font-semibold">Your Availability</h2>
						<div class="mb-4 flex items-center gap-4">
							<div class="flex items-center">
								<div class="mr-2 h-4 w-4 border border-gray-300 bg-gray-100"></div>
								<span>Unavailable</span>
							</div>
							<div class="flex items-center">
								<div class="mr-2 h-4 w-4 border border-gray-300 bg-green-500"></div>
								<span>Available</span>
							</div>
						</div>

						<div class="overflow-hidden rounded border border-gray-300">
							<!-- Calendar Grid -->
							<div
								class="grid"
								style="grid-template-columns: repeat({event.dates.length}, minmax(0, 1fr))"
							>
								<!-- Date Headers -->
								<div
									class="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] bg-gray-100 text-center font-medium"
								>
									{#each event.dates as date}
										<div class="whitespace-pre-line border-r border-gray-300 p-2">
											{formatDate(date)}
										</div>
									{/each}
								</div>

								<!-- Time Slots -->
								{#each event.timeSlots as timeSlot}
									<div class="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))]">
										{#each event.dates as date}
											<div
												class="h-10 cursor-pointer border-b border-r border-gray-300 transition-colors"
												class:bg-green-500={availability[date][timeSlot]}
												class:bg-gray-100={!availability[date][timeSlot]}
												on:click={() => toggleAvailability(date, timeSlot)}
												title={timeSlot}
											></div>
										{/each}
									</div>
								{/each}
							</div>
						</div>
					</div>

					<!-- Group's Availability -->
					<div>
						<h2 class="mb-4 font-semibold">
							Group's Availability ({event.responses?.length || 0} responses)
						</h2>
						<div class="mb-4 flex items-center gap-4">
							<div class="flex items-center">
								<div class="mr-2 h-4 w-4 border border-gray-300 bg-gray-100"></div>
								<span>0% Available</span>
							</div>
							<div class="flex items-center">
								<div class="mr-2 h-4 w-4 border border-gray-300 bg-green-500"></div>
								<span>100% Available</span>
							</div>
						</div>

						<div class="overflow-hidden rounded border border-gray-300">
							<!-- Calendar Grid -->
							<div
								class="grid"
								style="grid-template-columns: repeat({event.dates.length}, minmax(0, 1fr))"
							>
								<!-- Date Headers -->
								<div
									class="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] bg-gray-100 text-center font-medium"
								>
									{#each event.dates as date}
										<div class="whitespace-pre-line border-r border-gray-300 p-2">
											{formatDate(date)}
										</div>
									{/each}
								</div>

								<!-- Time Slots -->
								{#each event.timeSlots as timeSlot}
									<div class="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))]">
										{#each event.dates as date}
											<div
												class="h-10 border-b border-r border-gray-300"
												style="background-color: rgba(34, 197, 94, {getGroupAvailability(
													date,
													timeSlot
												) / 100})"
												title={`${getGroupAvailability(date, timeSlot)}% available at ${timeSlot}`}
											></div>
										{/each}
									</div>
								{/each}
							</div>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</main>

	<Footer />
</div>
