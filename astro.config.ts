// @ts-check
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import svelte from "@astrojs/svelte";
import yaml from "@rollup/plugin-yaml";
import swup from "@swup/astro";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";
import githubLight from "shiki/themes/github-light.mjs";

import { rehypeHeadingIds as ids } from "@astrojs/markdown-remark";
import sectionize from "@hbsnow/rehype-sectionize";
import anchor from "rehype-autolink-headings";
import links from "rehype-external-links";
import katex from "rehype-katex";
import CJK from "remark-cjk-friendly";
import CJKStrikethrough from "remark-cjk-friendly-gfm-strikethrough";
import { remarkExtendedTable as table, extendedTableHandlers as tableHandler } from "remark-extended-table";
import mark from "remark-flexible-markers";
import footnote from "remark-footnotes-extra";
import gemoji from "remark-gemoji";
import GFM from "remark-gfm";
import ins from "remark-ins";
import math from "remark-math";

import copy from "./src/utils/code-copy";
import abbr from "./src/utils/remark/abbr";
import attr from "./src/utils/remark/attr";
import figure from "./src/utils/remark/figure";
import alerts from "./src/utils/remark/github-alert";
import reading from "./src/utils/remark/reading";
import ruby from "./src/utils/remark/ruby";
import spoiler from "./src/utils/remark/spoiler";
import wrapper from "./src/utils/remark/table-wrapper";

import siteConfig from "./site.config";
import { ZeoSevenFonts } from "./src/fonts/config";

// https://astro.build/config
export default defineConfig({
	site: "https://blog.dylearning.com",
	trailingSlash: "never",
	i18n: {
		...siteConfig.i18n,
		routing: {
			redirectToDefaultLocale: false,
			prefixDefaultLocale: false
		}
	},
	markdown: {
		remarkPlugins: [
			[GFM, { singleTilde: false }],
			ins,
			mark,
			spoiler,
			attr,
			CJK,
			[CJKStrikethrough, { singleTilde: false }],
			math,
			gemoji,
			footnote,
			abbr,
			[table, { colspanWithEmpty: true }],
			wrapper,
			ruby,
			[alerts, { typeFormat: "capitalize" }],
			reading
		],
		remarkRehype: {
			footnoteLabel: null,
			footnoteLabelTagName: "p",
			footnoteLabelProperties: {
				className: ["hidden"]
			},
			handlers: {
				...tableHandler
			}
		},
		rehypePlugins: [
			ids,
			[anchor, { behavior: "wrap" }],
			[links, { target: "_blank", rel: ["nofollow", "noopener", "noreferrer"] }],
			katex,
			figure,
			sectionize
		],
		smartypants: false,
		shikiConfig: {
			themes: {
				light: {
					...githubLight,
					colorReplacements: {
						"#fff": "var(--block-color)"
					}
				},
				dark: "dark-plus"
			},
			transformers: [
				copy({
					duration: 1500
				})
			]
		}
	},
	vite: {
		// @ts-expect-error
		plugins: [yaml(), tailwindcss()]
	},
	integrations: [
		svelte(),
		mdx(),
		sitemap(),
		swup({
			globalInstance: true,
			preload: false,
			smoothScrolling: false,
			progress: true
		})
	],
	experimental: {
		fonts: [
			{
				name: "Noto Serif",
				provider: fontProviders.google(),
				weights: [400, 700],
				fallbacks: ["serif"],
				cssVariable: "--font-noto-serif"
			},
			{
				name: "Noto Serif KR",
				provider: fontProviders.google(),
				weights: [400, 700],
				fallbacks: ["serif"],
				cssVariable: "--font-noto-serif-kr"
			},
			{
				name: "Norican",
				provider: fontProviders.google(),
				weights: [400],
				fallbacks: ["cursive"],
				cssVariable: "--font-norican"
			},
			{
				name: "Playwrite MX",
				provider: fontProviders.google(),
				weights: [100],
				display: "block",
				fallbacks: ["serif"],
				cssVariable: "--font-playwrite-mx"
			},
			{
				name: "Maple Mono NF CN",
				provider: ZeoSevenFonts(),
				fallbacks: ["monospace"],
				cssVariable: "--font-maple-mono-nf-cn"
			},
			{
				name: "The Peak Font Plus",
				provider: ZeoSevenFonts(),
				fallbacks: ["serif"],
				cssVariable: "--font-the-peak-font-plus"
			}
		]
	}
});
