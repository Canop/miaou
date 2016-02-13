"use strict";

let	gulp = require("gulp"),
	fs = require("fs"),
	concat = require("gulp-concat"),
	rename = require("gulp-rename"),
	path = require("path"),
	sass = require("gulp-sass"),
	merge = require("merge-stream"),
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

gulp.task("main-js", ()=>{
	return gulp.src([
		"src/main-js/*.js",
		"src/main-js/prettify/prettify.js",
		"src/main-js/prettify/lang-*.js",
		"plugins/*/client-scripts/*.js" // TODO filter to keep only active plugins
	])
	.pipe(concat("miaou.concat.js"))
	.pipe(gulp.dest("static"))
	.pipe(miaouUglify())
	.pipe(rename("miaou.min.js"))
	.pipe(gulp.dest("static"));
});

gulp.task("page-js", ()=>{
	return gulp.src("src/page-js/*.js")
	.pipe(miaouUglify())
	.pipe(rename({ suffix:'.min' }))
	.pipe(gulp.dest("static"));
});

gulp.task("resources", ()=>{
	return gulp.src(["src/rsc/**/*", "plugins/*/rsc/**/*"])
	.pipe(gulp.dest("static"));
});

gulp.task("themes:standard-files", ()=>{
	return merge(themes().map(theme =>
		gulp.src("src/main-scss/*.scss")
		.pipe(gulp.dest("static/themes/"+theme))
	));
});
gulp.task("themes:specific-files", ["themes:standard-files"], ()=>{
	return merge(themes().map(theme =>
		gulp.src(path.join("themes", theme, "*.scss"))
		.pipe(gulp.dest("static/themes/"+theme))
	));
});
gulp.task("themes:compile-scss", ["themes:specific-files"], ()=>{
	return merge(themes().map(theme =>
		gulp.src(["static/themes/"+theme+"/main.scss", "plugins/*/scss/*.scss"])
		.pipe(concat("main.scss"))
		.pipe(sass())
		.pipe(gulp.dest("static/themes/"+theme))
	));
});
gulp.task("themes", ["themes:compile-scss"], ()=>{
	return merge(themes().map(theme =>
		gulp.src(["static/themes/"+theme+"/main.css", "plugins/*/css/*.css"])
		.pipe(concat("miaou.css"))
		.pipe(gulp.dest("static/themes/"+theme))
	));
});

gulp.task("build", ["main-js", "page-js", "resources", "themes"]);
gulp.task("default", ["build"]);
