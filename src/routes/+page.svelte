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

	interface TimeSlot {
		time: string;
		formatted: string;
	}

	interface TimeZone {
		value: string;
		label: string;
	}

	// State management
	let eventName = $state('');
	let currentMonth = $state(new Date());
	let selectedDates: Date[] = $state([]);
	// let startTime = $state('09:00');
	// let endTime = $state('17:00');
	let selectedTimes: string[] = $state([]);
	let selectedTimeZone = $state(Intl.DateTimeFormat().resolvedOptions().timeZone);
	// const timeInterval = 30;

	// Time zone list
	const timeZones: TimeZone[] = Intl.supportedValuesOf('timeZone').map((tz) => ({
		value: tz,
		label: tz.replace(/_/g, ' ')
	}));

	// Derived state
	let selectedDatesSet = $derived(new Set(selectedDates.map((d) => d.getTime())));
	let selectedTimesSet = $derived(new Set(selectedTimes));

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
				const date = new Date(start);
				date.setDate(start.getDate() - (firstDayOfWeek - index));
				return createCalendarDay(date, false, today);
			});

		const calendarDays = days.map((day) => createCalendarDay(day, true, today));

		const lastDayOfWeek = end.getDay();
		const remainingDays = 6 - lastDayOfWeek;
		const endPaddingDays = Array(remainingDays)
			.fill(null)
			.map((_, index) => {
				const date = new Date(end);
				date.setDate(end.getDate() + (index + 1));
				return createCalendarDay(date, false, today);
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

	function toggleDateSelection(date: Date): void {
		selectedDates = selectedDatesSet.has(date.getTime())
			? selectedDates.filter((d) => !isSameDay(d, date))
			: [...selectedDates, date];
	}

	const today = () => (currentMonth = new Date());
	const previousMonth = () =>
		(currentMonth = new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)));
	const nextMonth = () =>
		(currentMonth = new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)));


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

		const eventId = uuidv4();
		const eventData = {
			id: eventId,
			name: eventName,
			dates: selectedDates.map((date) => date.toISOString()),
			timeSlots: selectedTimes,
			timeZone: selectedTimeZone
		};

		try {
			await fetch('/api/events', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(eventData)
			});
			window.location.href = `/events/${eventId}`;
		} catch (error) {
			alert('Failed to create event. Please try again.');
		}
	}

	// let calendarDays = $derived(generateCalendarDays(currentMonth));
	// let timeSlots = $derived(generateTimeSlots(startTime, endTime, timeInterval));
	// let sortedSelectedDates = $derived([...selectedDates].sort((a, b) => a.getTime() - b.getTime()));

	// Inside the script section, update/add these functions and variables:

	// State management for time (initialize with 12-hour format)
	let startTime = $state('09:00'); // 9:00 AM
	let endTime = $state('17:00'); // 5:00 PM
	const timeInterval = 30;

	function generateTimeSlots(start: string, end: string, interval: number): TimeSlot[] {
		const slots: TimeSlot[] = [];
		const [startHours, startMinutes] = start.split(':').map(Number);
		const [endHours, endMinutes] = end.split(':').map(Number);

		let startInMinutes = startHours * 60 + startMinutes;
		let endInMinutes = endHours * 60 + endMinutes;

		for (let time = 0; time < 24 * 60; time += interval) {
			const hours = Math.floor(time / 60);
			const minutes = time % 60;
			const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

			// Convert to 12-hour format for display
			const period = hours >= 12 ? 'PM' : 'AM';
			const displayHours = hours % 12 || 12;
			const formattedTime = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;

			slots.push({
				time: timeString,
				formatted: formattedTime
			});
		}
		return slots;
	}

	function formatTime(time: string): string {
		const [hours, minutes] = time.split(':').map(Number);
		const period = hours >= 12 ? 'PM' : 'AM';
		const displayHours = hours % 12 || 12;
		return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
	}

	// Function to convert 12-hour format to 24-hour format
	function convertTo24Hour(time12h: string): string {
		const [time, modifier] = time12h.split(' ');
		let [hours, minutes] = time.split(':');

		let hours24 = parseInt(hours, 10);

		if (hours24 === 12) {
			hours24 = modifier === 'PM' ? 12 : 0;
		} else {
			hours24 = modifier === 'PM' ? hours24 + 12 : hours24;
		}

		return `${hours24.toString().padStart(2, '0')}:${minutes}`;
	}

	// Function to convert 24-hour format to 12-hour format
	function convertTo12Hour(time24h: string): string {
		const [hours, minutes] = time24h.split(':').map(Number);
		const period = hours >= 12 ? 'PM' : 'AM';
		const displayHours = hours % 12 || 12;
		return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
	}

	let calendarDays = $derived(generateCalendarDays(currentMonth));
	let timeSlots = $derived(generateTimeSlots(startTime, endTime, timeInterval));
	let sortedSelectedDates = $derived([...selectedDates].sort((a, b) => a.getTime() - b.getTime()));
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
	<Header />

	<main class="container mx-auto max-w-6xl px-4 py-8">
		<!-- Event Name Input -->
		<div class="mx-auto mb-10 max-w-2xl">
			<input
				type="text"
				placeholder="Enter event name"
				class="w-full rounded-xl border border-gray-200 bg-white/80 px-6 py-4
                text-center text-xl shadow-sm backdrop-blur-sm
                transition-all duration-200 focus:border-blue-500
                focus:ring-2 focus:ring-blue-500"
				bind:value={eventName}
			/>
		</div>

		<div class="grid gap-6 lg:grid-cols-2">
			<!-- Calendar Card -->
			<div class="rounded-xl border border-gray-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
				<div class="mb-6 flex items-center justify-between">
					<button
						class="rounded-lg p-2 transition-colors hover:bg-gray-100"
						aria-label="Previous Month"
						onclick={previousMonth}
					>
						<svg
							class="h-5 w-5 text-gray-600"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 19l-7-7 7-7"
							/>
						</svg>
					</button>

					<h2 class="text-xl font-medium text-gray-800">
						{format(currentMonth, 'MMMM yyyy')}
					</h2>

					<button
						class="rounded-lg p-2 transition-colors hover:bg-gray-100"
						aria-label="Next Month"
						onclick={nextMonth}
					>
						<svg
							class="h-5 w-5 text-gray-600"
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
					</button>
				</div>

				<div class="grid grid-cols-7 gap-1">
					{#each ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as day}
						<div class="py-2 text-center text-sm font-medium text-gray-500">{day}</div>
					{/each}

					{#each calendarDays as day (day.date.getTime())}
						<button
							class="aspect-square rounded-lg text-sm font-medium
                                {!day.isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                                {day.isToday ? 'ring-2 ring-blue-400' : ''}
                                {selectedDatesSet.has(day.date.getTime())
								? 'bg-blue-500 text-white hover:bg-blue-600'
								: 'hover:bg-blue-50'}"
							onclick={() => toggleDateSelection(day.date)}
						>
							{day.dayLabel}
						</button>
					{/each}
				</div>

				{#if selectedDates.length > 0}
					<div class="mt-4 flex flex-wrap gap-2">
						{#each sortedSelectedDates as date}
							<span class="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
								{format(date, 'MMM d')}
							</span>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Time Selection Card -->
			<div class="rounded-xl border border-gray-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
				<div class="mb-6 grid grid-cols-2 gap-4">
					<div>
						<label for="startTime" class="mb-1 block text-sm text-gray-600">Start Time</label>
						<select
							id="startTime"
							bind:value={startTime}
							class="w-full rounded-lg border border-gray-200 px-3 py-2
                focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
						>
							{#each Array.from({ length: 48 }, (_, i) => {
								const hours = Math.floor(i / 2);
								const minutes = (i % 2) * 30;
								const time24 = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
								return { value: time24, label: convertTo12Hour(time24) };
							}) as timeOption}
								<option value={timeOption.value}>{timeOption.label}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="endTime" class="mb-1 block text-sm text-gray-600">End Time</label>
						<select
							id="endTime"
							bind:value={endTime}
							class="w-full rounded-lg border border-gray-200 px-3 py-2
                focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
						>
							{#each Array.from({ length: 48 }, (_, i) => {
								const hours = Math.floor(i / 2);
								const minutes = (i % 2) * 30;
								const time24 = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
								return { value: time24, label: convertTo12Hour(time24) };
							}) as timeOption}
								<option value={timeOption.value}>{timeOption.label}</option>
							{/each}
						</select>
					</div>
				</div>

				<!-- Time Zone Selection -->
				<div class="mb-6">
					<label for="timezone" class="mb-1 block text-sm text-gray-600">Time Zone</label>
					<select
						id="timezone"
						bind:value={selectedTimeZone}
						class="w-full rounded-lg border border-gray-200 px-3 py-2
							focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
					>
						{#each timeZones as tz}
							<option value={tz.value}>{tz.label}</option>
						{/each}
					</select>
				</div>

				<!-- Time slots grid -->
				<div class="grid max-h-[360px] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
					{#each timeSlots as timeSlot (timeSlot.time)}
						<button
							class="rounded-lg px-4 py-2 text-sm font-medium
                    {selectedTimesSet.has(timeSlot.time)
								? 'bg-blue-500 text-white hover:bg-blue-600'
								: 'bg-gray-50 text-gray-700 hover:bg-gray-100'}"
							onclick={() => toggleTimeSelection(timeSlot.time)}
						>
							{timeSlot.formatted}
						</button>
					{/each}
				</div>
			</div>
		</div>

		<!-- Create Button -->
		<div class="mt-8 text-center">
			<button
				onclick={handleSubmit}
				class="rounded-xl bg-blue-600 px-8 py-3 text-lg font-medium text-white
                transition-colors hover:bg-blue-700
                disabled:cursor-not-allowed disabled:opacity-50"
				disabled={!eventName || selectedDates.length === 0 || selectedTimes.length === 0}
			>
				Create Event
			</button>
		</div>
	</main>

	<Footer />
</div>
