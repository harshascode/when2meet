<script lang="ts">
    import { Calendar } from "$lib/components/ui/calendar";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import Header from '$lib/Header.svelte';
    import Footer from '$lib/Footer.svelte';
    import { v4 as uuidv4 } from 'uuid';

    // Event details state
    let eventName = $state('');
    let selectedDates: Date[] = $state([]);
    
    // Time selection state with simpler intervals
    let startTime = $state('09:00');
    let endTime = $state('17:00');
    let selectedTimes: string[] = $state([]);

    // Generate time slots in 30-minute intervals
    function generateTimeSlots(): string[] {
        const slots: string[] = [];
        const [startHours, startMinutes] = startTime.split(':').map(Number);
        const [endHours, endMinutes] = endTime.split(':').map(Number);
        
        const startInMinutes = startHours * 60 + startMinutes;
        const endInMinutes = endHours * 60 + endMinutes;
        
        for (let time = startInMinutes; time <= endInMinutes; time += 30) {
            const hours = Math.floor(time / 60);
            const minutes = time % 60;
            slots.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
        }
        
        return slots;
    }

    function toggleTimeSelection(time: string) {
        selectedTimes = selectedTimes.includes(time) 
            ? selectedTimes.filter(t => t !== time)
            : [...selectedTimes, time];
    }

    function formatTime(time: string): string {
        const [hours, minutes] = time.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    }

    async function handleSubmit() {
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

        const eventId = uuidv4();
        const eventData = {
            id: eventId,
            name: eventName,
            dates: selectedDates.map(date => date.toISOString()),
            timeSlots: selectedTimes
        };

        try {
            const response = await fetch('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(eventData)
            });

            if (!response.ok) throw new Error('Failed to create event');

            const shareLink = `${window.location.origin}/events/${eventId}`;
            alert(`Event created! Share this link: ${shareLink}`);
            window.location.href = `/events/${eventId}`;
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to create event. Please try again.');
        }
    }

    $derived: timeSlots = generateTimeSlots();
</script>

<div class="flex min-h-screen flex-col">
    <Header />
    
    <main class="container mx-auto max-w-4xl flex-1 py-8 px-4">
        <div class="space-y-8">
            <!-- Event Name Input -->
            <div class="text-center">
                <Input
                    type="text"
                    placeholder="New Event Name"
                    class="mx-auto w-full max-w-md text-center text-xl"
                    bind:value={eventName}
                />
            </div>

            <div class="grid gap-8 md:grid-cols-2">
                <!-- Date Selection -->
                <div class="space-y-4">
                    <h2 class="text-lg font-medium text-center">Select Dates</h2>
                    <Calendar
                        mode="multiple"
                        selected={selectedDates}
                        onSelect={(dates) => selectedDates = dates || []}
                        class="rounded-md border"
                    />
                </div>

                <!-- Time Selection -->
                <div class="space-y-4">
                    <h2 class="text-lg font-medium text-center">Select Times</h2>
                    
                    <div class="flex gap-4 justify-center mb-4">
                        <div class="space-y-2">
                            <label class="text-sm">Start Time</label>
                            <Input
                                type="time"
                                bind:value={startTime}
                                class="w-full"
                            />
                        </div>
                        <div class="space-y-2">
                            <label class="text-sm">End Time</label>
                            <Input
                                type="time"
                                bind:value={endTime}
                                class="w-full"
                            />
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto p-2">
                        {#each timeSlots as time}
                            <Button
                                variant={selectedTimes.includes(time) ? "default" : "outline"}
                                on:click={() => toggleTimeSelection(time)}
                                class="w-full"
                            >
                                {formatTime(time)}
                            </Button>
                        {/each}
                    </div>
                </div>
            </div>

            <!-- Submit Button -->
            <div class="text-center">
                <Button
                    variant="default"
                    size="lg"
                    on:click={handleSubmit}
                    disabled={!eventName || selectedDates.length === 0 || selectedTimes.length === 0}
                >
                    Create Event
                </Button>
            </div>
        </div>
    </main>

    <Footer />
</div>