<script lang="ts">
	import Footer from '$lib/Footer.svelte';
	import Header from '$lib/Header.svelte';
	import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
	import { v4 as uuidv4 } from 'uuid';

	// Types
	interface CalendarDay {
		date: Date;
		isCurrentMonth: boolean;
	}

	// State management using Svelte's runes
	let eventName = $state('');
	let currentMonth = $state(new Date());
	let selectedDates: Date[] = $state([]);
	let startTime = $state('09:00');
	let endTime = $state('17:00');
	let selectedTimes: string[] = $state([]);
	const timeInterval = 30; // minutes interval between time slots

	// Calendar functions
	function generateCalendarDays(date: Date): CalendarDay[] {
		const start = startOfMonth(date);
		const end = endOfMonth(date);
		const days = eachDayOfInterval({ start, end });
		const firstDayOfWeek = start.getDay();

		const paddingDays = Array(firstDayOfWeek)
			.fill(null)
			.map((_, index) => ({
				date: new Date(new Date(start).setDate(start.getDate() - (firstDayOfWeek - index))),
				isCurrentMonth: false
			}));

		const calendarDays = days.map((day) => ({
			date: day,
			isCurrentMonth: true
		}));

		const lastDayOfWeek = end.getDay();
		const remainingDays = 6 - lastDayOfWeek;
		const endPaddingDays = Array(remainingDays)
			.fill(null)
			.map((_, index) => ({
				date: new Date(new Date(end).setDate(end.getDate() + (index + 1))),
				isCurrentMonth: false
			}));

		return [...paddingDays, ...calendarDays, ...endPaddingDays];
	}

	// Date selection functions
	function toggleDateSelection(date: Date): void {
		const index = selectedDates.findIndex((d) => isSameDay(d, date));
		selectedDates =
			index === -1 ? [...selectedDates, date] : selectedDates.filter((_, i) => i !== index);
	}

	const isDateSelected = (date: Date): boolean => selectedDates.some((d) => isSameDay(d, date));

	// Calendar navigation
	const today = () => (currentMonth = new Date());
	const previousMonth = () =>
		(currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
	const nextMonth = () =>
		(currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));

	// Time selection functions
	function generateTimeSlots(start: string, end: string, interval: number): string[] {
		const [startHours, startMinutes] = start.split(':').map(Number);
		const [endHours, endMinutes] = end.split(':').map(Number);
		const startInMinutes = startHours * 60 + startMinutes;
		const endInMinutes = endHours * 60 + endMinutes;
		const slots: string[] = [];

		for (let time = startInMinutes; time <= endInMinutes; time += interval) {
			const hours = Math.floor(time / 60);
			const minutes = time % 60;
			slots.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
		}

		return slots;
	}

	function toggleTimeSelection(time: string): void {
		selectedTimes = selectedTimes.includes(time)
			? selectedTimes.filter((t) => t !== time)
			: [...selectedTimes, time];
	}

	function formatTime(time: string): string {
		const [hours, minutes] = time.split(':').map(Number);
		const period = hours >= 12 ? 'PM' : 'AM';
		const displayHours = hours % 12 || 12;
		return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
	}

	// Form submission
	async function handleSubmit(): Promise<void> {
		try {
			if (!eventName) throw new Error('Please enter an event name');
			if (selectedDates.length === 0) throw new Error('Please select at least one date');
			if (selectedTimes.length === 0) throw new Error('Please select at least one time slot');

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

			await response.json();
			const shareLink = `${window.location.origin}/events/${eventId}`;
			// Removed alert for success message
			// alert(`Event created! Share this link: ${shareLink}`);
			window.location.href = `/events/${eventId}`;
		} catch (error) {
			console.error('Error:', error);
			// Removed alert for error message
			alert(error instanceof Error ? error.message : 'Failed to create event. Please try again.');
		}
	}

	// Using $derived instead of $: for reactive declarations
	let calendarDays = $derived(generateCalendarDays(currentMonth));
	let timeSlots = $derived(generateTimeSlots(startTime, endTime, timeInterval));

	// Add a derived value for sorted dates
	let sortedSelectedDates = $derived([...selectedDates].sort((a, b) => a.getTime() - b.getTime()));
</script>

<!-- Rest of the template code remains the same -->

<div class="flex min-h-screen flex-col">
	<Header />

	<main class="container mx-auto max-w-4xl flex-1 py-8">
		<div class="grid gap-8">
			<!-- Event Name Input -->
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
						<!-- Calendar Navigation -->
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

						<!-- Calendar Grid -->
						<div class="grid grid-cols-7 gap-1" role="grid">
							{#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
								<div class="p-2 text-center text-sm font-medium" role="columnheader">{day}</div>
							{/each}

							{#each calendarDays as { date, isCurrentMonth }}
								<button
									class="aspect-square rounded-md p-2 text-center text-sm
                                        {isCurrentMonth ? '' : 'text-gray-400'}
                                        {isDateSelected(date)
										? 'bg-green-500 text-white hover:bg-green-600'
										: 'hover:bg-gray-100'}"
									onclick={() => toggleDateSelection(date)}
									aria-label={format(date, 'MMMM d, yyyy')}
									aria-pressed={isDateSelected(date)}
								>
									{format(date, 'd')}
								</button>
							{/each}
						</div>
					</div>

					<!-- Selected Dates Display -->
					<!-- In the template, replace the selectedDates.sort() with sortedSelectedDates -->
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
						<!-- Time Range Controls -->
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

						<!-- Time Slots Grid -->
						<div class="grid max-h-[400px] grid-cols-2 gap-2 overflow-y-auto p-2">
							{#each timeSlots as time}
								<button
									class="rounded-md border p-2 text-sm transition-colors
                                        {selectedTimes.includes(time)
										? 'border-green-500 bg-green-500 text-white hover:bg-green-600'
										: 'border-gray-200 hover:bg-gray-50'}"
									onclick={() => toggleTimeSelection(time)}
									aria-pressed={selectedTimes.includes(time)}
								>
									{formatTime(time)}
								</button>
							{/each}
						</div>
					</div>
				</div>
			</div>

			<!-- Submit Button -->
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
