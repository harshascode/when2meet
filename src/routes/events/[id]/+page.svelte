<script lang="ts">
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
	let isDragging = $state(false);
	let startCell = $state<{ date: string; timeSlot: string } | null>(null);
	let currentCell = $state<{ date: string; timeSlot: string } | null>(null);

	const timezones = Intl.supportedValuesOf('timeZone');

	onMount(async () => {
		try {
			const response = await fetch(`/api/events/${eventId}`);
			if (!response.ok) throw new Error('Event not found');
			event = (await response.json()) as Event;

			event.dates.forEach((date: string) => {
				availability[date] = {};
				event!.timeSlots.forEach((timeSlot: string) => {
					availability[date][timeSlot] = false;
				});
			});

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

	function startDrag(date: string, timeSlot: string) {
		isDragging = true;
		startCell = { date, timeSlot };
		currentCell = { date, timeSlot };
		toggleAvailability(date, timeSlot);
	}

	function handleDrag(date: string, timeSlot: string) {
		if (isDragging && (currentCell?.date !== date || currentCell?.timeSlot !== timeSlot)) {
			currentCell = { date, timeSlot };
			toggleAvailability(date, timeSlot);
		}
	}

	function stopDrag() {
		isDragging = false;
		startCell = null;
		currentCell = null;
	}

	function toggleAvailability(date: string, timeSlot: string) {
		if (!isDragging && startCell) return;
		const dates = event?.dates || [];
		const timeSlots = event?.timeSlots || [];
		const startDateIndex = dates.indexOf(startCell?.date || date);
		const endDateIndex = dates.indexOf(date);
		const startTimeIndex = timeSlots.indexOf(startCell?.timeSlot || timeSlot);
		const endTimeIndex = timeSlots.indexOf(timeSlot);
		const minDateIndex = Math.min(startDateIndex, endDateIndex);
		const maxDateIndex = Math.max(startDateIndex, endDateIndex);
		const minTimeIndex = Math.min(startTimeIndex, endTimeIndex);
		const maxTimeIndex = Math.max(startTimeIndex, endTimeIndex);
		const currentState = availability[date]?.[timeSlot] || false;

		for (let d = minDateIndex; d <= maxDateIndex; d++) {
			for (let t = minTimeIndex; t <= maxTimeIndex; t++) {
				const currentDate = dates[d];
				const currentTime = timeSlots[t];
				availability[currentDate][currentTime] = !currentState;
			}
		}
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
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ participantName, availability, timezone })
			});
			if (!response.ok) throw new Error('Failed to save availability');

			const successMessage = document.createElement('div');
			successMessage.className =
				'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow';
			successMessage.textContent = 'Availability saved successfully!';
			document.body.appendChild(successMessage);
			setTimeout(() => successMessage.remove(), 3000);

			const eventResponse = await fetch(`/api/events/${eventId}`);
			if (eventResponse.ok) {
				event = (await eventResponse.json()) as Event;
				updateParticipants();
			}
		} catch (error: any) {
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
				<!-- Event Header -->
				<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
					<h1 class="text-2xl font-semibold text-gray-900">{event?.name}</h1>
					<div class="mt-3 flex items-center gap-2 text-sm">
						<span class="text-gray-500">Share link:</span>
						<a
							href={`${window.location.href}`}
							class="font-medium text-blue-600 hover:text-blue-700"
						>
							{window.location.host}{window.location.pathname}
						</a>
					</div>
				</div>

				<div class="grid gap-8 lg:grid-cols-3">
					<!-- Left Sidebar -->
					<div class="space-y-8 lg:col-span-1">
						<!-- User Info -->
						<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
							<h2 class="mb-4 text-lg font-semibold text-gray-900">Your Information</h2>
							<div class="space-y-4">
								<div>
									<label class="mb-1 block text-sm font-medium text-gray-700">Name</label>
									<input
										type="text"
										bind:value={participantName}
										class="w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
										placeholder="Your name"
									/>
								</div>
								<div>
									<label class="mb-1 block text-sm font-medium text-gray-700">Time Zone</label>
									<select
										bind:value={timezone}
										class="w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
									>
										{#each timezones as tz}
											<option value={tz}>{tz.replace(/_/g, ' ')}</option>
										{/each}
									</select>
								</div>
							</div>
						</div>

						<!-- Participants -->
						<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
							<h2 class="mb-4 text-lg font-semibold text-gray-900">
								Participants ({participants.length})
							</h2>
							<div class="divide-y divide-gray-200">
								{#each participants as participant}
									<div class="flex items-center justify-between py-3">
										<div>
											<p class="text-sm font-medium text-gray-900">{participant.name}</p>
											<p class="mt-0.5 text-xs text-gray-500">{participant.timezone}</p>
										</div>
										<button
											class="rounded px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
											on:click={() => viewParticipantAvailability(participant)}
										>
											View
										</button>
									</div>
								{/each}
							</div>
						</div>
					</div>

					<!-- Grids -->
					<div class="space-y-8 lg:col-span-2">
						<!-- Individual Availability -->
						<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
							<div class="mb-6 flex items-center justify-between">
								<h2 class="text-lg font-semibold text-gray-900">Your Availability</h2>
								<div class="flex gap-4">
									<div class="flex items-center gap-2">
										<div class="h-4 w-4 rounded-sm border border-gray-300 bg-gray-200"></div>
										<span class="text-sm text-gray-600">No</span>
									</div>
									<div class="flex items-center gap-2">
										<div class="h-4 w-4 rounded-sm border border-green-600 bg-green-500"></div>
										<span class="text-sm text-gray-600">Yes</span>
									</div>
								</div>
							</div>

							<div class="overflow-x-auto pb-2">
								<div class="inline-block min-w-full align-middle">
									<div class="overflow-hidden rounded-lg border border-gray-200">
										<div
											class="grid bg-white"
											style="grid-template-columns: 120px repeat({event?.dates?.length ||
												0}, minmax(60px, 1fr))"
										>
											<!-- Column Headers -->
											<div class="sticky left-0 z-10 border-r border-gray-200 bg-gray-50 p-2"></div>
											{#each event?.dates || [] as date}
												<div
													class="border-b border-r border-gray-200 bg-gray-50 p-2 text-center text-sm font-medium text-gray-700"
												>
													{formatDate(date)}
												</div>
											{/each}

											<!-- Grid Cells -->
											{#each event?.timeSlots || [] as timeSlot}
												<div
													class="sticky left-0 z-10 border-b border-r border-gray-200 bg-white p-2 text-sm text-gray-600"
												>
													{timeSlot}
												</div>
												{#each event?.dates || [] as date}
													<button
														type="button"
														class="h-12 border-b border-r border-gray-200 transition-colors duration-75 hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
														class:bg-green-500={availability[date]?.[timeSlot]}
														class:bg-gray-100={!availability[date]?.[timeSlot]}
														on:mousedown={() => startDrag(date, timeSlot)}
														on:mouseover={() => handleDrag(date, timeSlot)}
														on:mouseup={stopDrag}
													>
														<div class="pointer-events-none h-full w-full" />
													</button>
												{/each}
											{/each}
										</div>
									</div>
								</div>
							</div>
						</div>

						<!-- Group Availability (Similar structure with color gradient) -->
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
							on:click={() => (selectedParticipant = null)}
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
					<!-- Modal Grid (Similar to main grid) -->
				</div>
			</div>
		{/if}
	</main>

	<Footer />
</div>

<style>
	.selection-handle {
		position: absolute;
		width: 8px;
		height: 8px;
		background: #3b82f6;
		bottom: -2px;
		right: -2px;
		cursor: crosshair;
	}
</style>
