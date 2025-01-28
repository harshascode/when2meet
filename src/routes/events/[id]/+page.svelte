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
	let nameError = $state(false);
	let mouseX = $state(0);
	let mouseY = $state(0);

	// Add a utility function to check if the device is mobile
	function isMobileDevice() {
		return /Mobi|Android/i.test(navigator.userAgent);
	}

	// Drag selection states
	let dragSelection = $state<{
		start: { date: string; timeSlot: string } | null;
		end: { date: string; timeSlot: string } | null;
	}>({ start: null, end: null });

	// Hover states
	let hoveredCell = $state<{ date: string; timeSlot: string } | null>(null);
	let hoverTimeout: any | null = $state(null);

	const timezones = Intl.supportedValuesOf('timeZone');

	function trackMousePosition(event: MouseEvent) {
		mouseX = event.clientX;
		mouseY = event.clientY;
	}

	function getParticipantsForSlot(
		date: string,
		timeSlot: string
	): { available: string[]; unavailable: string[] } {
		if (!event?.responses) return { available: [], unavailable: [] };

		const available = new Set<string>();
		const allParticipants = new Set<string>();

		event.responses.forEach((response) => {
			allParticipants.add(response.participant_name);
			if (response.date === date && response.time_slot === timeSlot) {
				available.add(response.participant_name);
			}
		});

		const unavailable = Array.from(allParticipants).filter(
			(participant) => !available.has(participant)
		);

		return {
			available: Array.from(available),
			unavailable: unavailable
		};
	}

	function handleCellHover(date: string, timeSlot: string) {
		if (hoverTimeout) {
			clearTimeout(hoverTimeout);
		}
		hoverTimeout = setTimeout(() => {
			hoveredCell = { date, timeSlot };
		}, 200);
	}

	function handleCellLeave() {
		if (hoverTimeout) {
			clearTimeout(hoverTimeout);
		}
		hoveredCell = null;
	}

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

	let initialTouchX = 0;
	let initialTouchY = 0;
	const touchMoveThreshold = 10; // Adjust this threshold as needed

	function startDrag(date: string, timeSlot: string) {
		if (!participantName) {
			nameError = true;
			const nameInput = document.getElementById('participantName');
			nameInput?.focus();
			return;
		}

		if (!isMobileDevice()) {
			isDragging = true;
			dragSelection.start = { date, timeSlot };
			dragSelection.end = { date, timeSlot };
			window.addEventListener('mouseup', globalStopDrag);
		}
	}

	function handleTouchStart(e: TouchEvent, date: string, timeSlot: string) {
		if (!participantName) {
			nameError = true;
			const nameInput = document.getElementById('participantName');
			nameInput?.focus();
			return;
		}

		const touch = e.touches[0];
		initialTouchX = touch.clientX;
		initialTouchY = touch.clientY;
	}

	function handleTouchMove(e: TouchEvent, date: string, timeSlot: string) {
		const touch = e.touches[0];
		const deltaX = Math.abs(touch.clientX - initialTouchX);
		const deltaY = Math.abs(touch.clientY - initialTouchY);

		// If movement is beyond the threshold, consider it a scroll
		if (deltaX > touchMoveThreshold || deltaY > touchMoveThreshold) {
			return;
		}

		if (!isDragging) return;
		const target = document.elementFromPoint(touch.clientX, touch.clientY);
		if (target?.closest('button')) {
			handleDrag(date, timeSlot);
		}
	}

	function handleTouchEnd(e: TouchEvent, date: string, timeSlot: string) {
		const touch = e.changedTouches[0];
		const deltaX = Math.abs(touch.clientX - initialTouchX);
		const deltaY = Math.abs(touch.clientY - initialTouchY);

		// If movement was within the threshold, treat it as a tap/click
		if (deltaX <= touchMoveThreshold && deltaY <= touchMoveThreshold) {
			const currentState = availability[date][timeSlot];
			availability[date][timeSlot] = !currentState;
			saveAvailability();
		}

		stopDrag();
	}

	function handleDrag(date: string, timeSlot: string) {
		if (!isDragging || !participantName) return;
		dragSelection.end = { date, timeSlot };
	}

	function stopDrag() {
		if (isDragging) {
			isDragging = false;

			if (dragSelection.start && dragSelection.end) {
				const dates = event?.dates || [];
				const timeSlots = event?.timeSlots || [];
				const startDateIdx = dates.indexOf(dragSelection.start.date);
				const endDateIdx = dates.indexOf(dragSelection.end.date);
				const startTimeIdx = timeSlots.indexOf(dragSelection.start.timeSlot);
				const endTimeIdx = timeSlots.indexOf(dragSelection.end.timeSlot);

				const minDateIdx = Math.min(startDateIdx, endDateIdx);
				const maxDateIdx = Math.max(startDateIdx, endDateIdx);
				const minTimeIdx = Math.min(startTimeIdx, endTimeIdx);
				const maxTimeIdx = Math.max(startTimeIdx, endTimeIdx);

				const currentState = availability[dragSelection.start.date][dragSelection.start.timeSlot];

				for (let d = minDateIdx; d <= maxDateIdx; d++) {
					for (let t = minTimeIdx; t <= maxTimeIdx; t++) {
						const date = dates[d];
						const timeSlot = timeSlots[t];
						availability[date][timeSlot] = !currentState;
					}
				}

				saveAvailability();
			}

			dragSelection.start = null;
			dragSelection.end = null;
			window.removeEventListener('mouseup', globalStopDrag);
		}
	}

	function handleCellClick(date: string, timeSlot: string) {
		const currentState = availability[date][timeSlot];
		availability[date][timeSlot] = !currentState;
		saveAvailability();
	}

	function globalStopDrag() {
		stopDrag();
	}

	function isInDragSelection(date: string, timeSlot: string): boolean {
		if (!dragSelection.start || !dragSelection.end) return false;

		const dates = event?.dates || [];
		const timeSlots = event?.timeSlots || [];

		const startDateIdx = dates.indexOf(dragSelection.start.date);
		const endDateIdx = dates.indexOf(dragSelection.end.date);
		const startTimeIdx = timeSlots.indexOf(dragSelection.start.timeSlot);
		const endTimeIdx = timeSlots.indexOf(dragSelection.end.timeSlot);

		const currentDateIdx = dates.indexOf(date);
		const currentTimeIdx = timeSlots.indexOf(timeSlot);

		return (
			currentDateIdx >= Math.min(startDateIdx, endDateIdx) &&
			currentDateIdx <= Math.max(startDateIdx, endDateIdx) &&
			currentTimeIdx >= Math.min(startTimeIdx, endTimeIdx) &&
			currentTimeIdx <= Math.max(startTimeIdx, endTimeIdx)
		);
	}

	async function saveAvailability() {
		if (!participantName) {
			nameError = true;
			return;
		}

		try {
			const response = await fetch(`/api/events/${eventId}/responses`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ participantName, availability, timezone })
			});

			if (!response.ok) throw new Error('Failed to save availability');

			// Show success message
			const successMessage = document.createElement('div');
			successMessage.className =
				'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow';
			successMessage.textContent = 'Availability saved successfully!';
			document.body.appendChild(successMessage);
			setTimeout(() => successMessage.remove(), 3000);

			// Refresh data
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

		const uniqueParticipants = new Set(event.responses.map((r) => r.participant_name));
		const responsesForSlot = event.responses.filter(
			(r: Response) => r.date === date && r.time_slot === timeSlot
		);

		return (responsesForSlot.length / (uniqueParticipants.size || 1)) * 100;
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

<div
	class="flex min-h-screen flex-col bg-white"
	onmousemove={trackMousePosition}
	role="presentation"
>
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

				<div class="">
					<!-- Left Sidebar -->
					<div class="space-y-8 lg:col-span-1">
						<!-- User Info -->
						<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
							<h2 class="mb-4 text-lg font-semibold text-gray-900">Your Information</h2>
							<div class="space-y-4">
								<div>
									<label for="participantName" class="mb-1 block text-sm font-medium text-gray-700">
										Name
										{#if nameError}
											<span class="text-red-500">*</span>
										{/if}
									</label>
									<input
										type="text"
										id="participantName"
										bind:value={participantName}
										class="w-full rounded border px-3 py-2 text-sm shadow-sm transition-colors"
										class:border-red-500={nameError}
										class:border-gray-300={!nameError}
										class:focus:ring-red-500={nameError}
										class:focus:ring-blue-500={!nameError}
										class:focus:border-red-500={nameError}
										class:focus:border-blue-500={!nameError}
										placeholder="Your name"
										oninput={() => (nameError = false)}
									/>
									{#if nameError}
										<p class="mt-1 text-sm text-red-600">
											Please enter your name before selecting availability
										</p>
									{/if}
								</div>
								<div>
									<!-- svelte-ignore a11y_label_has_associated_control -->
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
											onclick={() => viewParticipantAvailability(participant)}
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
													<!-- svelte-ignore a11y_mouse_events_have_key_events -->
													<button
														type="button"
														class="relative h-12 border-b border-r border-gray-200 transition-colors duration-75 focus:outline-none"
														class:bg-green-500={availability[date]?.[timeSlot]}
														class:bg-gray-100={!availability[date]?.[timeSlot]}
														class:cursor-pointer={participantName}
														class:cursor-not-allowed={!participantName}
														class:hover:bg-opacity-90={participantName}
														onmousedown={() => startDrag(date, timeSlot)}
														onmouseover={() => handleCellHover(date, timeSlot)}
														onmouseout={handleCellLeave}
														onmouseenter={() => handleDrag(date, timeSlot)}
														onmouseup={stopDrag}
														ontouchstart={(e) => handleTouchStart(e, date, timeSlot)}
														ontouchmove={(e) => handleTouchMove(e, date, timeSlot)}
														ontouchend={(e) => handleTouchEnd(e, date, timeSlot)}
													>
														<div class="pointer-events-none h-full w-full">
															{#if isInDragSelection(date, timeSlot)}
																<div class="absolute inset-0 bg-blue-200 opacity-50"></div>
															{/if}
														</div>
													</button>
												{/each}
											{/each}
										</div>
									</div>
								</div>
							</div>
						</div>

						<!-- Group Availability -->
						<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
							<div class="mb-6 flex items-center justify-between">
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
											class="grid bg-white"
											style="grid-template-columns: 120px repeat({event?.dates?.length ||
												0}, minmax(60px, 1fr))"
										>
											<div class="sticky left-0 z-10 border-r border-gray-200 bg-gray-50 p-2"></div>
											{#each event?.dates || [] as date}
												<div
													class="border-b border-r border-gray-200 bg-gray-50 p-2 text-center text-sm font-medium text-gray-700"
												>
													{formatDate(date)}
												</div>
											{/each}
											{#each event?.timeSlots || [] as timeSlot}
												<div
													class="sticky left-0 z-10 border-b border-r border-gray-200 bg-white p-2 text-sm text-gray-600"
												>
													{timeSlot}
												</div>
												{#each event?.dates || [] as date}
													<div
														class="h-12 border-b border-r border-gray-200"
														style="background-color: rgba(34, 197, 94, {getGroupAvailability(
															date,
															timeSlot
														) / 100})"
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

		<!-- Hover Tooltip -->
		{#if hoveredCell}
			{@const participants = getParticipantsForSlot(hoveredCell.date, hoveredCell.timeSlot)}
			<div
				class="z-50 min-w-[300px] rounded-lg border border-gray-200 bg-white p-4 shadow-lg md:fixed"
				style="top: {mouseY + 10}px; left: {mouseX + 10}px"
			>
				<h4 class="mb-3 text-sm font-semibold text-gray-900">
					{formatDate(hoveredCell.date)} at {hoveredCell.timeSlot}
				</h4>

				<div class="space-y-3">
					<div>
						<h5 class="mb-1 text-xs font-medium text-green-600">
							Available ({participants.available.length})
						</h5>
						{#if participants.available.length > 0}
							<div class="space-y-1">
								{#each participants.available as participant}
									<div class="flex items-center gap-2 text-sm text-gray-700">
										<div class="h-2 w-2 rounded-full bg-green-500"></div>
										<span>{participant}</span>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-sm text-gray-500">No participants available</p>
						{/if}
					</div>

					<div>
						<h5 class="mb-1 text-xs font-medium text-red-600">
							Unavailable ({participants.unavailable.length})
						</h5>
						{#if participants.unavailable.length > 0}
							<div class="space-y-1">
								{#each participants.unavailable as participant}
									<div class="flex items-center gap-2 text-sm text-gray-700">
										<div class="h-2 w-2 rounded-full bg-red-500"></div>
										<span>{participant}</span>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-sm text-gray-500">All participants available</p>
						{/if}
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
						<!-- svelte-ignore a11y_consider_explicit_label -->
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
									class="grid bg-white"
									style="grid-template-columns: 120px repeat({event?.dates?.length ||
										0}, minmax(60px, 1fr))"
								>
									<div class="sticky left-0 z-10 border-r border-gray-200 bg-gray-50 p-2"></div>
									{#each event?.dates || [] as date}
										<div
											class="border-b border-r border-gray-200 bg-gray-50 p-2 text-center text-sm font-medium text-gray-700"
										>
											{formatDate(date)}
										</div>
									{/each}

									{#each event?.timeSlots || [] as timeSlot}
										<div
											class="sticky left-0 z-10 border-b border-r border-gray-200 bg-white p-2 text-sm text-gray-600"
										>
											{timeSlot}
										</div>
										{#each event?.dates || [] as date}
											<div
												class="h-12 border-b border-r border-gray-200 transition-colors"
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

<style>
	.relative {
		position: relative;
	}
	.absolute {
		position: absolute;
	}
	.inset-0 {
		top: 0;
		right: 0;
		bottom: 0;
		left: 0;
	}
	.opacity-50 {
		opacity: 0.5;
	}
	.pointer-events-none {
		pointer-events: none;
	}
	.bg-blue-200 {
		background-color: #bfdbfe;
	}
	.fixed {
		position: fixed;
	}
	.z-50 {
		z-index: 50;
	}
	.shadow-lg {
		box-shadow:
			0 10px 15px -3px rgb(0 0 0 / 0.1),
			0 4px 6px -4px rgb(0 0 0 / 0.1);
	}
	.rounded-lg {
		border-radius: 0.5rem;
	}
	.min-w-\[300px\] {
		min-width: 300px;
	}
</style>
