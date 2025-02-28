<script lang="ts">
	import { onMount } from 'svelte';

	let isOpen = $state(false);

	function toggleMenu(event: Event) {
		event.stopPropagation();
		isOpen = !isOpen;
	}

	function closeMenu() {
		isOpen = false;
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape' && isOpen) {
			closeMenu();
		}
	}

	// Close menu on route change
	onMount(() => {
		return () => {
			isOpen = false;
		};
	});
</script>

<header class="fixed top-0 z-50 w-full bg-white shadow-sm">
	<div class="container mx-auto px-4">
		<div class="relative flex h-16 items-center justify-between">
			<!-- Logo -->
			<a href="/" class="flex items-center space-x-2">
				<svg class="h-6 w-6 text-slate-800" viewBox="0 0 24 24" fill="none" stroke="currentColor">
					<rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke-width="2" />
					<line x1="3" y1="10" x2="21" y2="10" stroke-width="2" />
					<line x1="16" y1="2" x2="16" y2="6" stroke-width="2" />
					<line x1="8" y1="2" x2="8" y2="6" stroke-width="2" />
				</svg>
				<span class="text-lg font-semibold text-slate-900">When2meet</span>
			</a>

			<!-- Desktop Navigation -->
			<nav class="hidden items-center space-x-8 md:flex">
				<a href="/my-events" class="text-sm font-medium text-slate-600 hover:text-slate-900">
					My Events
				</a>
				<a
					href="/"
					class="rounded-sm bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
				>
					Create Event
				</a>
			</nav>

			<!-- Mobile Menu Button -->
			<button
				class="rounded p-1 hover:bg-slate-100 md:hidden"
				onclick={toggleMenu}
				aria-label="Menu"
			>
				<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					{#if isOpen}
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					{:else}
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 6h16M4 12h16M4 18h16"
						/>
					{/if}
				</svg>
			</button>
		</div>

		<!-- Mobile Menu -->
		{#if isOpen}
			<div
				class="absolute top-16 right-0 left-0 border-b border-slate-200 bg-white shadow-lg"
				onkeydown={handleKeyDown}
				role="menu"
				tabindex="-1"
			>
				<nav class="flex flex-col">
					
					<a
						href="/my-events"
						class="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
						onclick={() => closeMenu()}
					>
						My Events
					</a>
					<div class="p-4">
						<a
							href="/"
							class="block w-full rounded-sm bg-slate-800 px-4 py-2 text-center text-sm font-medium text-white hover:bg-slate-700"
							onclick={() => closeMenu()}
						>
							Create Event
						</a>
					</div>
				</nav>
			</div>
		{/if}
	</div>
</header>

<!-- Spacer to prevent content from going under fixed header -->
<div class="h-16"></div>

<style>
	/* Add any custom styles here if needed */
</style>
