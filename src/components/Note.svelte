<script lang="ts">
import { getRelativeLocaleUrl } from "astro:i18n";
import { onMount } from "svelte";
import { flip } from "svelte/animate";
import { fade } from "svelte/transition";
import { monolocale } from "$config";
import Time from "$utils/time";
import Icon from "$components/Icon.svelte";
import i18nit from "$i18n";

let {
	locale,
	notes,
	series: seriesList,
	categories: categoryList
}: { locale: string; notes: any[]; series: string[]; categories: string[] } = $props();

const t = i18nit(locale);

let initial = $state(false); // Track initial load to prevent unexpected effects
let series: string | null = $state(null);
let categories: string[] = $state([]); // Selected category filters (OR within facet)
let filtered: any[] = $derived.by(() => {
	let list: any[] = notes
		// Apply series and category filtering
		.filter(note => {
			let matchSeries = !series || note.data.series === series;
			let matchCategory = categories.length === 0 || categories.some(category => note.data.categories?.includes(category));
			return matchSeries && matchCategory;
		})
		// Sort by timestamp (newest first)
		.sort((a, b) => b.data.top - a.data.top || b.data.timestamp.getTime() - a.data.timestamp.getTime());

	if (!initial) return list;

	// Build URL with current page, series, and category filters using URLSearchParams
	let params = new URLSearchParams();

	params.set("page", String(page));
	if (series) params.set("series", series);
	for (const category of categories) params.append("category", category);

	let url = `${location.pathname}?${params.toString()}`;

	// Match https://github.com/swup/swup/blob/main/src/helpers/history.ts#L22
	window.history.replaceState({ url, random: Math.random(), source: "swup" }, "", url);

	return list;
});

// Count notes per category for the facet list
let counts: Record<string, number> = $derived(
	Object.fromEntries(categoryList.map(category => [category, notes.filter(note => note.data.categories?.includes(category)).length]))
);

// Calculate pagination
const size: number = 20;
let pages: number = $derived(Math.ceil(filtered.length / size));

// Ensure page is within valid range
let page: number = $state(1);
$effect(() => {
	page = Math.max(1, Math.min(Math.floor(page), pages));
});

// Apply pagination by slicing the array
let list: any[] = $derived(filtered.slice((page - 1) * size, page * size));

/**
 * Select or deselect a series filter (only one series can be active at a time)
 * @param seriesChoice the series to select or deselect
 * @param turn whether to include or exclude the series
 */
function chooseSeries(seriesChoice: string, turn?: boolean) {
	if (turn === undefined) turn = series !== seriesChoice;
	// Set series if turning on, or clear if turning off
	series = turn ? seriesChoice : null;
}

/**
 * Toggle a category filter (multiple categories can be active at once)
 * @param category the category to toggle
 */
function toggleCategory(category: string) {
	categories = categories.includes(category) ? categories.filter(item => item !== category) : [...categories, category];
}

onMount(() => {
	const params = new URLSearchParams(window.location.search);

	page = Number(params.get("page")) || 1;
	series = params.get("series");
	categories = params.getAll("category");

	initial = true;
});
</script>

<main class="flex flex-col-reverse sm:flex-row gap-10 grow">
	<article class="flex flex-col gap-4 grow">
		{#each list as note (note.id)}
			<section animate:flip={{ duration: 150 }} class="flex flex-col gap-1">
				<div class="leading-[1.5] *:inline *:align-middle">
					{#if note.data.top > 0}<Icon name="lucide--flag-triangle-right" class="rtl:-scale-x-100 text-remark" />{/if}
					{#if note.data.sensitive}<Icon name="lucide--siren" title={t("sensitive.icon")} class="text-remark" />{/if}
					<a href={getRelativeLocaleUrl(locale, `/note/${monolocale ? note.id : note.id.split("/").slice(1).join("/")}`)} class="link font-medium">{note.data.title}</a>
				</div>
				<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8rem] text-remark">
					<time datetime={note.data.timestamp.toISOString()}>{Time.date(note.data.timestamp)}</time>
					{#if note.data.series}
						<span aria-hidden="true" class="text-weak">·</span>
						<button onclick={() => chooseSeries(note.data.series, true)} class="hover:text-primary transition-colors">{note.data.series}</button>
					{/if}
				</div>
			</section>
		{:else}
			<div class="pt-[10vh] text-center text-secondary font-bold text-xl">{t("note.empty")}</div>
		{/each}

		{#if pages > 1}
			<footer class="sticky bottom-0 flex items-center justify-center gap-3 mt-auto pb-1 text-weak bg-background font-mono">
				<button onclick={() => (page = Math.max(1, page - 1))}><Icon name="lucide--arrow-left" class="rtl:-scale-x-100" /></button>
				<button class:location={1 == page} onclick={() => (page = 1)}>{1}</button>

				{#if pages > 7 && page > 4}<Icon name="lucide--ellipsis" />{/if}

				{#each Array.from({ length: Math.min(5, pages - 2) }, (_, i) => i + Math.max(2, Math.min(pages - 5, page - 2))) as P (P)}
					<button class:location={P == page} onclick={() => (page = P)} animate:flip={{ duration: 150 }} transition:fade={{ duration: 150 }}>{P}</button>
				{/each}

				{#if pages > 7 && page < pages - 3}<Icon name="lucide--ellipsis" />{/if}

				<button class:location={pages == page} onclick={() => (page = pages)}>{pages}</button>
				<button onclick={() => (page = Math.min(pages, page + 1))}><Icon name="lucide--arrow-right" class="rtl:-scale-x-100" /></button>
			</footer>
		{/if}
	</article>

	<aside class="sm:basis-52 shrink-0 flex flex-col gap-6">
		{#if categoryList.length}
			<section class="flex flex-col gap-2">
				<h4 class="text-xs font-semibold uppercase tracking-wider text-remark">{t("note.category")}</h4>
				<ul class="flex flex-col gap-0.5 text-[0.85rem]">
					{#each categoryList as category (category)}
						<li>
							<button class="facet" class:selected={categories.includes(category)} onclick={() => toggleCategory(category)}>
								<span class="facet-box" aria-hidden="true"></span>
								<span class="facet-label">{category}</span>
								<span class="facet-count">{counts[category]}</span>
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if seriesList.length}
			<section class="flex flex-col gap-2">
				<h4 class="text-xs font-semibold uppercase tracking-wider text-remark">{t("note.series")}</h4>
				<ul class="flex flex-col gap-1 text-[0.85rem]">
					{#each seriesList as seriesItem (seriesItem)}
						<li>
							<button class="series-item" class:selected={seriesItem == series} onclick={() => chooseSeries(seriesItem)}>{seriesItem}</button>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</aside>
</main>

<style>
	article {
		footer {
			button {
				display: flex;
				align-items: center;
				justify-content: center;

				width: 30px;
				height: 30px;

				margin-top: 0.25rem 0rem 0.5rem;
				border-bottom: 2px solid;

				font-style: var(--font-mono);
				font-size: 0.875rem;

				transition: color 0.15s ease-in-out;

				&:hover,
				&.location {
					color: var(--primary-color);
				}
			}
		}
	}

	.facet {
		display: flex;
		align-items: center;
		gap: 0.5em;
		width: 100%;
		color: var(--secondary-color);
		transition: color 0.15s ease-in-out;

		.facet-box {
			flex-shrink: 0;
			width: 0.85em;
			height: 0.85em;
			border: 1.5px solid var(--shadow-color);
			border-radius: 0.2em;
			transition:
				background-color 0.15s ease-in-out,
				border-color 0.15s ease-in-out;
		}

		.facet-label {
			flex-grow: 1;
			text-align: start;
		}

		.facet-count {
			color: var(--weak-color);
			font-size: 0.85em;
			font-variant-numeric: tabular-nums;
		}

		&:hover {
			color: var(--primary-color);
		}

		&.selected {
			color: var(--primary-color);

			.facet-box {
				background-color: var(--primary-color);
				border-color: var(--primary-color);
			}
		}
	}

	.series-item {
		display: block;
		width: 100%;
		text-align: start;
		color: var(--secondary-color);
		transition: color 0.15s ease-in-out;

		&:hover {
			color: var(--primary-color);
		}

		&.selected {
			color: var(--primary-color);
			font-weight: 500;
		}
	}

</style>
