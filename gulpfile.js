"use strict";

let	gulp = require("gulp"),
	fs = require("fs"),
	concat = require("gulp-concat"),
	rename = require("gulp-rename"),
	path = require("path"),
	sass = require("gulp-sass"),
	merge = require("merge-stream"),
	eslint = require('gulp-eslint'),
	gutil = require("gulp-util"),
	del = require("del"),
	glob = require("glob"),
	gulpif = require("gulp-if"),
	uglify = require('gulp-uglify-es').default;

let mode = {
	watch: false,
};

function miaouModules(){
	var modules = [];
	globs["main-js"].forEach(path=>{
		glob.sync(path).forEach(name=>{
			let match = name.match(/(?:^|\/)miaou\.([a-zA-Z\d]+)\.js$/);
			if (match) modules.push(match[1]);
		});
	});
	return modules;
}

function miaouMinify(){
	return uglify({
		ecma: 8,
		compress: {
			keep_infinity: true,
		},
		mangle: {
			reserved: miaouModules(),
		},
		warnings: true
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
	"sw-js": [ // main code for the service worker (might be renamed if I decide to authorize pluggable sw)
		"src/sw-js/*.js",
	],
	"page-js": "src/page-js/*.js",
	"page-scss": "src/page-scss/*.scss",
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
	];
}

gulp.task("server-js", ()=>
	gulp.src(globs["server-js"])
	.pipe(eslint({
		"parserOptions": {
			"ecmaVersion": 2018,
		},
		"env": [ "node", "es7"],
		"extends": "eslint:recommended",
		"rules": {
			"no-unused-vars": [ 2, { "vars": "all", "args": "none" } ],
			"comma-dangle": [ 2, "only-multiline" ],
			"complexity": [	0, 10 ],
			"dot-location": [ 2, "property"	],
			"no-extra-label": [ 2 ],
			"indent": [ 2, "tab", {
				"MemberExpression": "off"
			}],
			"brace-style": [ 2, "1tbs" ],
			"linebreak-style": [ 2, "unix" ],
			"no-eval": 2,
			"max-len": [2, {
				"code": 120,
				// "ignoreRegExpLiterals": true
				//"ignorePattern": "^\\s*(var )?\\w+ = \\/.*\\/\\w*(,|;)$" // regex declarations
			}],
			"no-caller": 2,
			"no-extra-bind": 2,
			"no-extra-label": 2,
			"no-unexpected-multiline": 2,
			"no-console": 0,
			"no-extra-semi": 0,
			"quotes": 0,
			"comma-spacing": [ 2, { "before": false, "after": true } ],
			"comma-style": 2,
			"no-trailing-spaces": [ 2, { "skipBlankLines": true } ],
			"no-restricted-syntax": [ 2, "WithStatement" ],
			"keyword-spacing": 2,
			"no-throw-literal": 0, // TODO fix errors in Miaou server code
			"no-useless-call": 2,
			"no-void": 2,
			//"max-depth": [ 2, 4],
			"no-unneeded-ternary": 2,
			"operator-assignment": [ 2, "always" ],
			"space-before-function-paren": [ 2, "never" ],
			"space-before-blocks": [2, {
				"functions": "never",
				"keywords": "always",
				classes: "never"
			}],
			"no-lonely-if": 2,
		}
	}))
	.pipe(eslint.format())
	.pipe(gulpif(!mode.watch, eslint.failAfterError()))
);

gulp.task("lint-client-js", ()=>
	gulp.src(["src/*-js/*.js", "plugins/*/client-scripts/*.js", "!**/*.min.js"])
	.pipe(eslint({
		"parserOptions": {
			"ecmaVersion": 2018,
		},
		"env": [
			"browser", "es6", "jquery"
		],
		"extends": "eslint:recommended",
		"globals": clientGlobals(),
		"rules": {
			"no-unused-vars": [ 2, {"vars": "all", "args": "none"} ],
			"comma-dangle": [ 2, "only-multiline" ],
			"complexity": [	0, 10 ],
			"dot-location": [ 2, "property"	],
			"no-extra-label": [ 2 ],
			"indent": [ 2, "tab", {
				"MemberExpression": 0
			}],
			"brace-style": [ 0, "1tbs" ],
			"linebreak-style": [ 2, "unix" ],
			"no-eval": 2,
			"max-len": [2, {
				"code": 120,
				"ignorePattern": "^\\s*(var )?\\w+ = \\/.*\\/\\w*(,|;)$" // regex declarations
			}],
			"no-caller": 2,
			"no-extra-bind": 2,
			"no-extra-label": 2,
			"no-console": 0,
			"no-extra-semi": 0,
			"no-unexpected-multiline": 2,
			"quotes": 0,
			"comma-spacing": [ 2, {"before": false, "after": true} ],
			"comma-style": 2,
			"no-trailing-spaces": [ 2, { "skipBlankLines": true } ],
			"no-restricted-syntax": [ 2, "WithStatement" ],
			"keyword-spacing": 2,
			"new-cap": 2,
			"no-throw-literal": 2,
			"no-useless-call": 2,
			"no-void": 2,
			"max-depth": [ 2, 6],
			"no-unneeded-ternary": 2,
			"operator-assignment": [ 2, "always" ],
			"space-before-function-paren": [ 2, "never" ],
			"space-before-blocks": [2, { "functions": "never", "keywords": "always", classes: "never" }],
			"no-lonely-if": 0,
			"no-fallthrough": 0,
		}
	}))
	.pipe(eslint.format())
	.pipe(gulpif(!mode.watch, eslint.failAfterError()))
);

function jsErrHandler(err){
	let c = gutil.colors;
	gutil.log(c.red("Error: "+err.message));
	gutil.log("@ "+c.blue(err.fileName)+":"+c.blue(err.lineNumber));
	if (mode.watch) this.emit('end');
}

gulp.task("main-js", ()=>
	gulp.src(globs["main-js"])
	.pipe(concat("miaou.concat.js"))
	.pipe(gulp.dest("static"))
	.pipe(mode.watch ? gutil.noop() : miaouMinify())
	.on("error", jsErrHandler)
	.pipe(rename("miaou.min.js"))
	.pipe(gulp.dest("static"))
);

gulp.task("sw-js", ()=>
	gulp.src(globs["sw-js"])
	.pipe(concat("miaou.sw.concat.js"))
	.pipe(gulp.dest("static"))
	.pipe(mode.watch ? gutil.noop() : miaouMinify())
	.on("error", jsErrHandler)
	.pipe(rename("miaou.sw.min.js"))
	.pipe(gulp.dest("static"))
);

gulp.task("page-js", ()=>
	gulp.src(globs["page-js"])
	.pipe(mode.watch ? gutil.noop() : miaouMinify())
	.on("error", jsErrHandler)
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
gulp.task("themes:specific-files", ()=>
	merge(themes().map(theme =>
		gulp.src(path.join("themes", theme, "*.scss"))
		.pipe(gulp.dest("static/themes/"+theme))
	))
);
gulp.task("themes:compile-scss", ()=>
	merge(themes().map(theme =>
		gulp.src(["static/themes/"+theme+"/main.scss", "plugins/*/scss/*.scss"])
		.pipe(concat("main.scss"))
		.pipe(gulp.dest(`static/themes/${theme}`)) // concat doesn't properly find the directory with gulp4
		.pipe(sass())
		.pipe(gulp.dest("static/themes/"+theme))
	))
);
gulp.task("themes:package", ()=>
	merge(themes().map(theme =>
		gulp.src(["static/themes/"+theme+"/main.css", "plugins/*/css/*.css"])
		.pipe(concat("miaou.css"))
		.pipe(gulp.dest("static/themes/"+theme))
	))
);

gulp.task("page-scss", ()=>
	gulp.src(globs["page-scss"])
	.pipe(sass())
	.pipe(gulp.dest("static"))
);

gulp.task("clean", () => del("static/*"));

gulp.task("themes", gulp.series(
	"themes:standard-files", "themes:specific-files", "themes:compile-scss", "themes:package"
));

gulp.task("build", gulp.series(
	"server-js", "lint-client-js", "main-js", "sw-js", "page-js", "page-scss",
	"resources:main", "resources:plugins", "themes"
));

gulp.task("set-watch-mode", (done)=>{
	mode.watch = true;
	done();
});

gulp.task("watch", gulp.series("set-watch-mode", "build", function watch(){
	for (let task in globs) {
		gulp.watch(globs[task], gulp.series(task));
	}
	gulp.watch(["themes/**/*.scss", "plugins/**/*.scss", "plugins/**/*.css", "src/**/*.scss"], gulp.series("themes"))
	gulp.watch(["src/*-js/*.js", "plugins/*/client-scripts/*.js"], gulp.series("lint-client-js"));
}));

gulp.task("default", gulp.series("watch"));
