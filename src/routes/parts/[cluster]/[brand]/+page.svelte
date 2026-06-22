<script lang="ts">
	import LandingPage from '$lib/components/LandingPage.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<LandingPage view={data.view} />
