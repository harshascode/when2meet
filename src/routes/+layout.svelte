<script lang="ts">
	import Footer from '$lib/Footer.svelte';
	import Header from '$lib/Header.svelte';
	import '../app.css';
	let { children } = $props();
</script>

<Header />
{@render children()}
<Footer />
