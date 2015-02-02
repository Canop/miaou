# Makes all the client side things which go in /static

PAGES_SCSS_SOURCES:=$(wildcard ./src/page-scss/*.scss)
PAGES_CSS_OUT:=$(patsubst %.scss, ./build/page-scss/%.css, $(notdir $(PAGES_SCSS_SOURCES)))

PAGES_JS_SOURCES:=$(wildcard ./src/page-js/*.js)
PAGES_JS_OUT:=$(patsubst %.js, ./build/page-js/%.min.js, $(notdir $(PAGES_JS_SOURCES)))

THEME_SRC_DIRS:=$(wildcard ./themes/*)
THEME_OUT_CSS:=$(patsubst %, ./static/themes/%/miaou.css, $(notdir $(THEME_SRC_DIRS)))

RSC_FILES:=$(patsubst ./src/rsc/%, ./static/%, $(shell find ./src/rsc/* -type f))

MAIN_JS_SOURCES:=$(sort $(wildcard ./src/main-js/*.js))
PLUGIN_JS_SOURCES:=$(wildcard ./plugins/*/client-scripts/*.js)
MIAOU_MODULES:="chat,ed,gui,hist,links,locals,md,mh,mod,ms,notif,prof,skin,usr,watch,win,ws,wz,games,plugins,mountyhall"
UGLIFY_OPTIONS:=--screw-ie8 -cmt --reserved $(MIAOU_MODULES)

.PHONY: clean page-js page-css themes rsc main-js

all: page-js page-css themes rsc main-js

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

#js of specific pages : static/[somepage].js
./build/page-js: 
	mkdir -p $@
./build/page-js/%.min.js: ./src/page-js/%.js
	cp $< build/page-js/
	cd build/page-js; uglifyjs $*.js $(UGLIFY_OPTIONS) --output $(@F) --source-map $*.min.js.map
page-js: ./build/page-js $(PAGES_JS_OUT)
	@cp ./build/page-js/* ./static/

# constant resource files
./static/%: ./src/rsc/%
	@mkdir -p $(@D)
	cp $< $@
rsc: $(RSC_FILES)

# CSS of specific pages : static/[somepage].css
./build/page-scss: ./src/main-scss/*.scss
	mkdir -p $@
	cp ./src/main-scss/*.scss ./build/page-scss/
./build/page-scss/%.css: ./src/page-scss/%.scss ./build/page-scss
	cp $< ./build/page-scss/
	sass -t compressed ./build/page-scss/$*.scss > $@
page-css: ./build/page-scss $(PAGES_CSS_OUT)
	@cp ./build/page-scss/*.css ./static/

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
./static/themes/%/miaou.css: ./build/themes/% ./themes/%/*.scss ./src/main-scss/*.scss
	mkdir -p $(@D)
	cp ./src/main-scss/*.scss ./build/themes/$*/
	cp ./themes/$*/*.scss ./build/themes/$*/
	sass -t compressed  ./build/themes/$*/main.scss > $(@D)/miaou.css
	cat ./plugins/*/css/*.css >> $(@D)/miaou.css
themes: $(THEME_OUT_CSS)
