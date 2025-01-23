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
	}

	interface TimeSlot {
		time: string;
		formatted: string;
	}

	// State management
	let eventName = $state('');
	let currentMonth = $state(new Date());
	let selectedDates: Date[] = $state([]);
	let startTime = $state('09:00');
	let endTime = $state('17:00');
	let selectedTimes: string[] = $state([]);
	const timeInterval = 30;

	// Derived state
	let selectedDatesSet = $derived(new Set(selectedDates.map((d) => d.getTime())));
	let selectedTimesSet = $derived(new Set(selectedTimes));

	// Calendar functions
	function generateCalendarDays(date: Date): CalendarDay[] {
		const start = startOfMonth(date);
		const end = endOfMonth(date);
		const days = eachDayOfInterval({ start, end });
		const firstDayOfWeek = start.getDay();

		const paddingDays = Array(firstDayOfWeek)
			.fill(null)
			.map((_, index) => {
				const date = new Date(start);
				date.setDate(start.getDate() - (firstDayOfWeek - index));
				return {
					date,
					isCurrentMonth: false,
					dayLabel: format(date, 'd'),
					ariaLabel: format(date, 'MMMM d, yyyy')
				};
			});

		const calendarDays = days.map((day) => ({
			date: day,
			isCurrentMonth: true,
			dayLabel: format(day, 'd'),
			ariaLabel: format(day, 'MMMM d, yyyy')
		}));

		const lastDayOfWeek = end.getDay();
		const remainingDays = 6 - lastDayOfWeek;
		const endPaddingDays = Array(remainingDays)
			.fill(null)
			.map((_, index) => {
				const date = new Date(end);
				date.setDate(end.getDate() + (index + 1));
				return {
					date,
					isCurrentMonth: false,
					dayLabel: format(date, 'd'),
					ariaLabel: format(date, 'MMMM d, yyyy')
				};
			});

		return [...paddingDays, ...calendarDays, ...endPaddingDays];
	}

	// Date selection
	function toggleDateSelection(date: Date): void {
		selectedDates = selectedDatesSet.has(date.getTime())
			? selectedDates.filter((d) => !isSameDay(d, date))
			: [...selectedDates, date];
	}

	// Calendar navigation
	const today = () => (currentMonth = new Date());
	const previousMonth = () =>
		(currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
	const nextMonth = () =>
		(currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));

	// Time slots generation
	function generateTimeSlots(start: string, end: string, interval: number): TimeSlot[] {
		const [startHours, startMinutes] = start.split(':').map(Number);
		const [endHours, endMinutes] = end.split(':').map(Number);
		const startInMinutes = startHours * 60 + startMinutes;
		const endInMinutes = endHours * 60 + endMinutes;
		const slots: TimeSlot[] = [];

		for (let time = startInMinutes; time <= endInMinutes; time += interval) {
			const hours = Math.floor(time / 60);
			const minutes = time % 60;
			const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
			slots.push({
				time: timeString,
				formatted: formatTime(timeString)
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

	function toggleTimeSelection(time: string): void {
		selectedTimes = selectedTimesSet.has(time)
			? selectedTimes.filter((t) => t !== time)
			: [...selectedTimes, time];
	}

	// Form submission
	async function handleSubmit(): Promise<void> {
		try {
			if (!eventName) throw new Error('Please enter an event name');
			if (!selectedDates.length) throw new Error('Please select at least one date');
			if (!selectedTimes.length) throw new Error('Please select at least one time slot');

			const eventId = uuidv4();
			const eventData = {
				id: eventId,
				name: eventName,
				dates: selectedDates.map((date) => date.toISOString()),
				timeSlots: selectedTimes
			};

			const response = await fetch('/api/events', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(eventData)
			});

			if (!response.ok) throw new Error('Failed to create event');
			window.location.href = `/events/${eventId}`;
		} catch (error) {
			alert(error instanceof Error ? error.message : 'Failed to create event. Please try again.');
		}
	}

	// Derived values
	let calendarDays = $derived(generateCalendarDays(currentMonth));
	let timeSlots = $derived(generateTimeSlots(startTime, endTime, timeInterval));
	let sortedSelectedDates = $derived([...selectedDates].sort((a, b) => a.getTime() - b.getTime()));
</script>

<div class="flex min-h-screen flex-col">
	<Header />

	<main class="container mx-auto max-w-4xl flex-1 py-8">
		<div class="grid gap-8">
			<div class="text-center">
				<input
					type="text"
					placeholder="New Event Name"
					class="mx-auto w-full max-w-md rounded-md border border-gray-300 px-4 py-2 text-center text-xl font-medium"
					bind:value={eventName}
					aria-label="Event name"
				/>
			</div>

			<div class="grid gap-8 md:grid-cols-2">
				<!-- Calendar Section -->
				<div class="space-y-4">
					<h2 class="text-center text-lg font-medium">What dates might work?</h2>
					<div class="rounded-md border bg-white p-4">
						<div class="mb-4 flex items-center justify-between">
							<button
								class="rounded-md px-3 py-1 hover:bg-gray-100"
								onclick={previousMonth}
								aria-label="Previous month"
							>
								&larr;
							</button>
							<h3 class="text-lg font-medium">{format(currentMonth, 'MMMM yyyy')}</h3>
							<button
								class="rounded-md px-3 py-1 hover:bg-gray-100"
								onclick={nextMonth}
								aria-label="Next month"
							>
								&rarr;
							</button>
						</div>

						<div class="grid grid-cols-7 gap-1" role="grid">
							{#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
								<div class="p-2 text-center text-sm font-medium" role="columnheader">{day}</div>
							{/each}

							{#each calendarDays as day (day.date.getTime())}
								<button
									class="aspect-square rounded-md p-2 text-center text-sm
                                        {!day.isCurrentMonth && 'text-gray-400'}
                                        {selectedDatesSet.has(day.date.getTime())
										? 'bg-green-500 text-white hover:bg-green-600'
										: 'hover:bg-gray-100'}"
									onclick={() => toggleDateSelection(day.date)}
									aria-label={day.ariaLabel}
									aria-pressed={selectedDatesSet.has(day.date.getTime())}
								>
									{day.dayLabel}
								</button>
							{/each}
						</div>
					</div>

					<div class="mt-4 space-y-2">
						<h3 class="text-sm font-medium">Selected Dates:</h3>
						<div class="flex flex-wrap gap-2">
							{#each sortedSelectedDates as date}
								<span class="rounded-full bg-green-100 px-3 py-1 text-sm text-green-800">
									{format(date, 'MMM d, yyyy')}
								</span>
							{/each}
						</div>
					</div>
				</div>

				<!-- Time Selection Section -->
				<div class="space-y-4">
					<h2 class="text-center text-lg font-medium">What times might work?</h2>
					<div class="rounded-md border bg-white p-4">
						<div class="mb-4 flex justify-center gap-4">
							<div class="space-y-2">
								<label for="startTime" class="block text-sm font-medium text-gray-700">
									Start Time
								</label>
								<input
									id="startTime"
									type="time"
									bind:value={startTime}
									class="rounded-md border border-gray-300 px-3 py-1.5"
								/>
							</div>
							<div class="space-y-2">
								<label for="endTime" class="block text-sm font-medium text-gray-700">
									End Time
								</label>
								<input
									id="endTime"
									type="time"
									bind:value={endTime}
									class="rounded-md border border-gray-300 px-3 py-1.5"
								/>
							</div>
						</div>

						<div class="grid max-h-[400px] grid-cols-2 gap-2 overflow-y-auto p-2">
							{#each timeSlots as timeSlot (timeSlot.time)}
								<button
									class="rounded-md border p-2 text-sm transition-colors
                                        {selectedTimesSet.has(timeSlot.time)
										? 'border-green-500 bg-green-500 text-white hover:bg-green-600'
										: 'border-gray-200 hover:bg-gray-50'}"
									onclick={() => toggleTimeSelection(timeSlot.time)}
									aria-pressed={selectedTimesSet.has(timeSlot.time)}
								>
									{timeSlot.formatted}
								</button>
							{/each}
						</div>
					</div>
				</div>
			</div>

			<div class="space-y-4 text-center">
				<div class="flex items-center justify-center gap-2">
					<button
						type="submit"
						class="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
						disabled={selectedDates.length === 0 || !eventName || selectedTimes.length === 0}
						onclick={handleSubmit}
					>
						Create Event
					</button>
				</div>
			</div>
		</div>
	</main>

	<Footer />
</div>
