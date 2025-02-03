<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	interface Cell {
		row: number;
		col: number;
		date: number;
		selected: boolean;
	}

	interface Row {
		month: string;
		cells: Cell[];
	}

	const weeks = [1, 2, 3, 4, 5];
	let grid: Row[] = weeks.map((week) => ({
		month: 'Feb',
		cells: Array.from({ length: 7 }, (_, i) => ({
			row: week,
			col: i + 1,
			date: (week - 1) * 7 + (i + 1),
			selected: false
		}))
	}));

	// Drag state variables.
	let isDragging = false;
	let dragStart: { row: number; col: number } | null = null;
	let dragMode: 'select' | 'deselect' | null = null;
	let dragged = false;
	let dragRange: { minRow: number; maxRow: number; minCol: number; maxCol: number } | null = null;
	let rafPending = false; // Throttling flag

	function handleMouseDown(cell: Cell, event: MouseEvent) {
		isDragging = true;
		dragStart = { row: cell.row, col: cell.col };
		dragged = false;
		dragMode = cell.selected ? 'deselect' : 'select';
		// Initialize the drag preview to the starting cell.
		dragRange = { minRow: cell.row, maxRow: cell.row, minCol: cell.col, maxCol: cell.col };
	}

	function handleMouseMove(event: MouseEvent) {
		if (!isDragging || !dragStart) return;
		if (rafPending) return;

		rafPending = true;
		requestAnimationFrame(() => {
			rafPending = false;
			const targetElement = (event.target as HTMLElement).closest('.cell');
			// Only update if we have valid cell data.
			if (targetElement instanceof HTMLElement && targetElement.dataset.row && targetElement.dataset.col) {
				const row = Number(targetElement.dataset.row);
				const col = Number(targetElement.dataset.col);
				const newDragRange = {
					minRow: Math.min(dragStart!.row, row),
					maxRow: Math.max(dragStart!.row, row),
					minCol: Math.min(dragStart!.col, col),
					maxCol: Math.max(dragStart!.col, col)
				};
				// Update dragRange only if values have changed.
				if (
					!dragRange ||
					newDragRange.minRow !== dragRange.minRow ||
					newDragRange.maxRow !== dragRange.maxRow ||
					newDragRange.minCol !== dragRange.minCol ||
					newDragRange.maxCol !== dragRange.maxCol
				) {
					dragRange = newDragRange;
					// Mark that a drag is in progress (beyond a simple click).
					if (row !== dragStart!.row || col !== dragStart!.col) {
						dragged = true;
					}
				}
			}
		});
	}

	function handleMouseUp() {
		if (!isDragging || !dragRange) {
			resetDrag();
			return;
		}
		// Apply the final selection/deselection only after the drag is complete.
		grid = grid.map((rowData) => ({
			month: rowData.month,
			cells: rowData.cells.map((cell) => {
				if (
					cell.row >= dragRange!.minRow &&
					cell.row <= dragRange!.maxRow &&
					cell.col >= dragRange!.minCol &&
					cell.col <= dragRange!.maxCol
				) {
					return { ...cell, selected: dragMode === 'select' };
				}
				return cell;
			})
		}));
		resetDrag();
	}

	function resetDrag() {
		isDragging = false;
		dragStart = null;
		dragMode = null;
		dragged = false;
		dragRange = null;
	}

	function toggleCell(cell: Cell) {
		// If a drag is in progress, ignore the click.
		if (dragged) return;
		grid = grid.map((rowData) => ({
			month: rowData.month,
			cells: rowData.cells.map((c) => {
				if (c.row === cell.row && c.col === cell.col) {
					return { ...c, selected: !c.selected };
				}
				return c;
			})
		}));
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
</script>

<div
	class="calendar"
	role="grid"
	tabindex="0"
	aria-label="Calendar Selection Grid"
	on:mousemove={handleMouseMove}
>
	<!-- Header Row -->
	<div class="cell header"></div>
	<div class="cell header">S</div>
	<div class="cell header">M</div>
	<div class="cell header">T</div>
	<div class="cell header">W</div>
	<div class="cell header">T</div>
	<div class="cell header">F</div>
	<div class="cell header">S</div>

	<!-- Calendar Rows -->
	{#each grid as rowData}
		<div class="cell month-label" role="rowheader">{rowData.month}</div>
		{#each rowData.cells as cell}
			<!-- The dynamic class below provides visual feedback during dragging -->
			<div
				class="cell {cell.selected ? 'selected' : ''} {isDragging && dragRange && cell.row >= dragRange.minRow && cell.row <= dragRange.maxRow && cell.col >= dragRange.minCol && cell.col <= dragRange.maxCol ? (dragMode === 'select' ? 'drag-select' : 'drag-deselect') : ''}"
				data-row={cell.row}
				data-col={cell.col}
				role="gridcell"
				tabindex="0"
				aria-selected={cell.selected}
				aria-label="Select {cell.date}"
				on:mousedown={(e) => handleMouseDown(cell, e)}
				on:click={() => toggleCell(cell)}
			>
				{cell.date}
			</div>
		{/each}
	{/each}
</div>

<style>
	.calendar {
		display: grid;
		grid-template-columns: 60px repeat(7, 42px);
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
		background-color: white;
		position: relative;
		transition: background-color 0.2s, border 0.2s;
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
	.selected {
		background-color: #10b981;
		color: white;
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
	/* Optional: you can add a subtle overlay effect during drag */
	.drag-select::after,
	.drag-deselect::after {
		content: "";
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
