"use strict";

let	gulp = require("gulp"),
	fs = require("fs"),
	concat = require("gulp-concat"),
	rename = require("gulp-rename"),
	path = require("path"),
	sass = require("gulp-sass"),
	merge = require("merge-stream"),
	eslint = require('gulp-eslint'),
	del = require("del"),
	uglify = require("gulp-uglify");


function miaouModules(){
	return fs.readdirSync("src/main-js").map(name=>{
		let match = name.match(/^miaou\.([a-zA-Z\d]+)\.js$/);
		if (match) return match[1];
	}).filter(Boolean);
}

function miaouUglify(){
	return uglify({
		warnings: true,
		mangle: { except:miaouModules() }
	});
}

function themes(){
	return fs.readdirSync("themes").filter(
		f => fs.statSync(path.join("themes", f)).isDirectory()
	);
}

let globs = {
	"main-js": [
		"src/main-js/*.js",
		"src/main-js/prettify/prettify.js",
		"src/main-js/prettify/lang-*.js",
		"plugins/*/client-scripts/*.js" // TODO filter to keep only active plugins
	],
	"page-js": "src/page-js/*.js",
	"resources:main": "src/rsc/**/*",
	"resources:plugins": "plugins/*/rsc/**/*",
	"server-js": [
		"libs/*.js",
		"plugins/*/*.js",
	],
};


function clientGlobals(){
	return [
		"miaou",
		// libraries
		"$", "hu", "ù", "wzin", "vis", "Groumf", "prettyPrint",
		// new browser globals
		"RTCPeerConnection", "Set", "Map", "Promise", "WeakMap",
		// for files which may also be executed on node
		"exports", "module",
	].reduce((s,v)=>{s[v]=true; return s;},{});
}

gulp.task("server-js", ()=> 
	gulp.src(globs["server-js"])
	.pipe(eslint({
		"env": {
			"node": true,
			"es6": true
		},
		"extends": "eslint:recommended",
		"rules": {
			"no-unused-vars": [
				2,
				{"vars": "all", "args": "none"}
			],
			"comma-dangle": [
				2,
				"only-multiline"
			],
			"complexity": [
				0,
				20
			],
			"dot-location": [
				2,
				"property"
			],
			"no-extra-label": [
				2
			],
			"indent": [
				2,
				"tab"
			],
			"linebreak-style": [
				2,
				"unix"
			],
			"brace-style": [
				2,
				"1tbs"
			],
			"no-lonely-if": 2,
			"no-eval": 2,
			"no-caller": 2,
			"no-extra-bind": 2,
			"no-extra-label": 2,
			"no-console": 0,
			"quotes": [
				0,
				"double"
			]
		}
	}))
	.pipe(eslint.format())
	.pipe(eslint.failAfterError())
);

gulp.task("lint-client-js", ()=>
	gulp.src(["src/main-js/*.js", "plugins/*/client-scripts/*.js"])
	.pipe(eslint({
		"env": {
			"browser": true,
		},
		"extends": "eslint:recommended",
		"globals": clientGlobals(),
		"rules": {
			"no-unused-vars": [
				2,
				{"vars": "all", "args": "none"}
			],
			"comma-dangle": [
				2,
				"only-multiline"
			],
			"complexity": [
				0,
				20
			],
			"dot-location": [
				2,
				"property"
			],
			"no-extra-label": [
				2
			],
			"indent": [
				2,
				"tab"
			],
			"linebreak-style": [
				2,
				"unix"
			],
			"brace-style": [
				0, // I'll activate this when switching code to ES6
				"1tbs"
			],
			"no-lonely-if": 0,
			"no-eval": 2,
			"no-caller": 2,
			"no-extra-bind": 2,
			"no-extra-label": 2,
			"no-fallthrough": 0,
			"no-console": 0,
			"quotes": [
				0,
				"double"
			]
		}
	}))
	.pipe(eslint.format())
	.pipe(eslint.failAfterError())
);

gulp.task("main-js", ()=>
	gulp.src(globs["main-js"])
	.pipe(concat("miaou.concat.js"))
	.pipe(gulp.dest("static"))
	.pipe(miaouUglify())
	.pipe(rename("miaou.min.js"))
	.pipe(gulp.dest("static"))
);

gulp.task("page-js", ()=>
	gulp.src(globs["page-js"])
	.pipe(miaouUglify())
	.pipe(rename({ suffix:'.min' }))
	.pipe(gulp.dest("static"))
);

gulp.task("resources:main", ()=>
	gulp.src(globs["resources:main"])
	.pipe(gulp.dest("static"))
);
gulp.task("resources:plugins", ()=>
	gulp.src(globs["resources:plugins"], { base:"plugins" })
	.pipe(gulp.dest("static/plugins"))
);

gulp.task("themes:standard-files", ()=>
	merge(themes().map(theme =>
		gulp.src("src/main-scss/*.scss")
		.pipe(gulp.dest("static/themes/"+theme))
	))
);
gulp.task("themes:specific-files", ["themes:standard-files"], ()=>
	merge(themes().map(theme =>
		gulp.src(path.join("themes", theme, "*.scss"))
		.pipe(gulp.dest("static/themes/"+theme))
	))
);
gulp.task("themes:compile-scss", ["themes:specific-files"], ()=>
	merge(themes().map(theme =>
		gulp.src(["static/themes/"+theme+"/main.scss", "plugins/*/scss/*.scss"])
		.pipe(concat("main.scss"))
		.pipe(sass())
		.pipe(gulp.dest("static/themes/"+theme))
	))
);
gulp.task("themes", ["themes:compile-scss"], ()=>
	merge(themes().map(theme =>
		gulp.src(["static/themes/"+theme+"/main.css", "plugins/*/css/*.css"])
		.pipe(concat("miaou.css"))
		.pipe(gulp.dest("static/themes/"+theme))
	))
);

gulp.task("clean", () => del("static/*"));
gulp.task("build", ["server-js", "lint-client-js", "main-js", "page-js", "resources:main", "resources:plugins", "themes"]);

gulp.task("watch", ["build"], ()=>{
	for (let task in globs) {
		gulp.watch(globs[task], [task]);
	}
	gulp.watch(["themes/**/*.scss", "plugins/**/*.scss", "plugins/**/*.css", "src/**/*.scss"], ["themes"])
	gulp.watch(["src/main-js/*.js", "plugins/*/client-scripts/*.js"], ["lint-client-js"]);

});

gulp.task("default", ["build"]);
