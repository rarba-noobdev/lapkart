<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Search } from '@lucide/svelte';

	let {
		placeholder = 'Search parts',
		size = 'md',
		class: className = ''
	}: {
		placeholder?: string;
		size?: 'md' | 'lg';
		class?: string;
	} = $props();

	let query = $state('');

	async function submitSearch(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = query.trim();
		await goto(resolve(trimmed ? `/products?q=${encodeURIComponent(trimmed)}` : '/products'));
	}
</script>

<form onsubmit={submitSearch} class={className}>
	<label
		class={[
			'group flex items-center overflow-hidden rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] transition-[border-color,background-color,box-shadow] focus-within:border-[var(--heat-100)] focus-within:bg-white focus-within:shadow-[0_0_0_3px_var(--heat-12)]',
			size === 'lg' ? 'h-11' : 'h-10'
		]}
	>
		<span class="sr-only">Search laptop parts</span>
		<Search
			class="ml-3 size-[15px] text-[var(--black-alpha-40)] transition-colors group-focus-within:text-[var(--heat-100)]"
		/>
		<input
			bind:value={query}
			type="search"
			name="q"
			autocomplete="off"
			aria-label="Search laptop parts"
			{placeholder}
			class="text-body-medium h-full flex-1 border-none bg-transparent px-3 outline-none placeholder:text-[var(--black-alpha-48)]"
		/>
	</label>
</form>
