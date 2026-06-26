import type { Link, Root, Text } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

// [[target]] or [[target|label]] — but not ![[...]] (Obsidian image embeds).
// Code/inline-code are `code`/`inlineCode` nodes, not `text`, so they're never visited.
const WIKILINK = /(?<!!)\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

// Same slugify as scripts/new.ts so [[Title]] resolves to the note's folder slug
const slugify = (text: string) =>
	text
		.toLowerCase()
		.normalize("NFKC")
		.replace(/[^\p{L}\p{N}\s-]+/gu, "")
		.trim()
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "");

/**
 * Remark plugin: [[Note Title|label]] → link to /note/<slug>.
 * ponytail: targets the `note` collection; "ko" is the default locale (no prefix),
 * other locales get a /<locale> prefix derived from the file path.
 */
const remarkWikiLink: Plugin<[], Root> = () => (tree, file) => {
	const locale = /[/\\]content[/\\]note[/\\]([^/\\]+)[/\\]/.exec(file.path ?? "")?.[1];
	const prefix = locale && locale !== "ko" ? `/${locale}` : "";

	visit(tree, "text", (node: Text, index, parent) => {
		if (!parent || index === null || index === undefined || !node.value.includes("[[")) return;

		const value = node.value;
		const out: (Text | Link)[] = [];
		let last = 0;
		WIKILINK.lastIndex = 0;

		for (let match = WIKILINK.exec(value); match; match = WIKILINK.exec(value)) {
			const [full, target, label] = match;
			if (match.index > last) out.push({ type: "text", value: value.slice(last, match.index) });
			out.push({
				type: "link",
				url: `${prefix}/note/${slugify(target.trim())}`,
				children: [{ type: "text", value: (label ?? target).trim() }]
			});
			last = match.index + full.length;
		}

		if (!out.length) return;
		if (last < value.length) out.push({ type: "text", value: value.slice(last) });

		parent.children.splice(index, 1, ...out);
		return index + out.length;
	});
};

export default remarkWikiLink;
