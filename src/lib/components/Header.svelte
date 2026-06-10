<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { fly } from 'svelte/transition';
	import {
		Flame,
		ShoppingCart,
		User,
		LogOut,
		ShieldCheck,
		Package,
		ChevronDown
	} from '@lucide/svelte';
	import { getAuthContext } from '$lib/auth-context';
	import { cartState } from '$lib/cart';
	import { isStaffRole } from '$lib/roles';
	import SearchBar from '$lib/components/SearchBar.svelte';

	const auth = getAuthContext();

	let menuOpen = $state(false);

	const cartCount = $derived($cartState.items.reduce((sum, item) => sum + item.qty, 0));
	const activeUser = $derived(auth.user);
	const activeRole = $derived(auth.role);
	const isAdmin = $derived(isStaffRole(activeRole));

	function closeMenu() {
		menuOpen = false;
	}

	function closeOnOutside(node: HTMLElement) {
		const handleDocumentPointerDown = (event: PointerEvent) => {
			if (!menuOpen) return;
			const target = event.target;
			if (target instanceof Node && node.contains(target)) return;
			closeMenu();
		};

		const handleDocumentKeydown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') closeMenu();
		};

		document.addEventListener('pointerdown', handleDocumentPointerDown, true);
		document.addEventListener('keydown', handleDocumentKeydown);

		return {
			destroy() {
				document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
				document.removeEventListener('keydown', handleDocumentKeydown);
			}
		};
	}
</script>

<header
	class="motion-section sticky top-0 z-40 border-b border-[var(--border-faint)] bg-white/95 backdrop-blur-xl"
>
	<div class="hidden border-b border-white/8 bg-[var(--accent-black)] text-white/75 md:block">
		<div
			class="text-mono-x-small container mx-auto flex items-center justify-between gap-6 px-4 py-2"
		>
			<span class="text-white/70">
				{#if isAdmin}
					Admin workspace for catalog, users, orders, and fulfillment
				{:else}
					Free shipping on orders above Rs 999
				{/if}
			</span>
			<a
				href={resolve(isAdmin ? '/admin' : '/orders')}
				class="motion-soft-link transition-colors hover:text-[var(--heat-100)]"
			>
				{isAdmin ? 'Operations' : 'Track orders'}
			</a>
		</div>
	</div>

	<div class="container mx-auto flex items-center gap-4 px-4 py-3 sm:gap-8">
		<a
			href={resolve(isAdmin ? '/admin' : '/')}
			class="motion-soft-link group flex items-baseline gap-2"
		>
			<Flame
				class="size-5 -translate-y-px text-[var(--heat-100)] transition-transform group-hover:rotate-6"
				strokeWidth={2.4}
			/>
			<div class="leading-none">
				<span class="font-display text-[22px] font-medium tracking-[-0.02em] text-foreground">
					lap<span class="text-[var(--heat-100)]">kart</span>
				</span>
				<span class="text-mono-x-small ml-1.5 text-[var(--black-alpha-40)]">
					{isAdmin ? '/ops' : '/parts'}
				</span>
			</div>
		</a>

		<SearchBar
			size="lg"
			placeholder={isAdmin ? 'Search catalog' : 'Search parts'}
			class="hidden max-w-[520px] flex-1 md:block"
		/>

		<nav class="ml-auto flex items-center gap-1 sm:gap-3">
			<a
				href={resolve(isAdmin ? '/admin' : '/products')}
				class="motion-soft-link text-label-medium hidden min-h-11 items-center px-2 text-foreground/80 transition-colors hover:text-[var(--heat-100)] md:inline-flex"
			>
				{isAdmin ? 'Operations' : 'Shop'}
			</a>

			{#if activeUser}
				<div class="relative" use:closeOnOutside>
					<button
						type="button"
						class="motion-press text-label-small flex min-h-11 items-center gap-2 rounded-md px-2.5 py-1.5 text-foreground transition-colors hover:bg-[var(--black-alpha-4)]"
						aria-expanded={menuOpen}
						aria-haspopup="menu"
						onclick={() => (menuOpen = !menuOpen)}
					>
						<div
							class="text-mono-small grid size-7 place-items-center rounded-full bg-[var(--heat-100)] font-medium text-white"
						>
							{(activeUser.user_metadata?.full_name || activeUser.email || 'U')[0].toUpperCase()}
						</div>
						<span class="hidden max-w-[100px] truncate sm:inline">
							{(activeUser.user_metadata?.full_name || activeUser.email || '')
								.split(' ')[0]
								.split('@')[0]}
						</span>
						<ChevronDown class="size-3 text-[var(--black-alpha-40)]" />
					</button>

					{#if menuOpen}
						<div
							class="motion-popover absolute top-full right-0 mt-2 w-64 overflow-hidden rounded-lg border border-[var(--border-muted)] bg-white shadow-[var(--shadow-pop)]"
							transition:fly={{ y: -6, duration: 180 }}
						>
							<div class="border-b border-[var(--border-faint)] px-4 py-3">
								<p class="text-mono-x-small tracking-wider text-[var(--black-alpha-48)] uppercase">
									Signed in
								</p>
								<p class="text-label-small mt-0.5 truncate text-foreground">{activeUser.email}</p>
							</div>

							{#if isAdmin}
								<a
									href={resolve('/admin')}
									onclick={closeMenu}
									class="text-label-small flex items-center gap-3 px-4 py-2.5 text-foreground transition-colors hover:bg-[var(--heat-4)] hover:text-[var(--heat-100)]"
								>
									<ShieldCheck class="size-[15px] text-[var(--black-alpha-48)]" />
									Admin dashboard
								</a>
							{:else}
								<a
									href={resolve('/orders')}
									onclick={closeMenu}
									class="text-label-small flex items-center gap-3 px-4 py-2.5 text-foreground transition-colors hover:bg-[var(--heat-4)] hover:text-[var(--heat-100)]"
								>
									<Package class="size-[15px] text-[var(--black-alpha-48)]" />
									My orders
								</a>
								<a
									href={resolve('/profile')}
									onclick={closeMenu}
									class="text-label-small flex items-center gap-3 px-4 py-2.5 text-foreground transition-colors hover:bg-[var(--heat-4)] hover:text-[var(--heat-100)]"
								>
									<User class="size-[15px] text-[var(--black-alpha-48)]" />
									Customer dashboard
								</a>
							{/if}

							<form method="POST" action="/auth/signout">
								<button
									type="submit"
									class="text-label-small flex w-full items-center gap-3 border-t border-[var(--border-faint)] px-4 py-2.5 text-[var(--accent-crimson)] transition-colors hover:bg-[var(--heat-4)]"
									onclick={closeMenu}
								>
									<LogOut class="size-[15px]" />
									Sign out
								</button>
							</form>
						</div>
					{/if}
				</div>
			{:else}
				<a
					href={resolve(
						`/login${page.url.pathname !== '/' ? `?redirect=${encodeURIComponent(page.url.pathname)}` : ''}` as '/login'
					)}
					class="motion-press text-label-small flex min-h-11 items-center gap-1.5 rounded-md border border-[var(--border-muted)] bg-white px-3 py-1.5 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
				>
					<User class="size-4" />
					<span class="hidden sm:inline">Sign in</span>
				</a>
			{/if}

			{#if !isAdmin}
				<a
					href={resolve('/cart')}
					class="motion-press text-label-small relative flex min-h-11 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-foreground transition-colors hover:bg-[var(--black-alpha-4)]"
				>
					<ShoppingCart class="size-[18px]" />
					<span class="hidden sm:inline">Cart</span>
					{#if $cartState.hydrated && cartCount > 0}
						<span
							class="absolute -top-1 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--heat-100)] px-1 text-[10px] font-medium text-white shadow-[0_2px_4px_0_var(--heat-40)]"
						>
							{cartCount}
						</span>
					{/if}
				</a>
			{/if}
		</nav>
	</div>

	<div class="border-t border-[var(--border-faint)] md:hidden">
		<SearchBar
			size="md"
			placeholder={isAdmin ? 'Search catalog' : 'Search parts'}
			class="container mx-auto px-4 py-2.5"
		/>
	</div>
</header>
