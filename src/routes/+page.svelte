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
	const TIME_INTERVAL: number = 30;
	const DEFAULT_START_TIME: string = '09:00';
	const DEFAULT_END_TIME: string = '17:00';

	// State management
	let eventName: string = $state('');
	let currentMonth: Date = $state(new Date());
	let selectedDates: Date[] = $state([]);
	let selectedTimes: string[] = $state([]);
	let startTime: string = $state(DEFAULT_START_TIME);
	let endTime: string = $state(DEFAULT_END_TIME);
	let selectedTimeZone: string = $state(Intl.DateTimeFormat().resolvedOptions().timeZone);

	// Derived state
	let selectedDatesSet: Set<number> = $derived(
		new Set(selectedDates.map((d: Date) => d.getTime()))
	);
	let selectedTimesSet: Set<string> = $derived(new Set(selectedTimes));
	let calendarDays: CalendarDay[] = $derived(generateCalendarDays(currentMonth));
	let timeSlots: { time: string; formatted: string }[] = $derived(
		generateTimeSlots(startTime, endTime, TIME_INTERVAL)
	);
	let sortedSelectedDates: Date[] = $derived(
		[...selectedDates].sort((a: Date, b: Date) => a.getTime() - b.getTime())
	);

	// Time zones
	const timeZones: TimeZone[] = Intl.supportedValuesOf('timeZone').map((tz: string) => ({
		value: tz,
		label: tz.replace(/_/g, ' ')
	}));

	// Calendar functions
	function generateCalendarDays(date: Date): CalendarDay[] {
		const start: Date = startOfMonth(date);
		const end: Date = endOfMonth(date);
		const days: Date[] = eachDayOfInterval({ start, end });
		const firstDayOfWeek: number = start.getDay();
		const today: Date = new Date();

		const paddingDays: CalendarDay[] = Array(firstDayOfWeek)
			.fill(null)
			.map((_, index) => {
				const paddingDate: Date = new Date(start);
				paddingDate.setDate(start.getDate() - (firstDayOfWeek - index));
				return createCalendarDay(paddingDate, false, today);
			});

		const calendarDays: CalendarDay[] = days.map((day: Date) =>
			createCalendarDay(day, true, today)
		);

		const remainingDays: number = 6 - end.getDay();
		const endPaddingDays: CalendarDay[] = Array(remainingDays)
			.fill(null)
			.map((_, index) => {
				const paddingDate: Date = new Date(end);
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
	function generateTimeSlots(
		start: string,
		end: string,
		interval: number
	): { time: string; formatted: string }[] {
		const slots: { time: string; formatted: string }[] = [];
		for (let time = 0; time < 24 * 60; time += interval) {
			const hours: number = Math.floor(time / 60);
			const minutes: number = time % 60;
			const timeString: string = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
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

	function timeToMinutes(time: string): number {
		const [hours, minutes]: number[] = time.split(':').map(Number);
		return hours * 60 + minutes;
	}

	function updateSelectedTimeSlots(): void {
		const startMinutes: number = timeToMinutes(startTime);
		const endMinutes: number = timeToMinutes(endTime);

		selectedTimes = timeSlots
			.filter((slot) => {
				const slotMinutes: number = timeToMinutes(slot.time);
				return slotMinutes >= startMinutes && slotMinutes <= endMinutes;
			})
			.map((slot) => slot.time);
	}

	$effect(() => {
		if (startTime && endTime) {
			updateSelectedTimeSlots();
		}
	});

	const navigationHandlers = {
		today: () => (currentMonth = new Date()),
		previousMonth: () =>
			(currentMonth = new Date(currentMonth.setMonth(currentMonth.getMonth() - 1))),
		nextMonth: () => (currentMonth = new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))
	};

	function toggleDateSelection(date: Date): void {
		selectedDates = selectedDatesSet.has(date.getTime())
			? selectedDates.filter((d: Date) => !isSameDay(d, date))
			: [...selectedDates, date];
	}

	function toggleTimeSelection(time: string): void {
		selectedTimes = selectedTimesSet.has(time)
			? selectedTimes.filter((t: string) => t !== time)
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
			window.location.href = `/events/${eventData.id}`;
		} catch (error) {
			alert('Failed to create event. Please try again.');
		}
	}

	let isDragging: boolean = false;
	let dragMode: 'select' | 'deselect' | null = null;
	let dragStart: HTMLButtonElement | null = null;

	function handleDragStart(event: MouseEvent): void {
		const cell = (event.target as HTMLElement).closest('button');
		if (!cell) return;

		isDragging = true;
		dragStart = cell as HTMLButtonElement;
		dragMode = cell.classList.contains('bg-blue-600') ? 'deselect' : 'select';
	}

	function handleDragMove(event: MouseEvent): void {
		if (!isDragging) return;

		const cell = (event.target as HTMLElement).closest('button');
		if (!cell) return;

		clearDragStyling();

		const cells = getCellsInRange(dragStart!, cell as HTMLButtonElement);
		cells.forEach((cell) => {
			cell.classList.add(dragMode === 'select' ? 'drag-select' : 'drag-deselect');
		});
	}

	function handleDragEnd(): void {
		if (!isDragging) return;

		document.querySelectorAll('.drag-select').forEach((cell) => {
			cell.classList.add('bg-blue-600', 'text-white');

			const selectedDates = new Set<Date>();
			selectedDates.add(new Date((cell as HTMLButtonElement).dataset.date!));
		});
		document.querySelectorAll('.drag-deselect').forEach((cell) => {
			cell.classList.remove('bg-blue-600', 'text-white');
			const selectedDates = new Set<Date>();
			selectedDates.delete(new Date((cell as HTMLButtonElement).dataset.date!));
		});

		clearDragStyling();
		isDragging = false;
		dragStart = null;
	}

	function clearDragStyling(): void {
		document.querySelectorAll('.drag-select, .drag-deselect').forEach((cell) => {
			cell.classList.remove('drag-select', 'drag-deselect');
		});
	}

	function getCellsInRange(start: HTMLButtonElement, end: HTMLButtonElement): HTMLButtonElement[] {
		const cellsInRange: HTMLButtonElement[] = [];
		const startDate = new Date(start.dataset.date!);
		const endDate = new Date(end.dataset.date!);

		const minDate = startDate < endDate ? startDate : endDate;
		const maxDate = startDate > endDate ? startDate : endDate;

		calendarDays.forEach((day) => {
			const date = new Date(day.date);
			if (date >= minDate && date <= maxDate) {
				cellsInRange.push(
					document.querySelector(`[data-date="${date.toISOString()}"]`) as HTMLButtonElement
				);
			}
		});

		return cellsInRange;
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

				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="grid grid-cols-7 gap-1"
					onmousedown={handleDragStart}
					onmousemove={handleDragMove}
					onmouseup={handleDragEnd}
				>
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
							data-date={day.date}
							onclick={() => toggleDateSelection(day.date)}
						>
							{day.dayLabel}
						</button>
					{/each}
				</div>
			</div>

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
