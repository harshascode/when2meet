<script lang="ts">
	// ======================
	// EVENT & TIME STATE CODE (unchanged)
	// ======================
	import Footer from '$lib/Footer.svelte';
	import Header from '$lib/Header.svelte';
	import { v4 as uuidv4 } from 'uuid';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	// Constants
	const TIME_INTERVAL: number = 30;
	const DEFAULT_START_TIME: string = '09:00';
	const DEFAULT_END_TIME: string = '17:00';

	// State management for event details
	let eventName: string = $state('');
	let selectedDates: Date[] = $state([]);
	let selectedTimes: string[] = $state([]);
	let startTime: string = $state(DEFAULT_START_TIME);
	let endTime: string = $state(DEFAULT_END_TIME);
	let selectedTimeZone: string = $state(Intl.DateTimeFormat().resolvedOptions().timeZone);
	let showEventNameError: boolean = $state(false);

	// Time zones
	const timeZones: { value: string; label: string }[] = Intl.supportedValuesOf('timeZone').map(
		(tz: string) => ({
			value: tz,
			label: tz.replace(/_/g, ' ')
		})
	);

	// Generate time slots for selection
	function generateTimeSlots(
		start: string,
		end: string,
		interval: number
	): { time: string; formatted: string }[] {
		const slots: { time: string; formatted: string }[] = [];
		for (let time = 0; time < 24 * 60; time += interval) {
			const hours: number = Math.floor(time / 60);
			const minutes: number = time % 60;
			const timeString: string = `${hours.toString().padStart(2, '0')}:${minutes
				.toString()
				.padStart(2, '0')}`;
			slots.push({
				time: timeString,
				formatted: convertTo12Hour(timeString)
			});
		}
		return slots;
	}

	function convertTo12Hour(time24h: string): string {
		const [hours, minutes]: number[] = time24h.split(':').map(Number);
		const period: string = hours >= 12 ? 'PM' : 'AM';
		const displayHours: number = hours % 12 || 12;
		return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
	}

	const timeSlots: { time: string; formatted: string }[] = $derived(
		generateTimeSlots(startTime, endTime, TIME_INTERVAL)
	);

	function toggleTimeSelection(time: string): void {
		if (selectedTimes.includes(time)) {
			selectedTimes = selectedTimes.filter((t: string) => t !== time);
		} else {
			selectedTimes = [...selectedTimes, time];
		}
	}

	// Update selected times when start/end time changes.
	$effect(() => {
		if (startTime && endTime) {
			const startMinutes = timeToMinutes(startTime);
			const endMinutes = timeToMinutes(endTime);
			selectedTimes = timeSlots
				.filter((slot) => {
					const slotMinutes = timeToMinutes(slot.time);
					return slotMinutes >= startMinutes && slotMinutes <= endMinutes;
				})
				.map((slot) => slot.time);
		}
	});

	function timeToMinutes(time: string): number {
		const [hours, minutes]: number[] = time.split(':').map(Number);
		return hours * 60 + minutes;
	}

	async function handleSubmit(): Promise<void> {
		showEventNameError = false;

		if (!eventName.trim()) {
			showEventNameError = true;
			const input = document.querySelector('input[type="text"]') as HTMLInputElement;
			input?.focus();
			alert('Please fill in all required fields');
			return;
		}

		if (!selectedDates.length || !selectedTimes.length) {
			alert('Please fill in all required fields');
			return;
		}

		const eventData = {
			id: uuidv4(),
			name: eventName,
			dates: selectedDates.map((date: Date) => date.toISOString()),
			timeSlots: selectedTimes,
			timeZone: selectedTimeZone
		};

		try {
			const response = await fetch('/api/events', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(eventData)
			});
			if (!response.ok) throw new Error('Failed to create event');

			// Add the event to localStorage
			const storedEvents = localStorage.getItem('createdEvents');
			const events = storedEvents ? JSON.parse(storedEvents) : [];
			events.push({
				id: eventData.id,
				name: eventData.name,
				createdAt: new Date().toISOString()
			});
			localStorage.setItem('createdEvents', JSON.stringify(events));

			window.location.href = `/events/${eventData.id}`;
		} catch (error) {
			alert('Failed to create event. Please try again.');
		}
	}

	// ======================
	// NEW CALENDAR COMPONENT CODE (from your calendar code)
	// ======================

	// Define Cell interface
	interface Cell {
		row: number;
		col: number;
		date: number;
		selected: boolean;
		active: boolean;
		inCurrentMonth: boolean;
	}

	// Calendar state using Svelte 5's $state
	let { currentYear, currentMonth, grid, isDragging, dragMode, dragRange } = $state({
		currentYear: new Date().getFullYear(),
		currentMonth: new Date().getMonth(), // 0 = January, etc.
		grid: [] as Cell[][],
		isDragging: false,
		dragMode: null as 'select' | 'deselect' | null,
		dragRange: null as { minRow: number; maxRow: number; minCol: number; maxCol: number } | null
	});

	// Local non-state variables for drag handling.
	let dragStart: { row: number; col: number } | null = null;
	let dragged = false;
	let pendingDragUpdate = false;
	let startX = 0;
	let startY = 0;
	const dragThreshold = 5;
	const dragThresholdSq = dragThreshold * dragThreshold;

	// Weekday headers
	const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

	// Utility to get the full month name.
	function getMonthName(year: number, month: number): string {
		return new Date(year, month, 1).toLocaleString('default', { month: 'long' });
	}

	// Build a grid (2D array) for the current month.
	function generateCalendarGrid(year: number, month: number): Cell[][] {
		const firstDay = new Date(year, month, 1).getDay();
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const prevMonth = month === 0 ? 11 : month - 1;
		const prevYear = month === 0 ? year - 1 : year;
		const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
		const weeks = Math.ceil((daysInMonth + firstDay) / 7);
		const newGrid: Cell[][] = [];
		let currentDate = 1;
		let nextDate = 1;

		for (let week = 0; week < weeks; week++) {
			const row: Cell[] = [];
			for (let col = 0; col < 7; col++) {
				const cellIndex = week * 7 + col;
				if (cellIndex < firstDay) {
					// Days from previous month.
					const date = daysInPrevMonth - (firstDay - cellIndex - 1);
					row.push({
						row: week + 1,
						col: col + 1,
						date,
						selected: false,
						active: true,
						inCurrentMonth: false
					});
				} else if (currentDate > daysInMonth) {
					// Days from next month.
					row.push({
						row: week + 1,
						col: col + 1,
						date: nextDate++,
						selected: false,
						active: true,
						inCurrentMonth: false
					});
				} else {
					// Days from the current month.
					row.push({
						row: week + 1,
						col: col + 1,
						date: currentDate++,
						selected: false,
						active: true,
						inCurrentMonth: true
					});
				}
			}
			newGrid.push(row);
		}
		return newGrid;
	}

	// Regenerate the grid whenever the current month or year changes.
	$effect(() => {
		grid = generateCalendarGrid(currentYear, currentMonth);
	});

	// Compute the full Date for a given cell.
	function getFullDate(cell: Cell): Date {
		if (cell.inCurrentMonth) {
			return new Date(currentYear, currentMonth, cell.date);
		} else {
			// For cells not in the current month, decide based on the row.
			if (cell.row === 1) {
				const prevM = currentMonth === 0 ? 11 : currentMonth - 1;
				const yr = currentMonth === 0 ? currentYear - 1 : currentYear;
				return new Date(yr, prevM, cell.date);
			} else {
				const nextM = currentMonth === 11 ? 0 : currentMonth + 1;
				const yr = currentMonth === 11 ? currentYear + 1 : currentYear;
				return new Date(yr, nextM, cell.date);
			}
		}
	}

	// NEW: Helper function to determine if a cell represents today.
	function isToday(cell: Cell): boolean {
		const cellDate = getFullDate(cell);
		const today = new Date();
		return (
			cellDate.getDate() === today.getDate() &&
			cellDate.getMonth() === today.getMonth() &&
			cellDate.getFullYear() === today.getFullYear()
		);
	}

	// Update selectedDates based on grid state.
	function updateSelectedDates() {
		selectedDates = grid
			.flat()
			.filter((c) => c.selected)
			.map(getFullDate);
	}

	function handleMouseDown(cell: Cell, event: MouseEvent) {
		isDragging = true;
		dragStart = { row: cell.row, col: cell.col };
		dragged = false;
		dragMode = cell.selected ? 'deselect' : 'select';
		dragRange = { minRow: cell.row, maxRow: cell.row, minCol: cell.col, maxCol: cell.col };
		startX = event.clientX;
		startY = event.clientY;
	}

	function updateDragRange(event: MouseEvent) {
		if (!dragStart) return;
		const targetElement = (event.target as HTMLElement).closest('.cell');
		if (
			targetElement instanceof HTMLElement &&
			targetElement.dataset.row &&
			targetElement.dataset.col
		) {
			const row = Number(targetElement.dataset.row);
			const col = Number(targetElement.dataset.col);
			dragRange = {
				minRow: Math.min(dragStart.row, row),
				maxRow: Math.max(dragStart.row, row),
				minCol: Math.min(dragStart.col, col),
				maxCol: Math.max(dragStart.col, col)
			};
		}
	}

	function handleMouseMove(event: MouseEvent) {
		if (!isDragging || !dragStart) return;
		const deltaX = event.clientX - startX;
		const deltaY = event.clientY - startY;
		const distanceSq = deltaX * deltaX + deltaY * deltaY;
		if (distanceSq > dragThresholdSq) {
			dragged = true;
		}
		if (!pendingDragUpdate) {
			pendingDragUpdate = true;
			requestAnimationFrame(() => {
				pendingDragUpdate = false;
				updateDragRange(event);
			});
		}
	}

	function resetDrag() {
		isDragging = false;
		dragStart = null;
		dragMode = null;
		dragged = false;
		dragRange = null;
	}

	function handleMouseUp() {
		if (!isDragging || !dragRange) {
			resetDrag();
			return;
		}
		if (dragged) {
			// Update grid cells within the drag range.
			grid = grid.map((row) =>
				row.map((cell) =>
					cell.row >= dragRange!.minRow &&
					cell.row <= dragRange!.maxRow &&
					cell.col >= dragRange!.minCol &&
					cell.col <= dragRange!.maxCol
						? { ...cell, selected: dragMode === 'select' }
						: cell
				)
			);
			updateSelectedDates();
		}
		resetDrag();
	}

	function toggleCell(cell: Cell) {
		if (dragged) return;
		grid = grid.map((row) =>
			row.map((c) =>
				c.row === cell.row && c.col === cell.col ? { ...c, selected: !c.selected } : c
			)
		);
		updateSelectedDates();
	}

	function prevMonth() {
		if (currentMonth === 0) {
			currentYear = currentYear - 1;
			currentMonth = 11;
		} else {
			currentMonth = currentMonth - 1;
		}
	}

	function nextMonth() {
		if (currentMonth === 11) {
			currentYear = currentYear + 1;
			currentMonth = 0;
		} else {
			currentMonth = currentMonth + 1;
		}
	}

	// Global mouseup handler in case the user releases outside the calendar.
	function onWindowMouseUp(event: MouseEvent) {
		if (isDragging) {
			handleMouseUp();
		}
	}

	onMount(() => {
		if (browser) {
			window.addEventListener('mouseup', onWindowMouseUp);
		}
	});
	onDestroy(() => {
		if (browser) {
			window.removeEventListener('mouseup', onWindowMouseUp);
		}
	});
</script>

<!-- MAIN MARKUP -->
<div class="min-h-screen bg-gradient-to-b from-slate-50 to-white">
	<Header />

	<main class="container mx-auto max-w-6xl px-4 py-8">
		<!-- Professional Header -->
		<div class="mb-12 text-center">
			<h1 class="mb-3 text-3xl font-semibold text-slate-800 md:text-4xl">Schedule Your Event</h1>
			<p class="mx-auto max-w-2xl text-base text-slate-600">
				Select dates and times to find the perfect meeting slot
			</p>
		</div>

		<!-- Event Creation Section -->
		<div class="mx-auto max-w-5xl rounded-md p-6">
			<!-- Event Name Input -->
			<div class="mx-auto mb-8 max-w-2xl">
				<input
					type="text"
					placeholder="Event name"
					class="w-full rounded-sm border {showEventNameError
						? 'border-red-500'
						: 'border-slate-300'} bg-white px-4 py-3 text-center font-medium text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
					bind:value={eventName}
					oninput={() => (showEventNameError = false)}
				/>
				{#if showEventNameError}
					<p class="mt-2 text-center text-sm text-red-600">Please enter an event name</p>
				{/if}
			</div>

			<div class="flex flex-col justify-center gap-6 md:flex-row md:gap-8">
				<!-- Calendar Component -->
				<div class="h-fit rounded-sm border border-slate-200 bg-white p-5 shadow-sm md:w-[400px]">
					<div class="calendar-container">
						<div class="calendar-header mb-4">
							<button class="nav-button" onclick={prevMonth} aria-label="Previous Month">
								<svg
									class="h-5 w-5 text-slate-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M15 19l-7-7 7-7"
									/>
								</svg>
							</button>
							<h2 class="text-lg font-medium text-slate-800">
								{getMonthName(currentYear, currentMonth)}
								{currentYear}
							</h2>
							<button class="nav-button" onclick={nextMonth} aria-label="Next Month">
								<svg
									class="h-5 w-5 text-slate-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M9 5l7 7-7 7"
									/>
								</svg>
							</button>
						</div>
						<div
							class="calendar"
							role="grid"
							tabindex="0"
							aria-label="Calendar Selection Grid"
							onmousemove={handleMouseMove}
						>
							{#each days as day}
								<div class="cell header">{day}</div>
							{/each}
							{#each grid as row}
								{#each row as cell}
									<div
										class="cell {cell.selected ? 'selected' : ''} {cell.inCurrentMonth
											? ''
											: 'other-month'} 
                                        {isDragging &&
										dragRange &&
										cell.row >= dragRange.minRow &&
										cell.row <= dragRange.maxRow &&
										cell.col >= dragRange.minCol &&
										cell.col <= dragRange.maxCol
											? dragMode === 'select'
												? 'drag-select'
												: 'drag-deselect'
											: ''} 
                                        {isToday(cell) ? 'today' : ''}"
										data-row={cell.row}
										data-col={cell.col}
										role="gridcell"
										tabindex="0"
										aria-selected={cell.selected}
										aria-label={`Select ${cell.date}`}
										onmousedown={(e) => handleMouseDown(cell, e)}
										onclick={() => toggleCell(cell)}
									>
										{cell.date}
									</div>
								{/each}
							{/each}
						</div>
					</div>
				</div>

				<!-- Time Selection Panel -->
				<div class="flex-1 rounded-sm border border-slate-200 bg-white p-5 shadow-sm">
					<div class="mb-6 grid grid-cols-2 gap-4">
						<div>
							<label for="startTime" class="mb-1.5 block text-sm font-medium text-slate-700"
								>Start Time</label
							>
							<select
								id="startTime"
								bind:value={startTime}
								class="w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
							>
								{#each timeSlots as timeOption}
									<option value={timeOption.time}>{timeOption.formatted}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="endTime" class="mb-1.5 block text-sm font-medium text-slate-700"
								>End Time</label
							>
							<select
								id="endTime"
								bind:value={endTime}
								class="w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
							>
								{#each timeSlots as timeOption}
									<option value={timeOption.time}>{timeOption.formatted}</option>
								{/each}
							</select>
						</div>
					</div>

					<div class="mb-6">
						<label for="timezone" class="mb-1.5 block text-sm font-medium text-slate-700"
							>Time Zone</label
						>
						<select
							id="timezone"
							bind:value={selectedTimeZone}
							class="w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
						>
							{#each timeZones as tz}
								<option value={tz.value}>{tz.label}</option>
							{/each}
						</select>
					</div>

					<div
						class="grid max-h-[280px] grid-cols-3 gap-1.5 overflow-y-auto rounded-sm border border-slate-200 bg-slate-50 p-2"
					>
						{#each timeSlots as timeSlot (timeSlot.time)}
							<button
								class="rounded-sm px-2 py-2 text-xs font-medium transition-colors {selectedTimes.includes(
									timeSlot.time
								)
									? 'bg-slate-800 text-white'
									: 'bg-white text-slate-700 hover:bg-slate-100'}"
								onclick={() => toggleTimeSelection(timeSlot.time)}
							>
								{timeSlot.formatted}
							</button>
						{/each}
					</div>
				</div>
			</div>

			<div class="mt-8 text-center">
				<button
					onclick={handleSubmit}
					class="inline-flex items-center rounded-sm bg-slate-800 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50"
					disabled={!eventName || selectedDates.length === 0 || selectedTimes.length === 0}
				>
					Create Event
					<svg class="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 7l5 5m0 0l-5 5m5-5H6"
						/>
					</svg>
				</button>
			</div>
		</div>
	</main>

	<Footer />
</div>

<style>
	/* CALENDAR STYLES */
	.calendar-container {
		width: 100%;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}
	.calendar-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.nav-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		transition: background-color 0.2s;
	}
	.nav-button:hover {
		background-color: #f8fafc;
	}
	.calendar {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 1px;
		user-select: none;
		padding: 1px;
		background-color: #e2e8f0;
	}
	.cell {
		height: 38px;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: white;
		font-size: 0.875rem;
		border: 1px solid transparent;
		cursor: pointer;
		position: relative;
		transition: all 0.15s;
	}
	/* .cell:hover:not(.header) {
        background-color: #f8fafc;
    } */
	.header {
		font-weight: 500;
		color: #475569;
		background-color: #f8fafc;
		cursor: default;
	}
	.selected {
		background-color: #1e293b;
		color: white;
	}
	.selected:hover {
		background-color: #334155;
	}
	.other-month {
		color: #94a3b8;
	}
	.drag-select {
		background-color: #1e293b;
		color: white;
	}
	.drag-deselect {
		background-color: #f1f5f9;
		color: black;
	}
	.drag-deselect:hover {
		background-color: #e1e7ed;
	}
	.today {
		border: 1px solid #1e293b;
		font-weight: 500;
	}
</style>
