<script lang="ts">
    import Footer from '$lib/Footer.svelte';
    import Header from '$lib/Header.svelte';
    import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';

    let eventName = '';
    let currentMonth = new Date();
    let selectedDates: Date[] = [];

    // Generate calendar days
    $: calendarDays = generateCalendarDays(currentMonth);

    function generateCalendarDays(date: Date) {
        const start = startOfMonth(date);
        const end = endOfMonth(date);
        const days = eachDayOfInterval({ start, end });

        // Get the day of the week for the first day (0 = Sunday)
        const firstDayOfWeek = start.getDay();

        // Add padding days at the start
        const paddingDays = Array(firstDayOfWeek)
            .fill(null)
            .map((_, index) => {
                const day = new Date(start);
                day.setDate(day.getDate() - (firstDayOfWeek - index));
                return { date: day, isCurrentMonth: false };
            });

        // Create the calendar days array
        const calendarDays = days.map(day => ({
            date: day,
            isCurrentMonth: true
        }));

        // Calculate padding needed at the end
        const lastDayOfWeek = end.getDay();
        const remainingDays = 6 - lastDayOfWeek;

        // Add padding days at the end
        const endPaddingDays = Array(remainingDays)
            .fill(null)
            .map((_, index) => {
                const day = new Date(end);
                day.setDate(day.getDate() + (index + 1));
                return { date: day, isCurrentMonth: false };
            });

        return [...paddingDays, ...calendarDays, ...endPaddingDays];
    }

    function toggleDateSelection(date: Date) {
        const index = selectedDates.findIndex(d => isSameDay(d, date));
        if (index === -1) {
            selectedDates = [...selectedDates, date];
        } else {
            selectedDates = selectedDates.filter((_, i) => i !== index);
        }
    }

    function isDateSelected(date: Date): boolean {
        return selectedDates.some(d => isSameDay(d, date));
    }

    function today() {
        currentMonth = new Date();
    }

    function previousMonth() {
        currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1);
    }

    function nextMonth() {
        currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
    }

	 // Time selection state
	 let startTime = '09:00';
    let endTime = '17:00';
    let selectedTimes: string[] = [];
    let timeInterval = 30; // minutes interval between time slots

    // Generate time slots based on start and end time
    $: timeSlots = generateTimeSlots(startTime, endTime, timeInterval);

    function generateTimeSlots(start: string, end: string, interval: number): string[] {
        const slots: string[] = [];
        const [startHours, startMinutes] = start.split(':').map(Number);
        const [endHours, endMinutes] = end.split(':').map(Number);
        
        const startInMinutes = startHours * 60 + startMinutes;
        const endInMinutes = endHours * 60 + endMinutes;
        
        for (let time = startInMinutes; time <= endInMinutes; time += interval) {
            const hours = Math.floor(time / 60);
            const minutes = time % 60;
            slots.push(
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
            );
        }
        
        return slots;
    }

    function toggleTimeSelection(time: string) {
        if (selectedTimes.includes(time)) {
            selectedTimes = selectedTimes.filter(t => t !== time);
        } else {
            selectedTimes = [...selectedTimes, time];
        }
    }

    function formatTime(time: string): string {
        const [hours, minutes] = time.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    }

    // Update the handleSubmit function to include time validation
    function handleSubmit() {
        if (!eventName) {
            alert('Please enter an event name');
            return;
        }
        if (selectedDates.length === 0) {
            alert('Please select at least one date');
            return;
        }
        if (selectedTimes.length === 0) {
            alert('Please select at least one time slot');
            return;
        }

        // Here you would handle the form submission
        console.log({
            eventName,
            selectedDates,
            selectedTimes
        });
    }
</script>

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
                />
            </div>

            <div class="grid gap-8 md:grid-cols-2">
                <!-- Dates Section -->
                <div class="space-y-4">
                    <h2 class="text-center text-lg font-medium">What dates might work?</h2>
                    <div class="space-y-2 text-center text-sm text-gray-500">
                        <p>Click dates to select or unselect them.</p>
                    </div>
                    <!-- Calendar Component -->
                    <div class="rounded-md border bg-white p-4">
                        <div class="mb-4 flex items-center justify-between">
                            <button
                                class="rounded-md px-3 py-1 hover:bg-gray-100"
                                on:click={previousMonth}
                            >
                                &larr;
                            </button>
                            <h3 class="text-lg font-medium">
                                {format(currentMonth, 'MMMM yyyy')}
                            </h3>
                            <button
                                class="rounded-md px-3 py-1 hover:bg-gray-100"
                                on:click={nextMonth}
                            >
                                &rarr;
                            </button>
                        </div>

                        <!-- Calendar Grid -->
                        <div class="grid grid-cols-7 gap-1">
                            <!-- Week day headers -->
                            {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
                                <div class="p-2 text-center text-sm font-medium">{day}</div>
                            {/each}

                            <!-- Calendar days -->
                            {#each calendarDays as { date, isCurrentMonth }}
                                <button
                                    class="aspect-square rounded-md p-2 text-center text-sm
                                        {isCurrentMonth ? '' : 'text-gray-400'}
                                        {isDateSelected(date) ? 'bg-green-500 text-white hover:bg-green-600' : 'hover:bg-gray-100'}"
                                    on:click={() => toggleDateSelection(date)}
                                >
                                    {format(date, 'd')}
                                </button>
                            {/each}
                        </div>
                    </div>

                    <div class="text-center">
                        <button
                            class="rounded-md border px-4 py-2 text-sm hover:bg-gray-100"
                            on:click={today}
                        >
                            Today
                        </button>
                    </div>

                    <!-- Selected Dates Display -->
                    <div class="mt-4 space-y-2">
                        <h3 class="text-sm font-medium">Selected Dates:</h3>
                        <div class="flex flex-wrap gap-2">
                            {#each selectedDates.sort((a, b) => a.getTime() - b.getTime()) as date}
                                <span class="rounded-full bg-green-100 px-3 py-1 text-sm text-green-800">
                                    {format(date, 'MMM d, yyyy')}
                                </span>
                            {/each}
                        </div>
                    </div>
                </div>

                <!-- Times Section -->
              <!-- Replace the Time Selector placeholder with this code -->
<div class="space-y-4">
    <h2 class="text-center text-lg font-medium">What times might work?</h2>
    <div class="rounded-md border bg-white p-4">
        <!-- Time Range Controls -->
        <div class="mb-4 flex justify-center gap-4">
            <div class="space-y-2">
                <label class="block text-sm font-medium text-gray-700">Start Time</label>
                <input
                    type="time"
                    bind:value={startTime}
                    class="rounded-md border border-gray-300 px-3 py-1.5"
                />
            </div>
            <div class="space-y-2">
                <label class="block text-sm font-medium text-gray-700">End Time</label>
                <input
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
                    on:click={() => toggleTimeSelection(time)}
                >
                    {formatTime(time)}
                </button>
            {/each}
        </div>
    </div>

    <!-- Selected Times Display -->
    <div class="mt-4 space-y-2">
        <h3 class="text-sm font-medium">Selected Time Slots:</h3>
        <div class="flex flex-wrap gap-2">
            {#each selectedTimes.sort() as time}
                <span class="rounded-full bg-green-100 px-3 py-1 text-sm text-green-800">
                    {formatTime(time)}
                </span>
            {/each}
        </div>
    </div>
</div>
            </div>

            <!-- Submit Button -->
            <div class="space-y-4 text-center">
                <div class="flex items-center justify-center gap-2">
                    <span class="text-lg font-medium">Ready?</span>
                    <button
                        type="submit"
                        class="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
                        disabled={selectedDates.length === 0 || !eventName}
                    >
                        Create Event
                    </button>
                </div>
            </div>
        </div>
    </main>

    <Footer />
</div>