#!/bin/bash
# builds Miaou

cwd=${PWD}
trap 'cd "$cwd"' EXIT
cd `dirname $0`
ROOT_PATH=${PWD}
STATIC_PATH="$ROOT_PATH/static"
COMMON_SCRIPTS_SRC_PATH="$ROOT_PATH/src/main-js"
PAGE_SCRIPTS_SRC_PATH="$ROOT_PATH/src/page-js"
MAIN_SCSS_SRC_PATH="$ROOT_PATH/src/main-scss"
PAGE_SCSS_SRC_PATH="$ROOT_PATH/src/page-scss"

##################################################################
# building static/main.css
##################################################################

## builds the css file from the sass one
rm $STATIC_PATH/main.css
sass -t compressed $MAIN_SCSS_SRC_PATH/main.scss > $STATIC_PATH/main.css 

## concat plugin css
cat $ROOT_PATH/plugins/*/css/*.css >> $STATIC_PATH/main.css

echo main.css gzipped : `cat $STATIC_PATH/main.css | gzip -9f | wc -c` bytes

##################################################################
# building static/miaou.min.js
##################################################################

# concat common client side javascript
rm $STATIC_PATH/miaou.concat.js
cat $COMMON_SCRIPTS_SRC_PATH/*.js >> $STATIC_PATH/miaou.concat.js

# add plugin client side scripts
cat $ROOT_PATH/plugins/*/client-scripts/*.js >> $STATIC_PATH/miaou.concat.js

# minify the common js using uglify.js
cd $STATIC_PATH
# fixme : remove mountyhall from here
uglifyjs miaou.concat.js --screw-ie8 -cmt --reserved "chat,ed,gui,hist,md,mh,mod,ms,notif,prof,usr,win,ws,wz,games,plugins,mountyhall" --output miaou.min.js --source-map miaou.min.js.map

echo miaou.min.js gzipped : `cat miaou.min.js | gzip -9f | wc -c` bytes

##################################################################
# building specific page css
##################################################################

cd $PAGE_SCSS_SRC_PATH
for f in *.scss
do
sass -t compressed $f > "$STATIC_PATH/${f%.*}.css"
done

##################################################################
# building specific page scripts
##################################################################
cd $PAGE_SCRIPTS_SRC_PATH
for f in *.js
do
uglifyjs "$f" --screw-ie8 -ct --output "$STATIC_PATH/${f%.*}.min.js"
done


