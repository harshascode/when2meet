<script lang="ts">
	import { onMount } from 'svelte';

	let isDragging = false;
	let dragStart: HTMLDivElement | null = null;
	let dragMode: 'select' | 'deselect' | null = null;
	let selectedDates = new Set<string>();
	let cells: (HTMLDivElement | null)[][] = [];
	let rafPending = false;
	let dragged = false;

	const daysOfWeek = ['', 'S', 'M', 'T', 'W', 'T', 'F', 'S'];
	const weeks = [1, 2, 3, 4, 5];

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

	function handleDragStart(e: MouseEvent & { currentTarget: HTMLDivElement }) {
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

		// Store the elements we need to update
		const selectElements = Array.from(document.querySelectorAll('.drag-select'));
		const deselectElements = Array.from(document.querySelectorAll('.drag-deselect'));

		// Add a temporary class to maintain the background during transition
		selectElements.forEach((cell) => cell.classList.add('transitioning'));
		deselectElements.forEach((cell) => cell.classList.add('transitioning'));

		// Update the selected state
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

		// Remove drag classes after a brief delay
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
</script>

<div
	class="calendar"
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
	role="grid"
	tabindex="0"
	aria-label="Calendar Selection Grid"
>
	<!-- Header Row -->
	{#each daysOfWeek as day}
		<div class="cell header" role="columnheader">{day}</div>
	{/each}

	<!-- Calendar Rows -->
	{#each weeks as week}
		<!-- Month Label -->
		<div class="cell month-label" role="rowheader">Feb</div>

		<!-- Date Cells -->
		{#each Array(7) as _, i}
			{@const date = (week - 1) * 7 + (i + 1)}
			<div
				class="cell"
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
	}

	:global(.drag-deselect),
	:global(.transitioning.drag-deselect) {
		color: black;
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

	:global(.drag-select)::after,
	:global(.transitioning.drag-select)::after {
		background-color: #10b981;
	}

	:global(.drag-deselect)::after,
	:global(.transitioning.drag-deselect)::after {
		background-color: rgb(236, 225, 225);
	}

	:global(.transitioning)::after {
		opacity: 1;
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
</style>
