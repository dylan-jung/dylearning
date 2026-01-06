import siteConfig from "./src/utils/config";

const config = siteConfig({
	title: "Dylearning",
	prologue: "Becoming a professional.\nMore responsibility, higher standards.",
	author: {
		name: "dylan-jung",
		email: "dylanjungko@gmail.com",
		link: "https://blog.dylearning.com"
	},
	description: "Dylan Jung Blog",
	copyright: {
		type: "CC BY 4.0",
		year: "2026"
	},
	i18n: {
		locales: ["ko", "en"],
		defaultLocale: "ko"
	},
	feed: {
		section: "*",
		limit: 20
	},
	latest: "*"
});

export const monolocale = Number(config.i18n.locales.length) === 1;

export default config;
