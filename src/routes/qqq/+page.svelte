<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	// Extend Cell interface to include inCurrentMonth.
	interface Cell {
		row: number;
		col: number;
		date: number;
		selected: boolean;
		active: boolean;
		inCurrentMonth: boolean;
	}

	// State management using Svelte 5's state() function
	let { currentYear, currentMonth, grid, isDragging, dragMode, dragRange } = $state({
		currentYear: new Date().getFullYear(),
		currentMonth: new Date().getMonth(), // 0 = January, etc.
		grid: [] as Cell[][],
		isDragging: false,
		dragMode: null as 'select' | 'deselect' | null,
		dragRange: null as { minRow: number; maxRow: number; minCol: number; maxCol: number } | null
	});

	// Local non-state variables
	let dragStart: { row: number; col: number } | null = null;
	let dragged = false;
	let pendingDragUpdate = false;
	let startX = 0;
	let startY = 0;
	const dragThreshold = 5; // pixels
	const dragThresholdSq = dragThreshold * dragThreshold; // squared threshold

	// Utility to get the full month name.
	function getMonthName(year: number, month: number): string {
		return new Date(year, month, 1).toLocaleString('default', { month: 'long' });
	}

	// Build a grid (2D array) for the current month.
	function generateCalendarGrid(year: number, month: number): Cell[][] {
		const firstDay = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		// Get previous month details.
		const prevMonth = month === 0 ? 11 : month - 1;
		const prevYear = month === 0 ? year - 1 : year;
		const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
		// Determine number of weeks needed.
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
						active: true, // Allow selection
						inCurrentMonth: false
					});
				} else if (currentDate > daysInMonth) {
					// Days from next month.
					row.push({
						row: week + 1,
						col: col + 1,
						date: nextDate++,
						selected: false,
						active: true, // Allow selection
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

	// Use $effect instead of run()
	$effect(() => {
		grid = generateCalendarGrid(currentYear, currentMonth);
	});

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
			grid = grid.map((row) =>
				row.map((cell) => ({
					...cell,
					selected:
						cell.row >= dragRange!.minRow &&
						cell.row <= dragRange!.maxRow &&
						cell.col >= dragRange!.minCol &&
						cell.col <= dragRange!.maxCol
							? dragMode === 'select'
							: cell.selected
				}))
			);
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
	}

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

	// Month navigation functions.
	function prevMonth() {
		if (currentMonth === 0) {
			currentYear--;
			currentMonth = 11;
		} else {
			currentMonth--;
		}
	}

	function nextMonth() {
		if (currentMonth === 11) {
			currentYear++;
			currentMonth = 0;
		} else {
			currentMonth++;
		}
	}

	// Weekday headers.
	const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
</script>

<div class="calendar-container">
	<div class="calendar-header">
		<button class="nav-button" onclick={prevMonth} aria-label="Previous Month">&lt;</button>
		<h2>{getMonthName(currentYear, currentMonth)} {currentYear}</h2>
		<button class="nav-button" onclick={nextMonth} aria-label="Next Month">&gt;</button>
	</div>
	<div
		class="calendar"
		role="grid"
		tabindex="0"
		aria-label="Calendar Selection Grid"
		onmousemove={handleMouseMove}
	>
		<!-- Weekday header row -->
		{#each days as day}
			<div class="cell header">{day}</div>
		{/each}
		<!-- Calendar date rows -->
		{#each grid as row}
			{#each row as cell}
				<div
					class="cell {cell.selected ? 'selected' : ''} {cell.inCurrentMonth
						? ''
						: 'other-month'} {isDragging &&
					dragRange &&
					cell.row >= dragRange.minRow &&
					cell.row <= dragRange.maxRow &&
					cell.col >= dragRange.minCol &&
					cell.col <= dragRange.maxCol
						? dragMode === 'select'
							? 'drag-select'
							: 'drag-deselect'
						: ''}"
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

<style>
	.calendar-container {
		max-width: 350px;
		margin: 0 auto;
		font-family: sans-serif;
	}
	.calendar-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10px;
	}
	.nav-button {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
	}
	.calendar {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
		user-select: none;
		padding: 5px;
		background-color: #ddd;
	}
	.cell {
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: white;
		border: 1px solid #ccc;
		cursor: pointer;
		position: relative;
		transition:
			background-color 0.2s,
			border 0.2s;
	}
	.header {
		font-weight: bold;
		background-color: #f0f0f0;
		cursor: default;
	}
	.selected {
		background-color: #10b981;
		color: white;
	}
	.other-month {
		opacity: 0.5;
	}
	.drag-select,
	.drag-deselect {
		border: none;
	}
	.drag-select {
		color: white;
		background-color: #10b981;
	}
	.drag-deselect {
		color: black;
		background-color: #efe7e7;
	}
	.drag-select::after,
	.drag-deselect::after {
		content: '';
		position: absolute;
		top: -1.5px;
		left: -1.5px;
		right: -1.5px;
		bottom: -1.5px;
		z-index: -1;
		pointer-events: none;
	}
	.drag-select::after {
		background-color: #10b981;
	}
	.drag-deselect::after {
		background-color: white;
	}
</style>
