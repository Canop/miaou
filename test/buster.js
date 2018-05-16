var config = module.exports;

config["all"] = {
	environment: "node",
	tests: [
		"fmt/fmt.float.js",
		"format/format-basic.js",
		"format/format-titles.js",
		"format/format-links.js",
		"format/format-lists.js",
		"format/format-images.js",
		"format/format-code.js",
		"format/format-quotes.js",
		"format/format-tables.js",
		"format/format-sub-sup.js",
		"ludogene/tribo.js",
		"stackoverflow/url.js",
		"naming/name-cleaning.js",
		"db/sql.js",
		"bench/Accumulator.js",
		"pingme/parse.js",
	]
};
