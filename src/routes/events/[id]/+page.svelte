<script lang="ts">
	// ========== Type Definitions ==========
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
		hasPassword?: string;
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

	interface AuthResponse {
		success: boolean;
		token?: string;
		message: string;
		error?: string;
	}

	// ========== Imports ==========
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { format } from 'date-fns';
	import Footer from '$lib/Footer.svelte';
	import Header from '$lib/Header.svelte';
	import { browser } from '$app/environment';

	// ========== State Management ==========
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

	// Auth related state
	let token = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let showPasswordFields = $state(true);
	let passwordError = $state('');
	let isEditing = $state(false);
	let loginError = $state('');
	let isLoggedIn = $state(false);
	let loginPassword = $state('');
	let isNewUser = $state(false);

	let dragSelection = $state<{
		start: { date: string; timeSlot: string } | null;
		end: { date: string; timeSlot: string } | null;
	}>({ start: null, end: null });

	let hoveredCell = $state<{ date: string; timeSlot: string } | null>(null);
	let hoverTimeout: ReturnType<typeof setTimeout> | null = $state(null);

	let isDragStarted = $state(false);

	// ========== Constants ==========
	const timezones = Intl.supportedValuesOf('timeZone');
	const initialTouchX = 0;
	const initialTouchY = 0;
	const touchMoveThreshold = 10;

	// ========== Authentication Functions ==========
	async function handleSignIn() {
		nameError = false;
		loginError = '';

		if (!participantName) {
			nameError = true;
			return;
		}

		try {
			const response = await fetch(`/api/events/${eventId}/responses`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					action: 'login',
					participantName,
					loginPassword,
					password: isNewUser ? password : undefined
				})
			});

			const data: AuthResponse = await response.json();

			if (response.ok && data.token) {
				token = data.token;
				if (browser) {
					localStorage.setItem('authToken', token);
				}
				isLoggedIn = true;
				loginError = '';
				await refreshEventData();
			} else {
				loginError = data.error || 'Error signing in';
				isLoggedIn = false;
			}
		} catch (error) {
			console.error('Error signing in:', error);
			loginError = 'Error signing in';
			isLoggedIn = false;
		}
	}

	function handleSignOut() {
		isLoggedIn = false;
		participantName = '';
		password = '';
		confirmPassword = '';
		loginPassword = '';
		showPasswordFields = true;
		availability = {};
		token = '';
		if (browser) {
			localStorage.removeItem('authToken');
		}
		initializeAvailability();
	}

	async function verifyToken() {
		if (!token) return false;

		try {
			const response = await fetch(`/api/events/${eventId}/verify`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				handleSignOut();
				return false;
			}

			return true;
		} catch (error) {
			handleSignOut();
			return false;
		}
	}

	// ========== Event Handlers ==========
	async function handleCellClick(date: string, timeSlot: string) {
		if (!isLoggedIn) {
			alert('Please sign in to select availability.');
			return;
		}

		// Only handle click if we haven't started dragging
		if (!isDragStarted) {
			const currentState = availability[date]?.[timeSlot] || false;
			availability[date] = availability[date] || {};
			availability[date][timeSlot] = !currentState;
			await saveAvailability();
		}
	}

	function handleDrag(date: string, timeSlot: string) {
		if (!isLoggedIn || !isDragging || !participantName) return;
		
		// Set isDragStarted to true if the drag position changes from the start position
		if (dragSelection.start && (dragSelection.start.date !== date || dragSelection.start.timeSlot !== timeSlot)) {
			isDragStarted = true;
		}
		
		dragSelection.end = { date, timeSlot };
	}

	function stopDrag() {
		if (isDragging) {
			isDragging = false;
			if (isDragStarted) {
				updateDragSelection();
			}
			isDragStarted = false;
			window.removeEventListener('mouseup', globalStopDrag);
		}
	}

	function updateDragSelection() {
		if (!dragSelection.start || !dragSelection.end || !event) return;

		const dates = event.dates;
		const timeSlots = event.timeSlots;
		const startDateIdx = dates.indexOf(dragSelection.start.date);
		const endDateIdx = dates.indexOf(dragSelection.end.date);
		const startTimeIdx = timeSlots.indexOf(dragSelection.start.timeSlot);
		const endTimeIdx = timeSlots.indexOf(dragSelection.end.timeSlot);

		const [minDateIdx, maxDateIdx] = [
			Math.min(startDateIdx, endDateIdx),
			Math.max(startDateIdx, endDateIdx)
		];
		const [minTimeIdx, maxTimeIdx] = [
			Math.min(startTimeIdx, endTimeIdx),
			Math.max(startTimeIdx, endTimeIdx)
		];

		const currentState =
			availability[dragSelection.start.date]?.[dragSelection.start.timeSlot] || false;

		for (let d = minDateIdx; d <= maxDateIdx; d++) {
			for (let t = minTimeIdx; t <= maxTimeIdx; t++) {
				const date = dates[d];
				const timeSlot = timeSlots[t];
				availability[date] = availability[date] || {};
				availability[date][timeSlot] = !currentState;
			}
		}

		saveAvailability();
		dragSelection.start = null;
		dragSelection.end = null;
	}

	function globalStopDrag() {
		stopDrag();
	}

	function startDrag(date: string, timeSlot: string) {
		if (!isLoggedIn) return;

		if (!participantName) {
			nameError = true;
			const nameInput = document.getElementById('participantName');
			nameInput?.focus();
			return;
		}

		if (!isMobileDevice()) {
			isDragStarted = false;
			isDragging = true;
			dragSelection.start = { date, timeSlot };
			dragSelection.end = { date, timeSlot };
			window.addEventListener('mouseup', globalStopDrag);
		}
	}

	async function handleNameInput() {
		nameError = false;
		showPasswordFields = true;
		if (!participantName) return;

		const existingParticipant = participants.find((p) => p.name === participantName);
		if (existingParticipant) {
			isNewUser = false;
			isEditing = true;
			passwordError = '';
		} else {
			isNewUser = true;
			isEditing = false;
			password = '';
			confirmPassword = '';
		}
	}

	function viewParticipantAvailability(participant: Participant): void {
		selectedParticipant = participant;
	}

	// ========== Utility Functions ==========
	function trackMousePosition(event: MouseEvent) {
		mouseX = event.clientX;
		mouseY = event.clientY;
	}

	function isMobileDevice(): boolean {
		return browser ? /Mobi|Android/i.test(navigator.userAgent) : false;
	}

	function formatDate(dateStr: string): string {
		return format(new Date(dateStr), 'MMM d\nEEE');
	}

	function formatDateTime(dateStr: string): string {
		return new Date(dateStr).toLocaleString();
	}

	function isInDragSelection(date: string, timeSlot: string): boolean {
		if (!dragSelection.start || !dragSelection.end || !event) return false;

		const dates = event.dates;
		const timeSlots = event.timeSlots;
		const currentDateIdx = dates.indexOf(date);
		const currentTimeIdx = timeSlots.indexOf(timeSlot);

		const startDateIdx = dates.indexOf(dragSelection.start.date);
		const endDateIdx = dates.indexOf(dragSelection.end.date);
		const startTimeIdx = timeSlots.indexOf(dragSelection.start.timeSlot);
		const endTimeIdx = timeSlots.indexOf(dragSelection.end.timeSlot);

		return (
			currentDateIdx >= Math.min(startDateIdx, endDateIdx) &&
			currentDateIdx <= Math.max(startDateIdx, endDateIdx) &&
			currentTimeIdx >= Math.min(startTimeIdx, endTimeIdx) &&
			currentTimeIdx <= Math.max(startTimeIdx, endTimeIdx)
		);
	}

	function getGroupAvailability(date: string, timeSlot: string): number {
		if (!event?.responses) return 0;

		const uniqueParticipants = new Set(event.responses.map((r) => r.participant_name));
		const responsesForSlot = event.responses.filter(
			(r) => r.date === date && r.time_slot === timeSlot
		);

		return (responsesForSlot.length / (uniqueParticipants.size || 1)) * 100;
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
			unavailable
		};
	}

	function getParticipantAvailability(
		participant: Participant | null,
		date: string,
		timeSlot: string
	): boolean {
		return participant?.availability?.[date]?.[timeSlot] || false;
	}

	function handleCellHover(date: string, timeSlot: string) {
		if (hoverTimeout) clearTimeout(hoverTimeout);
		hoverTimeout = setTimeout(() => (hoveredCell = { date, timeSlot }), 200);
	}

	function handleCellLeave() {
		if (hoverTimeout) clearTimeout(hoverTimeout);
		hoverTimeout = null;
		hoveredCell = null;
	}

	// ========== API Interactions ==========
	async function saveAvailability() {
		if (!isLoggedIn || !token) {
			alert('Please sign in to save availability.');
			return;
		}

		if (!participantName) {
			nameError = true;
			return;
		}

		try {
			const response = await fetch(`/api/events/${eventId}/responses`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({
					participantName,
					availability,
					timezone
				})
			});

			if (!response.ok) {
				if (response.status === 401) {
					handleSignOut();
					alert('Session expired. Please sign in again.');
					return;
				}
				throw new Error('Failed to save availability');
			}

			showSuccessFeedback();
			await refreshEventData();
		} catch (error) {
			handleSaveError(error);
		}
	}

	async function refreshEventData() {
		try {
			const response = await fetch(`/api/events/${eventId}`);
			if (!response.ok) throw new Error('Event not found');

			event = (await response.json()) as Event;
			updateParticipants();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load event';
		}
	}

	function updateParticipants() {
		if (!event?.responses) return;

		const participantMap = new Map<string, Participant>();
		event.responses.forEach((response) => {
			const existingParticipant = participantMap.get(response.participant_name);

			const participant: Participant = existingParticipant ?? {
				name: response.participant_name,
				timezone: response.timezone,
				availability: {},
				lastUpdated: response.created_at
			};

			participant.availability[response.date] = participant.availability[response.date] || {};
			participant.availability[response.date][response.time_slot] = true;
			participantMap.set(response.participant_name, participant);
		});

		participants = Array.from(participantMap.values()).sort(
			(a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
		);
	}

	// ========== Error Handling ==========
	function handleSaveError(error: unknown) {
		const message = error instanceof Error ? error.message : 'Failed to save your availability';
		alert(message);
	}

	function showSuccessFeedback() {
		const successMessage = document.createElement('div');
		successMessage.className =
			'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow';
		successMessage.textContent = 'Availability saved successfully!';
		document.body.appendChild(successMessage);
		setTimeout(() => successMessage.remove(), 3000);
	}

	function initializeAvailability() {
		event?.dates.forEach((date) => {
			availability[date] = {};
			event?.timeSlots.forEach((timeSlot) => {
				availability[date][timeSlot] = false;
			});
		});
	}

	// ========== Lifecycle Hooks ==========
	onMount(async () => {
		if (browser) {
			token = localStorage.getItem('authToken') || '';
			isLoggedIn = !!token;
		}

		if (token) {
			const isValid = await verifyToken();
			if (!isValid) {
				handleSignOut();
			}
		}

		try {
			const response = await fetch(`/api/events/${eventId}`);
			if (!response.ok) throw new Error('Event not found');

			event = (await response.json()) as Event;
			initializeAvailability();
			updateParticipants();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load event';
		} finally {
			loading = false;
		}
	});
</script>

<div
	class="flex min-h-screen flex-col bg-white"
	onmousemove={trackMousePosition}
	role="presentation"
>
	<Header />

	<main class="container mx-auto max-w-7xl flex-1 px-4 py-6">
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
				<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
					<h1 class="text-2xl font-semibold text-gray-900">{event?.name}</h1>
					<div class="mt-3 flex flex-wrap items-center gap-2 text-sm">
						<span class="text-gray-500">Share link:</span>
						<a href={window.location.href} class="font-medium text-blue-600 hover:text-blue-700">
							{window.location.host}{window.location.pathname}
						</a>
					</div>
				</div>

				<div>
					<div class="flex flex-col gap-8 lg:flex-row">
						<div class="w-full space-y-8 lg:w-1/4">
							<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
								<h2 class="mb-4 text-lg font-semibold text-gray-900">
									{isLoggedIn ? 'Your Information' : 'Sign In'}
								</h2>

								{#if !isLoggedIn}
									<div class="space-y-4">
										<div>
											<label
												for="participantName"
												class="mb-1 block text-sm font-medium text-gray-700"
											>
												Name {#if nameError}<span class="text-red-500">*</span>{/if}
											</label>
											<input
												type="text"
												id="participantName"
												bind:value={participantName}
												class="w-full rounded border px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
												class:border-red-500={nameError}
												class:border-gray-300={!nameError}
												placeholder="Your name"
												oninput={() => {
													nameError = false;
													handleNameInput();
												}}
											/>
											{#if nameError}
												<p class="mt-1 text-sm text-red-600">Please enter your name.</p>
											{/if}
										</div>

										{#if showPasswordFields}
											<div class="space-y-3">
												{#if !isNewUser}
													<div>
														<label
															for="loginPassword"
															class="mb-1 block text-sm font-medium text-gray-700"
														>
															Password
														</label>
														<input
															type="password"
															id="loginPassword"
															bind:value={loginPassword}
															class="w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
															placeholder="Enter your password"
														/>
													</div>
												{:else}
													<div>
														<label
															for="password"
															class="mb-1 block text-sm font-medium text-gray-700"
														>
															Create Password (Optional)
														</label>
														<input
															type="password"
															id="password"
															bind:value={password}
															class="w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
															placeholder="Create a password"
														/>
													</div>
													{#if password}
														<div>
															<label
																for="confirmPassword"
																class="mb-1 block text-sm font-medium text-gray-700"
															>
																Confirm Password
															</label>
															<input
																type="password"
																id="confirmPassword"
																bind:value={confirmPassword}
																class="w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
																placeholder="Confirm your password"
															/>
														</div>
													{/if}
												{/if}
												{#if passwordError}
													<p class="text-sm text-red-600">{passwordError}</p>
												{/if}
											</div>
										{/if}

										{#if loginError}
											<p class="text-sm text-red-600">{loginError}</p>
										{/if}

										<button
											class="w-full rounded bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
											onclick={handleSignIn}
										>
											Sign In
										</button>
									</div>
								{:else}
									<div class="space-y-4">
										<p class="text-sm text-gray-700">
											Signed in as: <span class="font-medium">{participantName}</span>
										</p>
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
										<button
											class="w-full rounded bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
											onclick={handleSignOut}
										>
											Sign Out
										</button>
									</div>
								{/if}
							</div>

							<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
								<h2 class="mb-4 text-lg font-semibold text-gray-900">
									Participants ({participants.length})
								</h2>
								<div class="divide-y divide-gray-200">
									{#each participants as participant}
										<div class="flex items-center justify-between py-3">
											<div>
												<div class="flex items-center gap-2">
													<p class="text-sm font-medium text-gray-900">{participant.name}</p>
												</div>
												<p class="mt-0.5 text-xs text-gray-500">{participant.timezone}</p>
											</div>
											<button
												class="rounded px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
												onclick={() => viewParticipantAvailability(participant)}
												aria-label={`View ${participant.name}'s availability`}
											>
												View
											</button>
										</div>
									{/each}
								</div>
							</div>
						</div>

						<div class="w-full gap-6 space-y-8 lg:w-3/4">
							<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
								<div class="mb-6 flex flex-col items-center justify-between sm:flex-row">
									<h2 class="text-lg font-semibold text-gray-900">Your Availability</h2>
									<div class="mt-2 flex gap-4 sm:mt-0">
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
												style="grid-template-columns: 60px repeat({event?.dates?.length ||
													0}, minmax(60px, 1fr))"
											>
												<div
													class="sticky left-0 z-10 border-r border-gray-200 bg-gray-50 p-2"
												></div>
												{#each event?.dates || [] as date}
													<div
														class="border-b border-r border-gray-200 bg-gray-50 p-2 text-center text-xs font-medium text-gray-700"
													>
														{formatDate(date)}
													</div>
												{/each}

												{#each event?.timeSlots || [] as timeSlot}
													<div
														class="sticky left-0 z-10 border-b border-r border-gray-200 bg-white p-2 text-xs text-gray-600"
													>
														{timeSlot}
													</div>
													{#each event?.dates || [] as date}
														<button
															type="button"
															class="relative h-10 border-b border-r border-gray-200 transition-colors duration-75 focus:outline-none"
															class:bg-green-500={availability[date]?.[timeSlot]}
															class:bg-gray-100={!availability[date]?.[timeSlot]}
															class:cursor-pointer={isLoggedIn}
															class:cursor-not-allowed={!isLoggedIn}
															disabled={!isLoggedIn}
															onmousedown={() => startDrag(date, timeSlot)}
															onmouseenter={() => handleDrag(date, timeSlot)}
															onmouseup={stopDrag}
															onclick={() => handleCellClick(date, timeSlot)}
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

							<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
								<div class="mb-6 flex flex-col items-center justify-between sm:flex-row">
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
												style="grid-template-columns: 60px repeat({event?.dates?.length ||
													0}, minmax(60px, 1fr))"
											>
												<div
													class="sticky left-0 z-10 border-r border-gray-200 bg-gray-50 p-2"
												></div>
												{#each event?.dates || [] as date}
													<div
														class="border-b border-r border-gray-200 bg-gray-50 p-2 text-center text-xs font-medium text-gray-700"
													>
														{formatDate(date)}
													</div>
												{/each}
												{#each event?.timeSlots || [] as timeSlot}
													<div
														class="sticky left-0 z-10 border-b border-r border-gray-200 bg-white p-2 text-xs text-gray-600"
													>
														{timeSlot}
													</div>
													{#each event?.dates || [] as date}
														<!-- svelte-ignore a11y_mouse_events_have_key_events -->
														<div
															class="h-10 border-b border-r border-gray-200"
															style="background-color: rgba(34, 197, 94, {getGroupAvailability(
																date,
																timeSlot
															) / 100})"
															onmouseover={() => handleCellHover(date, timeSlot)}
															onmouseout={handleCellLeave}
															role="presentation"
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
			</div>
		{/if}

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

		{#if selectedParticipant}
			<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
				<div class="w-full max-w-4xl rounded-xl bg-white p-8 shadow-2xl">
					<div class="mb-6 flex items-center justify-between">
						<h3 class="text-xl font-bold text-gray-900">
							{selectedParticipant.name}'s Availability
						</h3>
						<button
							class="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
							onclick={() => (selectedParticipant = null)}
							aria-label="Close"
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
									style="grid-template-columns: 60px repeat({event?.dates?.length ||
										0}, minmax(60px, 1fr))"
								>
									<div class="sticky left-0 z-10 border-r border-gray-200 bg-gray-50 p-2"></div>
									{#each event?.dates || [] as date}
										<div
											class="border-b border-r border-gray-200 bg-gray-50 p-2 text-center text-xs font-medium text-gray-700"
										>
											{formatDate(date)}
										</div>
									{/each}
									{#each event?.timeSlots || [] as timeSlot}
										<div
											class="sticky left-0 z-10 border-b border-r border-gray-200 bg-white p-2 text-xs text-gray-600"
										>
											{timeSlot}
										</div>
										{#each event?.dates || [] as date}
											<div
												class="h-10 border-b border-r border-gray-200 transition-colors duration-75"
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
					<div class="mt-6 text-center text-sm text-gray-500">
						Last updated: {formatDateTime(selectedParticipant.lastUpdated)}
					</div>
				</div>
			</div>
		{/if}
	</main>

	<Footer />
</div>
