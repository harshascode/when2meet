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

    // State management
    let eventName = $state('');
    let currentMonth = $state(new Date());
    let selectedDates: Date[] = $state([]);
    let startTime = $state('09:00');
    let endTime = $state('17:00');
    let selectedTimes: string[] = $state([]);
    const timeInterval = 30;

    // Drag-to-select state
    let isDragging = $state(false);
    let startDragDate: Date | null = $state(null);

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

    // Drag-to-select functions
    function handleMouseDown(date: Date): void {
        isDragging = true;
        startDragDate = date;
        toggleDateSelection(date);
    }

    function handleMouseOver(date: Date): void {
        if (isDragging && startDragDate) {
            const allDates = calendarDays.map((day) => day.date);
            const startIndex = allDates.findIndex((d) => isSameDay(d, startDragDate!));
            const endIndex = allDates.findIndex((d) => isSameDay(d, date));

            if (startIndex !== -1 && endIndex !== -1) {
                const startRow = Math.floor(startIndex / 7);
                const startCol = startIndex % 7;
                const endRow = Math.floor(endIndex / 7);
                const endCol = endIndex % 7;

                // Select vertically (same column)
                if (startCol === endCol) {
                    for (let row = Math.min(startRow, endRow); row <= Math.max(startRow, endRow); row++) {
                        const index = row * 7 + startCol;
                        if (index >= 0 && index < allDates.length) {
                            toggleDateSelection(allDates[index]);
                        }
                    }
                }
                // Select horizontally (same row)
                else if (startRow === endRow) {
                    for (let col = Math.min(startCol, endCol); col <= Math.max(startCol, endCol); col++) {
                        const index = startRow * 7 + col;
                        if (index >= 0 && index < allDates.length) {
                            toggleDateSelection(allDates[index]);
                        }
                    }
                }
            }
        }
    }

    function handleMouseUp(): void {
        isDragging = false;
        startDragDate = null;
    }

    const today = () => (currentMonth = new Date());
    const previousMonth = () => (currentMonth = new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)));
    const nextMonth = () => (currentMonth = new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)));

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
            timeSlots: selectedTimes
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

    let calendarDays = $derived(generateCalendarDays(currentMonth));
    let timeSlots = $derived(generateTimeSlots(startTime, endTime, timeInterval));
    let sortedSelectedDates = $derived([...selectedDates].sort((a, b) => a.getTime() - b.getTime()));
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
    <Header />

    <main class="container mx-auto max-w-6xl px-4 py-8">
        <!-- Event Name Input -->
        <div class="max-w-2xl mx-auto mb-10">
            <input
                type="text"
                placeholder="Enter event name"
                class="w-full px-6 py-4 text-xl text-center bg-white/80 backdrop-blur-sm 
                rounded-xl shadow-sm border border-gray-200 
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                transition-all duration-200"
                bind:value={eventName}
            />
        </div>

        <div class="grid lg:grid-cols-2 gap-6">
            <!-- Calendar Card -->
            <div class="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 p-6">
                <div class="flex items-center justify-between mb-6">
                    <button
                        class="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        aria-label="Previous Month"
                        onclick={previousMonth}
                    >
                        <svg class="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                        </svg>
                    </button>
                    
                    <h2 class="text-xl font-medium text-gray-800">
                        {format(currentMonth, 'MMMM yyyy')}
                    </h2>

                    <button
                        class="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        aria-label="Next Month"
                        onclick={nextMonth}
                    >
                        <svg class="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                        </svg>
                    </button>
                </div>

                <div class="grid grid-cols-7 gap-1">
                    {#each ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as day}
                        <div class="text-center text-sm font-medium text-gray-500 py-2">{day}</div>
                    {/each}

                    {#each calendarDays as day (day.date.getTime())}
                        <!-- svelte-ignore a11y_mouse_events_have_key_events -->
                        <button
                            class="aspect-square rounded-lg text-sm font-medium
                                {!day.isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                                {day.isToday ? 'ring-2 ring-blue-400' : ''}
                                {selectedDatesSet.has(day.date.getTime())
                                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                                    : 'hover:bg-blue-50'}"
                            onmousedown={() => handleMouseDown(day.date)}
                            onmouseover={() => handleMouseOver(day.date)}
                            onmouseup={handleMouseUp}
                        >
                            {day.dayLabel}
                        </button>
                    {/each}
                </div>

                {#if selectedDates.length > 0}
                    <div class="mt-4 flex flex-wrap gap-2">
                        {#each sortedSelectedDates as date}
                            <span class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-full">
                                {format(date, 'MMM d')}
                            </span>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Time Selection Card -->
            <div class="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 p-6">
                <div class="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <label for="startTime" class="block text-sm text-gray-600 mb-1">Start</label>
                        <input
                            id="startTime"
                            type="time"
                            bind:value={startTime}
                            class="w-full px-3 py-2 rounded-lg border border-gray-200 
                            focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label for="endTime" class="block text-sm text-gray-600 mb-1">End</label>
                        <input
                            id="endTime"
                            type="time"
                            bind:value={endTime}
                            class="w-full px-3 py-2 rounded-lg border border-gray-200 
                            focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[360px] overflow-y-auto">
                    {#each timeSlots as timeSlot (timeSlot.time)}
                        <button
                            class="px-4 py-2 rounded-lg text-sm font-medium
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
                class="px-8 py-3 bg-blue-600 text-white text-lg font-medium rounded-xl
                hover:bg-blue-700 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!eventName || selectedDates.length === 0 || selectedTimes.length === 0}
            >
                Create Event
            </button>
        </div>
    </main>

    <Footer />
</div>