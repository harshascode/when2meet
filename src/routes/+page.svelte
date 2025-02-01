<script lang="ts">
	import Footer from '$lib/Footer.svelte';
	import Header from '$lib/Header.svelte';
	import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
	import { v4 as uuidv4 } from 'uuid';

	// Types
	interface CalendarDay {
		date: Date;
		isCurrentMonth: boolean;
		dayLabel: string;
		ariaLabel: string;
		isToday: boolean;
	}

	interface TimeZone {
		value: string;
		label: string;
	}

	// Constants
	const TIME_INTERVAL = 30;
	const DEFAULT_START_TIME = '09:00';
	const DEFAULT_END_TIME = '17:00';

	// State management
	let eventName = $state('');
	let currentMonth = $state(new Date());
	let selectedDates: Date[] = $state([]);
	let selectedTimes: string[] = $state([]);
	let startTime = $state(DEFAULT_START_TIME);
	let endTime = $state(DEFAULT_END_TIME);
	let selectedTimeZone = $state(Intl.DateTimeFormat().resolvedOptions().timeZone);

	// Derived state
	let selectedDatesSet = $derived(new Set(selectedDates.map((d) => d.getTime())));
	let selectedTimesSet = $derived(new Set(selectedTimes));
	let calendarDays = $derived(generateCalendarDays(currentMonth));
	let timeSlots = $derived(generateTimeSlots(startTime, endTime, TIME_INTERVAL));
	let sortedSelectedDates = $derived([...selectedDates].sort((a, b) => a.getTime() - b.getTime()));

	// Time zones
	const timeZones: TimeZone[] = Intl.supportedValuesOf('timeZone').map((tz) => ({
		value: tz,
		label: tz.replace(/_/g, ' ')
	}));

	// Calendar functions
	function generateCalendarDays(date: Date): CalendarDay[] {
		const start = startOfMonth(date);
		const end = endOfMonth(date);
		const days = eachDayOfInterval({ start, end });
		const firstDayOfWeek = start.getDay();
		const today = new Date();

		const paddingDays = Array(firstDayOfWeek)
			.fill(null)
			.map((_, index) => {
				const paddingDate = new Date(start);
				paddingDate.setDate(start.getDate() - (firstDayOfWeek - index));
				return createCalendarDay(paddingDate, false, today);
			});

		const calendarDays = days.map((day) => createCalendarDay(day, true, today));

		const remainingDays = 6 - end.getDay();
		const endPaddingDays = Array(remainingDays)
			.fill(null)
			.map((_, index) => {
				const paddingDate = new Date(end);
				paddingDate.setDate(end.getDate() + (index + 1));
				return createCalendarDay(paddingDate, false, today);
			});

		return [...paddingDays, ...calendarDays, ...endPaddingDays];
	}

	function createCalendarDay(date: Date, isCurrentMonth: boolean, today: Date): CalendarDay {
		return {
			date,
			isCurrentMonth,
			dayLabel: format(date, 'd'),
			ariaLabel: format(date, 'MMMM d, yyyy'),
			isToday: isSameDay(date, today)
		};
	}

	// Time functions
	function generateTimeSlots(start: string, end: string, interval: number) {
		const slots = [];
		for (let time = 0; time < 24 * 60; time += interval) {
			const hours = Math.floor(time / 60);
			const minutes = time % 60;
			const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
			slots.push({
				time: timeString,
				formatted: convertTo12Hour(timeString)
			});
		}
		return slots;
	}

	function convertTo12Hour(time24h: string): string {
		const [hours, minutes] = time24h.split(':').map(Number);
		const period = hours >= 12 ? 'PM' : 'AM';
		const displayHours = hours % 12 || 12;
		return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
	}

	// New function to convert time string to minutes
	function timeToMinutes(time: string): number {
		const [hours, minutes] = time.split(':').map(Number);
		return hours * 60 + minutes;
	}

	// New function to auto-select time slots
	function updateSelectedTimeSlots(): void {
		const startMinutes = timeToMinutes(startTime);
		const endMinutes = timeToMinutes(endTime);

		selectedTimes = timeSlots
			.filter((slot) => {
				const slotMinutes = timeToMinutes(slot.time);
				return slotMinutes >= startMinutes && slotMinutes <= endMinutes;
			})
			.map((slot) => slot.time);
	}

	// Modified time selection handlers
	// Use this:
	$effect(() => {
		if (startTime && endTime) {
			updateSelectedTimeSlots();
		}
	});
	// Event handlers
	const navigationHandlers = {
		today: () => (currentMonth = new Date()),
		previousMonth: () =>
			(currentMonth = new Date(currentMonth.setMonth(currentMonth.getMonth() - 1))),
		nextMonth: () => (currentMonth = new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))
	};

	function toggleDateSelection(date: Date): void {
		selectedDates = selectedDatesSet.has(date.getTime())
			? selectedDates.filter((d) => !isSameDay(d, date))
			: [...selectedDates, date];
	}

	function toggleTimeSelection(time: string): void {
		selectedTimes = selectedTimesSet.has(time)
			? selectedTimes.filter((t) => t !== time)
			: [...selectedTimes, time];
	}

	async function handleSubmit(): Promise<void> {
		if (!eventName || !selectedDates.length || !selectedTimes.length) {
			alert('Please fill in all required fields');
			return;
		}

		const eventData = {
			id: uuidv4(),
			name: eventName,
			dates: selectedDates.map((date) => date.toISOString()),
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
			window.location.href = `/events/${eventData.id}`;
		} catch (error) {
			alert('Failed to create event. Please try again.');
		}
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-gray-50 to-white">
	<Header />

	<main class="container mx-auto max-w-6xl px-4 py-5">
		<div class="mx-auto mb-6 max-w-2xl">
			<input
				type="text"
				placeholder="Enter event name"
				class="w-full rounded-lg border border-gray-300 bg-white px-6 py-4
					text-center font-medium text-gray-900 placeholder-gray-400
					transition-all"
				bind:value={eventName}
			/>
		</div>

		<div class="flex flex-col justify-center justify-items-center gap-16 md:flex-row">
			<!-- Calendar Card -->
			<div class="shadow-xs h-fit rounded-lg border border-gray-200 bg-white p-4 md:w-80">
				<div class="mb-3 flex items-center justify-between">
					<button
						class="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
						aria-label="Previous Month"
						onclick={navigationHandlers.previousMonth}
					>
						<svg
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
						</svg>
					</button>

					<h2 class="text-lg font-semibold text-gray-900">
						{format(currentMonth, 'MMMM yyyy')}
					</h2>

					<button
						class="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
						aria-label="Next Month"
						onclick={navigationHandlers.nextMonth}
					>
						<svg
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
						</svg>
					</button>
				</div>

				<div class="grid grid-cols-7 gap-1">
					{#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
						<div class="py-2 text-center text-xs font-medium uppercase text-gray-500">
							{day}
						</div>
					{/each}

					{#each calendarDays as day (day.date.getTime())}
						<button
							class="aspect-square rounded-md text-sm font-medium
                                {!day.isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                                {day.isToday ? 'ring-1 ring-blue-500' : ''}
                                {selectedDatesSet.has(day.date.getTime())
								? 'bg-blue-600 text-white hover:bg-blue-700'
								: 'hover:bg-blue-50'}"
							onclick={() => toggleDateSelection(day.date)}
						>
							{day.dayLabel}
						</button>
					{/each}
				</div>

				<!-- {#if selectedDates.length > 0}
					<div class="mt-4 flex flex-wrap gap-2">
						{#each sortedSelectedDates as date}
							<span class="rounded-md bg-blue-100 px-2.5 py-1 text-sm text-blue-700">
								{format(date, 'MMM d')}
							</span>
						{/each}
					</div>
				{/if} -->
			</div>

			<!-- Time Selection Card -->
			<div class="shadow-xs w-96 rounded-lg border border-gray-200 bg-white p-6">
				<div class="mb-6 grid grid-cols-2 gap-4">
					<div>
						<label for="startTime" class="mb-2 block text-sm font-medium text-gray-700"
							>Start Time</label
						>
						<select
							id="startTime"
							bind:value={startTime}
							class="w-full rounded-md border border-gray-300 bg-white px-3 py-2
								text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						>
							{#each timeSlots as timeOption}
								<option value={timeOption.time}>{timeOption.formatted}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="endTime" class="mb-2 block text-sm font-medium text-gray-700"
							>End Time</label
						>
						<select
							id="endTime"
							bind:value={endTime}
							class="w-full rounded-md border border-gray-300 bg-white px-3 py-2
								text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						>
							{#each timeSlots as timeOption}
								<option value={timeOption.time}>{timeOption.formatted}</option>
							{/each}
						</select>
					</div>
				</div>

				<div class="mb-6">
					<label for="timezone" class="mb-2 block text-sm font-medium text-gray-700"
						>Time Zone</label
					>
					<select
						id="timezone"
						bind:value={selectedTimeZone}
						class="w-full rounded-md border border-gray-300 bg-white px-3 py-2
							text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					>
						{#each timeZones as tz}
							<option value={tz.value}>{tz.label}</option>
						{/each}
					</select>
				</div>

				<div class="grid max-h-[360px] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
					{#each timeSlots as timeSlot (timeSlot.time)}
						<button
							class="rounded-sm px-3 py-2 text-xs font-medium transition-colors
                                {selectedTimesSet.has(timeSlot.time)
								? 'bg-blue-600 text-white hover:bg-blue-700'
								: 'bg-gray-50 text-gray-700 hover:bg-gray-100'}"
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
				class="rounded-md bg-blue-600 px-8 py-3 text-sm font-semibold text-white
					shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline
					focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600
					disabled:cursor-not-allowed disabled:opacity-50"
				disabled={!eventName || selectedDates.length === 0 || selectedTimes.length === 0}
			>
				Create Event
			</button>
		</div>
	</main>

	<Footer />
</div>
