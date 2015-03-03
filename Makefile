# Makes all the client side things which go in /static

PAGES_SCSS_SOURCES:=$(wildcard ./src/page-scss/*.scss)
PAGES_CSS_OUT:=$(patsubst %.scss, ./build/page-scss/%.css, $(notdir $(PAGES_SCSS_SOURCES)))

PAGES_JS_SOURCES:=$(wildcard ./src/page-js/*.js)
PAGES_JS_OUT:=$(patsubst %.js, ./static/%.min.js, $(notdir $(PAGES_JS_SOURCES)))
PAGES_JS_MAP_OUT:=$(addsuffix .map, $(PAGES_JS_OUT))

THEME_SRC_DIRS:=$(wildcard ./themes/*)
THEME_OUT_CSS:=$(patsubst %, ./static/themes/%/miaou.css, $(notdir $(THEME_SRC_DIRS)))

RSC_FILES:=$(patsubst ./src/rsc/%, ./static/%, $(shell find ./src/rsc/* -type f))
JS2_FILES:=$(addprefix ./static/, $(addsuffix .min.js2, miaou login rooms chat.mob jquery-2.1.3 socket.io))

MAIN_JS_SOURCES:=$(sort $(wildcard ./src/main-js/*.js))
PLUGIN_JS_SOURCES:=$(wildcard ./plugins/*/client-scripts/*.js)
MIAOU_MODULES:="chat,ed,fmt,gui,hist,links,locals,md,mh,mod,ms,notif,prof,skin,usr,watch,win,ws,wz,games,plugins,mountyhall"
UGLIFY_OPTIONS:=--screw-ie8 -cmt --reserved $(MIAOU_MODULES)

.PHONY: clean page-js page-js-map page-css themes rsc main-js js2-files

all: page-js page-js-map page-css themes rsc main-js js2-files

clean:
	rm -rf ./static/*
	rm -rf ./build

# main js file : static/miaou.min.js
# There's a cd static; because I didn't find another way to have a correctly linked source map
./static/miaou.concat.js: $(MAIN_JS_SOURCES) $(PLUGIN_JS_SOURCES)
	@echo "\"use strict\";" > $@
	cat $(MAIN_JS_SOURCES) >> $@
	cat $(PLUGIN_JS_SOURCES) >> $@
./static/miaou.min.js: ./static/miaou.concat.js
	cd static; uglifyjs miaou.concat.js $(UGLIFY_OPTIONS) --output $(@F) --source-map $(@F).map
	@echo $@ gzipped : `cat $@ | gzip -9f | wc -c` bytes
main-js: ./static/miaou.min.js

#js and maps of specific pages : static/[somepage].js
# FIXME 2 uglify... this is really not DRY...
./build/page-js: 
	mkdir -p $@
./build/page-js/%.js: ./src/page-js/%.js
	cp $< $@
./build/page-js/%.min.js: ./build/page-js/%.js
	cd build/page-js; uglifyjs $*.js $(UGLIFY_OPTIONS) --output $(@F) --source-map $*.min.js.map
./build/page-js/%.min.js.map: ./build/page-js/%.js
	cd build/page-js; uglifyjs $*.js $(UGLIFY_OPTIONS) --output $(@F) --source-map $*.min.js.map
./static/%.min.js: ./build/page-js/%.min.js
	cp $< $@
./static/%.min.js.map: ./build/page-js/%.min.js.map
	cp $< $@
page-js: ./build/page-js $(PAGES_JS_OUT)
page-js-map: page-js $(PAGES_JS_MAP_OUT)

# constant resource files
./static/%: ./src/rsc/%
	@mkdir -p $(@D)
	cp $< $@
rsc: $(RSC_FILES)

# CSS of specific pages : static/[somepage].css
./build/page-scss:
	mkdir -p $@
	cp ./src/main-scss/*.scss ./build/page-scss/
./build/page-scss/%.css: ./src/page-scss/%.scss 
	cp $< ./build/page-scss/
	sass -t compressed ./build/page-scss/$*.scss > $@
./static/%.css: ./build/page-scss/%.css
	cp $< $@
page-css: ./build/page-scss $(PAGES_CSS_OUT)

# Themes : static/themes/[sometheme]/main.css
# theme : $*
# css file : $@
# theme out dir (with a tail /) : $(dir $@) 
# Steps :
# 	copy the standard scss files
# 	override them with files of the theme (when available)
#	build the css file from the sass one
# 	and finally concat css of plugins
./build/themes/%:
	mkdir -p $@
./static/themes/%/miaou.css: ./build/themes/% ./themes/%/*.scss ./src/main-scss/*.scss ./plugins/*/css/*.css
	mkdir -p $(@D)
	cp ./src/main-scss/*.scss ./build/themes/$*/
	cp ./themes/$*/*.scss ./build/themes/$*/
	sass -t compressed  ./build/themes/$*/main.scss > $(@D)/miaou.css
	cat ./plugins/*/css/*.css >> $(@D)/miaou.css
themes: $(THEME_OUT_CSS)

# Build the JS2 files needed for mobile pages
./static/%.js2: ./static/%.js
	cp $< $@
js2-files: page-js main-js rsc $(JS2_FILES)
