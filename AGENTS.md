This repo runs on Svelte 5 and SvelteKit 2.

Use the Svelte MCP server for every Svelte or SvelteKit task.

## Available Svelte MCP Tools

### 1. `list-sections`

Use this first to discover all available Svelte and SvelteKit documentation sections.
When a task touches Svelte, SvelteKit, runes, routing, forms, data loading, stores/state, transitions, or component authoring, call this at the start of the task.

### 2. `get-documentation`

After `list-sections`, inspect the returned `use_cases` fields and fetch all sections relevant to the task in one call whenever practical.
Do not guess framework behavior when the MCP docs can answer it.

### 3. `svelte-autofixer`

Run this whenever you write or substantially refactor Svelte code before finalizing the task.
If it reports actionable issues, fix them and run it again.
If the tool fails on a large file payload, still complete validation with `npm run check` and note the autofixer limitation.

### 4. `playground-link`

Only use this if the user explicitly wants a Svelte Playground link.
Do not use it for code already written into this repo.

## Repo-Specific Guidance

- Preserve the existing LapKart design system. Do not redesign pages unless explicitly asked.
- For admin and storefront work, preserve the current behavior contracts and wire changes to the existing backend endpoints in `supabase/functions/api/index.ts`.
- Validate Svelte changes with `npm run check`.
- `npm run build` is useful for production verification, but on this Windows machine the Vercel adapter may fail at the final symlink step with `EPERM` even when the Svelte build itself is otherwise valid.
- After significant frontend changes, smoke-test the affected route locally and verify there are no runtime console errors before finalizing.
