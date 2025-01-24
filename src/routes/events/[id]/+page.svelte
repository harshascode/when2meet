<script lang="ts">
	// Type definitions
	interface Availability {
		[date: string]: {
			[timeSlot: string]: boolean;
		};
	}

	interface Participant {
		name: string;
		timezone: string;
		availability: Availability;
		lastUpdated: string;
	}

	interface Response {
		participant_name: string;
		date: string;
		time_slot: string;
		created_at: string;
		timezone?: string;
	}

	interface Event {
		name: string;
		dates: string[];
		timeSlots: string[];
		responses: Response[];
	}

	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import Header from '$lib/Header.svelte';
	import Footer from '$lib/Footer.svelte';
	import { format } from 'date-fns';

	const eventId = $page.params.id;
	let event: Event | null = $state(null);
	let loading = $state(true);
	let error: string | null = $state(null);
	let timezone = $state(Intl.DateTimeFormat().resolvedOptions().timeZone);
	let participantName = $state('');
	let availability: Availability = $state({});
	let participants: Participant[] = $state([]);
	let selectedParticipant: Participant | null = $state(null);

	// Get all available timezones
	const timezones = Intl.supportedValuesOf('timeZone');

	onMount(async () => {
		try {
			const response = await fetch(`/api/events/${eventId}`);
			if (!response.ok) throw new Error('Event not found');
			event = (await response.json()) as Event;

			// Initialize availability grid
			event.dates.forEach((date: string) => {
				availability[date] = {};
				event!.timeSlots.forEach((timeSlot: string) => {
					availability[date][timeSlot] = false;
				});
			});

			// Group participants by name with their availability
			if (event.responses) {
				const participantMap = new Map<string, Participant>();

				event.responses.forEach((response: Response) => {
					if (!participantMap.has(response.participant_name)) {
						participantMap.set(response.participant_name, {
							name: response.participant_name,
							timezone: response.timezone || 'Unknown',
							availability: {},
							lastUpdated: response.created_at || new Date().toISOString()
						});
					}

					const participant = participantMap.get(response.participant_name);
					if (participant) {
						if (!participant.availability[response.date]) {
							participant.availability[response.date] = {};
						}
						participant.availability[response.date][response.time_slot] = true;
					}
				});

				participants = Array.from(participantMap.values()).sort(
					(a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
				);
			}
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

	function formatDateTime(dateStr: string) {
		return new Date(dateStr).toLocaleString();
	}

	function toggleAvailability(date: string, timeSlot: string) {
		availability[date][timeSlot] = !availability[date][timeSlot];
		saveAvailability();
	}

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
					availability,
					timezone
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

			// Refresh the event data
			const eventResponse = await fetch(`/api/events/${eventId}`);
			if (eventResponse.ok) {
				event = (await eventResponse.json()) as Event;
				// Update participants list
				const participantMap = new Map<string, Participant>();
				event.responses.forEach((response: Response) => {
					if (!participantMap.has(response.participant_name)) {
						participantMap.set(response.participant_name, {
							name: response.participant_name,
							availability: {},
							timezone: response.timezone || 'Unknown',
							lastUpdated: response.created_at
						});
					}
					const participant = participantMap.get(response.participant_name);
					if (participant) {
						if (!participant.availability[response.date]) {
							participant.availability[response.date] = {};
						}
						participant.availability[response.date][response.time_slot] = true;
					}
				});
				participants = Array.from(participantMap.values()).sort(
					(a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
				);
			}
		} catch (error: any) {
			console.error('Error saving availability:', error);
			alert(error.message || 'Failed to save your availability. Please try again.');
		}
	}

	function getGroupAvailability(date: string, timeSlot: string): number {
		if (!event?.responses) return 0;
		const responsesForSlot = event.responses.filter(
			(r: Response) => r.date === date && r.time_slot === timeSlot
		);
		return (responsesForSlot.length / (event.responses.length || 1)) * 100;
	}

	function getParticipantAvailability(
		participant: Participant | null,
		date: string,
		timeSlot: string
	): boolean {
		return participant?.availability?.[date]?.[timeSlot] || false;
	}

	function viewParticipantAvailability(participant: Participant): void {
		selectedParticipant = participant;
	}
</script>

<div class="flex min-h-screen flex-col">
	<Header />

	<main class="container mx-auto max-w-6xl flex-1 px-4 py-8">
		{#if loading}
			<div class="py-8 text-center">
				<div
					class="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"
				></div>
				<p class="mt-4">Loading...</p>
			</div>
		{:else if error}
			<div class="rounded-lg bg-red-50 p-4 text-center text-red-500">{error}</div>
		{:else}
			<div class="space-y-8">
				<!-- Event Header Section -->
				<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
					<h1 class="text-3xl font-bold text-gray-800">{event?.name}</h1>
					<div class="mt-4 flex items-center gap-2 text-gray-600">
						<span>Share this event:</span>
						<a
							href={`${window.location.href}`}
							class="break-all text-blue-600 underline hover:text-blue-800"
						>
							{window.location.href}
						</a>
					</div>
				</div>

				<!-- User Input Section -->
				<div class="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
					<div class="max-w-md">
						<label for="participantName" class="mb-2 block text-sm font-medium text-gray-700">
							Your Name
						</label>
						<input
							type="text"
							id="participantName"
							bind:value={participantName}
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
							placeholder="Enter your name"
						/>
					</div>

					<div class="max-w-md">
						<label for="timezone" class="mb-2 block text-sm font-medium text-gray-700">
							Your Time Zone
						</label>
						<select
							id="timezone"
							bind:value={timezone}
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						>
							{#each timezones as tz}
								<option value={tz}>{tz}</option>
							{/each}
						</select>
					</div>
				</div>

				<!-- Availability Grids -->
				<div class="grid gap-8 lg:grid-cols-2">
					<!-- Individual's Availability -->
					<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
						<h2 class="mb-4 text-xl font-semibold">Your Availability</h2>
						<div class="mb-6 flex items-center gap-6">
							<div class="flex items-center">
								<div class="mr-2 h-4 w-4 rounded border border-gray-300 bg-gray-100"></div>
								<span class="text-sm">Unavailable</span>
							</div>
							<div class="flex items-center">
								<div class="mr-2 h-4 w-4 rounded border border-gray-300 bg-green-500"></div>
								<span class="text-sm">Available</span>
							</div>
						</div>

						<div class="overflow-x-auto">
							<div class="inline-block min-w-full align-middle">
								<div class="overflow-hidden rounded-lg border border-gray-200">
									<div
										class="grid"
										style="grid-template-columns: auto repeat({event?.dates?.length ||
											0}, minmax(80px, 1fr))"
									>
										<div class="border-b border-gray-200 bg-gray-50 p-3"></div>

										{#each event?.dates || [] as date}
											<div
												class="border-b border-l border-gray-200 bg-gray-50 p-3 text-center font-medium"
											>
												{formatDate(date)}
											</div>
										{/each}

										{#each event?.timeSlots || [] as timeSlot}
											<div class="border-b border-gray-200 p-3 text-sm text-gray-600">
												{timeSlot}
											</div>

											{#each event?.dates || [] as date}
												<button
													type="button"
													class="cursor-pointer border-b border-l border-gray-200 transition-colors duration-150 hover:bg-opacity-80"
													class:bg-green-500={availability[date]?.[timeSlot]}
													class:bg-gray-100={!availability[date]?.[timeSlot]}
													onclick={() => toggleAvailability(date, timeSlot)}
													onkeydown={(e) => {
														if (e.key === 'Enter' || e.key === ' ') {
															e.preventDefault();
															toggleAvailability(date, timeSlot);
														}
													}}
													role="gridcell"
													aria-label={`Select availability for ${date} at ${timeSlot}`}
													aria-selected={availability[date]?.[timeSlot]}
													style="height: 40px;"
												></button>
											{/each}
										{/each}
									</div>
								</div>
							</div>
						</div>
					</div>

					<!-- Group's Availability -->
					<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
						<h2 class="mb-4 text-xl font-semibold">
							Group's Availability ({event?.responses?.length || 0} responses)
						</h2>
						<div class="mb-6 flex items-center gap-6">
							<div class="flex items-center">
								<div class="mr-2 h-4 w-4 rounded border border-gray-300 bg-gray-100"></div>
								<span class="text-sm">0% Available</span>
							</div>
							<div class="flex items-center">
								<div class="mr-2 h-4 w-4 rounded border border-gray-300 bg-green-500"></div>
								<span class="text-sm">100% Available</span>
							</div>
						</div>

						<div class="overflow-x-auto">
							<div class="inline-block min-w-full align-middle">
								<div class="overflow-hidden rounded-lg border border-gray-200">
									<div
										class="grid"
										style="grid-template-columns: auto repeat({event?.dates?.length ||
											0}, minmax(80px, 1fr))"
									>
										<div class="border-b border-gray-200 bg-gray-50 p-3"></div>

										{#each event?.dates || [] as date}
											<div
												class="border-b border-l border-gray-200 bg-gray-50 p-3 text-center font-medium"
											>
												{formatDate(date)}
											</div>
										{/each}

										{#each event?.timeSlots || [] as timeSlot}
											<div class="border-b border-gray-200 p-3 text-sm text-gray-600">
												{timeSlot}
											</div>

											{#each event?.dates || [] as date}
												<div
													class="border-b border-l border-gray-200"
													style="height: 40px; background-color: rgba(34, 197, 94, {getGroupAvailability(
														date,
														timeSlot
													) / 100})"
													title={`${getGroupAvailability(date, timeSlot)}% available at ${timeSlot}`}
												/>
											{/each}
										{/each}
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Participants List Section -->
				<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
					<h2 class="mb-4 text-xl font-semibold">Participants ({participants.length})</h2>

					<div class="overflow-x-auto">
						<table class="min-w-full divide-y divide-gray-200">
							<thead class="bg-gray-50">
								<tr>
									<th
										class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
									>
										Name
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
									>
										Timezone
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
									>
										Last Updated
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
									>
										Actions
									</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-200 bg-white">
								{#each participants as participant}
									<tr>
										<td class="whitespace-nowrap px-6 py-4">
											<div class="text-sm font-medium text-gray-900">
												{participant.name}
											</div>
										</td>
										<td class="whitespace-nowrap px-6 py-4">
											<div class="text-sm text-gray-500">
												{participant.timezone || 'Unknown'}
											</div>
										</td>
										<td class="whitespace-nowrap px-6 py-4">
											<div class="text-sm text-gray-500">
												{formatDateTime(participant.lastUpdated)}
											</div>
										</td>
										<td class="whitespace-nowrap px-6 py-4">
											<button
												class="rounded bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600"
												onclick={() => viewParticipantAvailability(participant)}
											>
												View Availability
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>

				<!-- Selected Participant's Availability Modal -->
				{#if selectedParticipant}
					<div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
						<div class="w-full max-w-4xl rounded-lg bg-white p-6">
							<div class="mb-4 flex items-center justify-between">
								<h3 class="text-lg font-semibold">
									{selectedParticipant.name}'s Availability
								</h3>
								<!-- svelte-ignore a11y_consider_explicit_label -->
								<button
									class="rounded-full p-1 hover:bg-gray-100"
									onclick={() => (selectedParticipant = null)}
								>
									<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M6 18L18 6M6 6l12 12"
										/>
									</svg>
								</button>
							</div>

							<div class="overflow-x-auto">
								<div class="inline-block min-w-full align-middle">
									<div class="overflow-hidden rounded-lg border border-gray-200">
										<div
											class="grid"
											style="grid-template-columns: auto repeat({event?.dates?.length ||
												0}, minmax(80px, 1fr))"
										>
											<div class="border-b border-gray-200 bg-gray-50 p-3"></div>
											{#each event?.dates || [] as date}
												<div
													class="border-b border-l border-gray-200 bg-gray-50 p-3 text-center font-medium"
												>
													{formatDate(date)}
												</div>
											{/each}

											{#each event?.timeSlots || [] as timeSlot}
												<div class="border-b border-gray-200 p-3 text-sm text-gray-600">
													{timeSlot}
												</div>

												{#each event?.dates || [] as date}
													<div
														class="border-b border-l border-gray-200"
														class:bg-green-500={getParticipantAvailability(
															selectedParticipant,
															date,
															timeSlot
														)}
														class:bg-gray-100={!getParticipantAvailability(
															selectedParticipant,
															date,
															timeSlot
														)}
														style="height: 40px;"
													></div>
												{/each}
											{/each}
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</main>

	<Footer />
</div>
