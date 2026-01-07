import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

/**
 * Note collection configuration
 * Represents main blog articles with comprehensive metadata
 */
const note = defineCollection({
	// Load all markdown files except those starting with underscore (private/draft files)
	loader: glob({ pattern: ["**/*.md", "!**/_*.md", "!**/_*/*.md"], base: "./src/content/note" }),
	schema: z.object({
		title: z.string(), // Post title (required)
		timestamp: z.date(), // Publication date (required)
		series: z.string().optional(), // Series name for grouped posts
		tags: z.array(z.string()).optional(), // Array of topic tags
		description: z.string().optional(), // Post description/excerpt
		sensitive: z.boolean().default(false), // Marks content as sensitive
		toc: z.boolean().default(false), // Whether to show table of contents
		top: z.number().int().nonnegative().default(0), // Top priority for sorting (higher is more important)
		draft: z.boolean().default(false) // Draft status (excludes from public listing)
	})
});

/**
 * Jotting collection configuration
 * Represents shorter posts, quick thoughts, or micro-blog entries
 */
const jotting = defineCollection({
	// Load all markdown files except those starting with underscore
	loader: glob({ pattern: ["**/*.md", "!**/_*.md", "!**/_*/*.md"], base: "./src/content/jotting" }),
	schema: z.object({
		title: z.string(), // Jotting title (required)
		timestamp: z.date(), // Publication date (required)
		tags: z.array(z.string()).optional(), // Array of topic tags
		description: z.string().optional(), // Brief description
		sensitive: z.boolean().default(false), // Marks content as sensitive
		top: z.number().int().nonnegative().default(0), // Top priority for sorting (higher is more important)
		draft: z.boolean().default(false) // Draft status
	})
});

/**
 * Preface collection configuration
 * Represents introductory content, site announcements, or special pages
 */
const preface = defineCollection({
	// Load all markdown files
	loader: glob({ pattern: "**/*.md", base: "./src/content/preface" }),
	schema: z.object({
		timestamp: z.date() // Creation timestamp
	})
});

/**
 * Information collection configuration
 * Represents static content like about pages, policies, or site information
 */
const information = defineCollection({
	// Load both markdown and YAML files for mixed content types
	loader: glob({ pattern: "**/*.{md,mdx,yaml}", base: "./src/content/information" })
});

/**
 * Resume collection configuration
 * Represents different versions of the resume
 */
const resume = defineCollection({
	loader: glob({ pattern: "**/*.json", base: "./src/content/resume" }),
	schema: z.object({
		header: z.object({
			name: z.string(),
			role: z.string(),
			email: z.string(),
			phone: z.string(),
			website: z.string(),
			github: z.string(),
			linkedin: z.string()
		}),
		introLines: z.array(z.string()),
		experience: z.array(
			z.object({
				company: z.string(),
				role: z.string(),
				date: z.string(),
				intro: z.string().optional(),
				activities: z.array(z.string()).optional(),
				techStack: z
					.array(
						z.object({
							name: z.string(),
							description: z.string()
						})
					)
					.optional(),
				relatedLinks: z
					.array(
						z.object({
							text: z.string(),
							url: z.string()
						})
					)
					.optional()
			})
		),
		education: z.array(
			z.object({
				school: z.string(),
				degree: z.string(),
				date: z.string()
			})
		),
		activities_list: z
			.array(
				z.object({
					name: z.string(),
					role: z.string(),
					date: z.string(),
					description: z.string()
				})
			)
			.optional(),
		awards: z
			.array(
				z.object({
					name: z.string(),
					role: z.string(),
					date: z.string()
				})
			)
			.optional(),
		certifications: z.array(z.string()).optional()
	})
});

export const collections = { note, jotting, preface, information, resume };
