<script lang="ts">
    import Footer from '$lib/Footer.svelte';
    import Header from '$lib/Header.svelte';
    import { format } from 'date-fns';
    import { v4 as uuidv4 } from 'uuid';
    import { onMount } from 'svelte';

    // Types and Constants
    interface TimeZone {
        value: string;
        label: string;
    }

    const TIME_INTERVAL: number = 30;
    const DEFAULT_START_TIME: string = '09:00';
    const DEFAULT_END_TIME: string = '17:00';
    const daysOfWeek = ['', 'S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const weeks = [1, 2, 3, 4, 5];

    // State management
    let eventName: string = $state('');
    let currentMonth: Date = $state(new Date());
    let selectedDates = new Set<string>();
    let selectedTimes: string[] = $state([]);
    let startTime: string = $state(DEFAULT_START_TIME);
    let endTime: string = $state(DEFAULT_END_TIME);
    let selectedTimeZone: string = $state(Intl.DateTimeFormat().resolvedOptions().timeZone);

    // Calendar drag state
    let isDragging = false;
    let dragStart: HTMLDivElement | null = null;
    let dragMode: 'select' | 'deselect' | null = null;
    let cells: (HTMLDivElement | null)[][] = [];
    let rafPending = false;
    let dragged = false;

    // Derived state
    let selectedTimesSet: Set<string> = $derived(new Set(selectedTimes));
    let timeSlots: { time: string; formatted: string }[] = $derived(
        generateTimeSlots(startTime, endTime, TIME_INTERVAL)
    );

    // Time zones
    const timeZones: TimeZone[] = Intl.supportedValuesOf('timeZone').map((tz: string) => ({
        value: tz,
        label: tz.replace(/_/g, ' ')
    }));

    onMount(() => {
        // Initialize cells array
        document.querySelectorAll('.cell:not(.header):not(.month-label)').forEach((cell) => {
            const row = parseInt(cell.getAttribute('data-row') || '0');
            const col = parseInt(cell.getAttribute('data-col') || '0');
            if (!cells[row]) cells[row] = [];
            cells[row][col] = cell as HTMLDivElement;
        });

        document.addEventListener('mouseup', handleDragEnd);
        return () => document.removeEventListener('mouseup', handleDragEnd);
    });

    function handleDragStart(e: MouseEvent) {
        const cell = (e.target as HTMLElement).closest(
            '.cell:not(.header):not(.month-label)'
        ) as HTMLDivElement | null;
        if (!cell) return;

        isDragging = true;
        dragStart = cell;
        dragged = false;
        dragMode = cell.classList.contains('selected') ? 'deselect' : 'select';
    }

    function handleDragMove(e: MouseEvent) {
        if (!isDragging || !dragStart) return;

        const cell = (e.target as HTMLElement).closest(
            '.cell:not(.header):not(.month-label)'
        ) as HTMLDivElement | null;
        if (!cell) return;

        if (cell !== dragStart) {
            dragged = true;
        }

        clearDragStyling();

        const cellsInRange = getCellsInRange(dragStart, cell);
        cellsInRange.forEach((cell) => {
            cell.classList.add(dragMode === 'select' ? 'drag-select' : 'drag-deselect');
        });
    }

    function handleDragEnd() {
        if (!isDragging) return;

        const selectElements = Array.from(document.querySelectorAll('.drag-select'));
        const deselectElements = Array.from(document.querySelectorAll('.drag-deselect'));

        selectElements.forEach((cell) => cell.classList.add('transitioning'));
        deselectElements.forEach((cell) => cell.classList.add('transitioning'));

        selectElements.forEach((cell) => {
            const row = cell.getAttribute('data-row');
            const col = cell.getAttribute('data-col');
            if (row && col) {
                cell.classList.add('selected');
                selectedDates.add(`${row}-${col}`);
            }
        });

        deselectElements.forEach((cell) => {
            const row = cell.getAttribute('data-row');
            const col = cell.getAttribute('data-col');
            if (row && col) {
                cell.classList.remove('selected');
                selectedDates.delete(`${row}-${col}`);
            }
        });

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                selectElements.forEach((cell) => {
                    cell.classList.remove('drag-select', 'transitioning');
                });
                deselectElements.forEach((cell) => {
                    cell.classList.remove('drag-deselect', 'transitioning');
                });
            });
        });

        isDragging = false;
        dragStart = null;
        dragged = false;
    }

    function clearDragStyling() {
        document.querySelectorAll('.drag-select, .drag-deselect').forEach((cell) => {
            cell.classList.remove('drag-select', 'drag-deselect', 'transitioning');
        });
    }

    function getCellsInRange(start: HTMLDivElement, end: HTMLDivElement) {
        const cellsInRange: HTMLDivElement[] = [];
        const startRow = parseInt(start.getAttribute('data-row') || '0');
        const startCol = parseInt(start.getAttribute('data-col') || '0');
        const endRow = parseInt(end.getAttribute('data-row') || '0');
        const endCol = parseInt(end.getAttribute('data-col') || '0');

        const minRow = Math.min(startRow, endRow);
        const maxRow = Math.max(startRow, endRow);
        const minCol = Math.min(startCol, endCol);
        const maxCol = Math.max(startCol, endCol);

        for (let row = minRow; row <= maxRow; row++) {
            for (let col = minCol; col <= maxCol; col++) {
                const cell = cells[row]?.[col];
                if (cell) {
                    cellsInRange.push(cell);
                }
            }
        }
        return cellsInRange;
    }

    function toggleCell(e: MouseEvent) {
        if (dragged) return;
        const cell = e.currentTarget as HTMLDivElement;
        const row = cell.getAttribute('data-row');
        const col = cell.getAttribute('data-col');

        if (row && col) {
            if (cell.classList.contains('selected')) {
                cell.classList.remove('selected');
                selectedDates.delete(`${row}-${col}`);
            } else {
                cell.classList.add('selected');
                selectedDates.add(`${row}-${col}`);
            }
        }
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleCell(e as unknown as MouseEvent);
        }
    }

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

    function toggleTimeSelection(time: string): void {
        if (selectedTimesSet.has(time)) {
            selectedTimes = selectedTimes.filter((t) => t !== time);
        } else {
            selectedTimes = [...selectedTimes, time];
        }
    }

    const navigationHandlers = {
        today: () => (currentMonth = new Date()),
        previousMonth: () =>
            (currentMonth = new Date(currentMonth.setMonth(currentMonth.getMonth() - 1))),
        nextMonth: () => (currentMonth = new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))
    };

    async function handleSubmit(): Promise<void> {
        if (!eventName || selectedDates.size === 0 || selectedTimes.length === 0) {
            alert('Please fill in all required fields');
            return;
        }

        const eventData = {
            id: uuidv4(),
            name: eventName,
            dates: Array.from(selectedDates),
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
            <div class="shadow-xs h-fit rounded-lg border border-gray-200 bg-white p-4 md:w-80">
                <div class="mb-3 flex items-center justify-between">
                    <button
                        class="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
                        aria-label="Previous Month"
                        onclick={navigationHandlers.previousMonth}
                    >
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
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
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>

                <div
                    class="calendar"
                    role="grid"
                    tabindex="0"
                    aria-label="Calendar Selection Grid"
                    onmousedown={handleDragStart}
                    onmousemove={(e) => {
                        if (!isDragging) return;
                        if (!rafPending) {
                            rafPending = true;
                            requestAnimationFrame(() => {
                                handleDragMove(e);
                                rafPending = false;
                            });
                        }
                    }}
                >
                    {#each daysOfWeek as day}
                        <div class="cell header" role="columnheader">{day}</div>
                    {/each}

                    {#each weeks as week}
                        <div class="cell month-label" role="rowheader">
                            {format(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), (week - 1) * 7 + 1), 'MMM')}
                        </div>
                        {#each Array(7) as _, i}
                            {@const date = (week - 1) * 7 + (i + 1)}
                            <div
                                class="cell {selectedDates.has(`${week}-${i + 1}`) ? 'selected' : ''}"
                                data-row={week}
                                data-col={i + 1}
                                role="gridcell"
                                tabindex="0"
                                onclick={toggleCell}
                                onkeydown={handleKeyDown}
                                aria-selected={selectedDates.has(`${week}-${i + 1}`)}
                                aria-label={`Select ${date}`}
                            >
                                {date}
                            </div>
                        {/each}
                    {/each}
                </div>
            </div>

            <div class="shadow-xs w-96 rounded-lg border border-gray-200 bg-white p-6">
                <div class="mb-6 grid grid-cols-2 gap-4">
                    <div>
                        <label for="startTime" class="mb-2 block text-sm font-medium text-gray-700">Start Time</label>
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
                        <label for="endTime" class="mb-2 block text-sm font-medium text-gray-700">End Time</label>
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
                    <label for="timezone" class="mb-2 block text-sm font-medium text-gray-700">Time Zone</label>
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
                disabled={!eventName || selectedDates.size === 0 || selectedTimes.length === 0}
            >
                Create Event
            </button>
        </div>
    </main>

    <Footer />
</div>

<style>
    .calendar {
        display: grid;
        grid-template-columns: 60px repeat(7, 40px);
        gap: 1px;
        padding: 10px;
        user-select: none;
    }

    .cell {
        width: 40px;
        height: 40px;
        border: 1px solid #ccc;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 2;
        position: relative;
    }

    .header {
        font-weight: bold;
        background-color: #f0f0f0;
        cursor: default;
    }

    .month-label {
        text-align: right;
        padding-right: 10px;
    }

    :global(.selected) {
        color: white;
        transition: background-color 0.15s ease-out;
        background-color: #10b981;
    }

    :global(.drag-select),
    :global(.drag-deselect) {
        border: none;
    }

    :global(.drag-select),
    :global(.transitioning.drag-select) {
        color: white;
        background-color: #10b981;
    }

    :global(.drag-deselect),
    :global(.transitioning.drag-deselect) {
        color: black;
        background-color: rgb(236, 225, 225);
    }

    :global(.drag-select)::after,
    :global(.drag-deselect)::after,
    :global(.transitioning.drag-select)::after,
    :global(.transitioning.drag-deselect)::after {
        content: '';
        position: absolute;
        top: -2px;
        left: -2px;
        right: -2px;
        bottom: -2px;
        z-index: -1;
        pointer-events: none;
        transition: opacity 0.15s ease-out;
    }

    :global(.transitioning)::after {
        opacity: 1;
    }
</style>