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
		timezone: string;
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

			// Process participants data
			if (event.responses) {
				const participantMap = new Map<string, Participant>();

				event.responses.forEach((response: Response) => {
					if (!participantMap.has(response.participant_name)) {
						participantMap.set(response.participant_name, {
							name: response.participant_name,
							timezone: response.timezone,
							availability: {},
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
					timezone // Added timezone to the request
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
				updateParticipants();
			}
		} catch (error: any) {
			console.error('Error saving availability:', error);
			alert(error.message || 'Failed to save your availability. Please try again.');
		}
	}

	function updateParticipants() {
		if (!event?.responses) return;

		const participantMap = new Map<string, Participant>();
		event.responses.forEach((response: Response) => {
			if (!participantMap.has(response.participant_name)) {
				participantMap.set(response.participant_name, {
					name: response.participant_name,
					timezone: response.timezone,
					availability: {},
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

<div class="flex min-h-screen flex-col bg-white">
	<Header />

	<main class="container mx-auto max-w-7xl flex-1 px-4 py-8">
		{#if loading}
			<div class="py-12 text-center">
				<div
					class="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"
				></div>
				<p class="mt-4 text-sm text-gray-600">Loading event details...</p>
			</div>
		{:else if error}
			<div class="rounded-lg bg-red-50 p-4 text-center text-sm text-red-600">{error}</div>
		{:else}
			<div class="space-y-8">
				<!-- Event Header Section -->
				<div class="shadow-xs rounded-lg border border-gray-200 bg-white p-6">
					<h1 class="text-2xl font-bold text-gray-900">{event?.name}</h1>
					<div class="mt-3 flex items-center gap-2 text-sm text-gray-500">
						<span>Share link:</span>
						<a
							href={`${window.location.href}`}
							class="font-medium text-blue-600 hover:text-blue-700"
						>
							{window.location.href}
						</a>
					</div>
				</div>

				<div class="grid gap-8 lg:grid-cols-3">
					<!-- User Input Section -->
					<div class="lg:col-span-1">
						<div class="shadow-xs rounded-lg border border-gray-200 bg-white p-6">
							<h2 class="mb-5 text-lg font-semibold text-gray-900">Your Information</h2>
							<div class="space-y-5">
								<div>
									<label for="participantName" class="mb-2 block text-sm font-medium text-gray-700">
										Name
									</label>
									<input
										type="text"
										id="participantName"
										bind:value={participantName}
										class="w-full rounded-md border border-gray-300 bg-white px-3 py-2
											text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500"
										placeholder="Your name"
									/>
								</div>

								<div>
									<label for="timezone" class="mb-2 block text-sm font-medium text-gray-700">
										Time Zone
									</label>
									<select
										id="timezone"
										bind:value={timezone}
										class="w-full rounded-md border border-gray-300 bg-white px-3 py-2
											text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500"
									>
										{#each timezones as tz}
											<option value={tz}>{tz.replace(/_/g, ' ')}</option>
										{/each}
									</select>
								</div>
							</div>
						</div>

						<!-- Participants List -->
						<div class="shadow-xs mt-8 rounded-lg border border-gray-200 bg-white p-6">
							<h2 class="mb-4 text-lg font-semibold text-gray-900">
								Participants ({participants.length})
							</h2>
							<div class="divide-y divide-gray-200">
								{#each participants as participant}
									<div class="py-3">
										<div class="flex items-center justify-between">
											<div>
												<p class="text-sm font-medium text-gray-900">{participant.name}</p>
												<p class="mt-1 text-xs text-gray-500">{participant.timezone}</p>
												<p class="mt-1 text-xs text-gray-400">
													Last updated: {formatDateTime(participant.lastUpdated)}
												</p>
											</div>
											<button
												class="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium
													text-gray-700 transition-colors hover:bg-gray-200"
												onclick={() => viewParticipantAvailability(participant)}
											>
												View
											</button>
										</div>
									</div>
								{/each}
							</div>
						</div>
					</div>

					<!-- Availability Grids Section -->
					<div class="space-y-8 lg:col-span-2">
						<!-- Individual Availability -->
						<div class="shadow-xs rounded-lg border border-gray-200 bg-white p-6">
							<div class="mb-5 flex items-center justify-between">
								<h2 class="text-lg font-semibold text-gray-900">Your Availability</h2>
								<div class="flex gap-4">
									<div class="flex items-center gap-2">
										<div class="h-3 w-3 rounded-sm bg-gray-200"></div>
										<span class="text-xs text-gray-600">Unavailable</span>
									</div>
									<div class="flex items-center gap-2">
										<div class="h-3 w-3 rounded-sm bg-green-500"></div>
										<span class="text-xs text-gray-600">Available</span>
									</div>
								</div>
							</div>

							<div class="overflow-x-auto pb-2">
								<div class="inline-block min-w-full align-middle">
									<div class="overflow-hidden rounded-lg border border-gray-200">
										<div
											class="grid"
											style="grid-template-columns: auto repeat({event?.dates?.length ||
												0}, minmax(60px, 1fr))"
										>
											<div class="border-b border-gray-200 bg-gray-50 p-2"></div>
											{#each event?.dates || [] as date}
												<div
													class="border-b border-l border-gray-200 bg-gray-50 p-2 text-center
														text-xs font-medium text-gray-700"
												>
													{formatDate(date)}
												</div>
											{/each}

											{#each event?.timeSlots || [] as timeSlot}
												<div class="border-b border-gray-200 p-2 text-xs text-gray-600">
													{timeSlot}
												</div>

												{#each event?.dates || [] as date}
													<button
														type="button"
														class="h-8 border-b border-l border-gray-200 transition-colors
															duration-100 hover:opacity-90"
														class:bg-green-500={availability[date]?.[timeSlot]}
														class:bg-gray-100={!availability[date]?.[timeSlot]}
														onclick={() => toggleAvailability(date, timeSlot)}
													></button>
												{/each}
											{/each}
										</div>
									</div>
								</div>
							</div>
						</div>

						<!-- Group Availability -->
						<div class="shadow-xs rounded-lg border border-gray-200 bg-white p-6">
							<div class="mb-5 flex items-center justify-between">
								<h2 class="text-lg font-semibold text-gray-900">
									Group Availability ({event?.responses?.length || 0})
								</h2>
								<div class="flex items-center gap-2">
									<span class="text-xs text-gray-500">0%</span>
									<div
										class="h-3 w-24 rounded-full bg-gradient-to-r from-gray-100 to-green-500"
									></div>
									<span class="text-xs text-gray-500">100%</span>
								</div>
							</div>

							<div class="overflow-x-auto pb-2">
								<div class="inline-block min-w-full align-middle">
									<div class="overflow-hidden rounded-lg border border-gray-200">
										<div
											class="grid"
											style="grid-template-columns: auto repeat({event?.dates?.length ||
												0}, minmax(60px, 1fr))"
										>
											<div class="border-b border-gray-200 bg-gray-50 p-2"></div>
											{#each event?.dates || [] as date}
												<div
													class="border-b border-l border-gray-200 bg-gray-50 p-2 text-center
														text-xs font-medium text-gray-700"
												>
													{formatDate(date)}
												</div>
											{/each}

											{#each event?.timeSlots || [] as timeSlot}
												<div class="border-b border-gray-200 p-2 text-xs text-gray-600">
													{timeSlot}
												</div>

												{#each event?.dates || [] as date}
													<div
														class="h-8 border-b border-l border-gray-200"
														style="background-color: rgba(34, 197, 94, {getGroupAvailability(
															date,
															timeSlot
														) / 100})"
														title={`${getGroupAvailability(date, timeSlot)}% available`}
													></div>
												{/each}
											{/each}
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Participant Modal -->
		{#if selectedParticipant}
			<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
				<div class="w-full max-w-4xl rounded-xl bg-white p-8 shadow-2xl">
					<div class="mb-6 flex items-center justify-between">
						<h3 class="text-xl font-bold text-gray-900">
							{selectedParticipant.name}'s Availability
						</h3>
						<button
							class="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
							onclick={() => (selectedParticipant = null)}
						>
							<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</button>
					</div>

					<div class="overflow-x-auto pb-2">
						<div class="inline-block min-w-full align-middle">
							<div class="overflow-hidden rounded-lg border border-gray-200">
								<div
									class="grid"
									style="grid-template-columns: auto repeat({event?.dates?.length ||
										0}, minmax(60px, 1fr))"
								>
									<div class="border-b border-gray-200 bg-gray-50 p-2"></div>
									{#each event?.dates || [] as date}
										<div
											class="border-b border-l border-gray-200 bg-gray-50 p-2 text-center
												text-xs font-medium text-gray-700"
										>
											{formatDate(date)}
										</div>
									{/each}

									{#each event?.timeSlots || [] as timeSlot}
										<div class="border-b border-gray-200 p-2 text-xs text-gray-600">
											{timeSlot}
										</div>

										{#each event?.dates || [] as date}
											<div
												class="h-8 border-b border-l border-gray-200
													class:bg-green-500={getParticipantAvailability(
													selectedParticipant,
													date,
													timeSlot
												)}class:bg-gray-100={!getParticipantAvailability(
													selectedParticipant,
													date,
													timeSlot
												)}"
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
	</main>

	<Footer />
</div>
