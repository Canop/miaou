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
THEMES_SRC_PATH="$ROOT_PATH/themes"

##################################################################
# building the standard css served to non chat pages
##################################################################

## build the css from scss
# rm $STATIC_PATH/main.css
# sass -t compressed $MAIN_SCSS_SRC_PATH/common/main.scss > $STATIC_PATH/main.css 
## concat plugin css
# cat $ROOT_PATH/plugins/*/css/*.css >> $STATIC_PATH/main.css
# echo main.css gzipped : `cat $STATIC_PATH/main.css | gzip -9f | wc -c` bytes

##################################################################
# building themes
##################################################################

## prepare the destination directory
rm -rf $STATIC_PATH/themes/
mkdir $STATIC_PATH/themes/

## create all themes in static
for f in $THEMES_SRC_PATH/*
do
theme=$(basename "$f")
echo theme : $theme
# creates the directory for the theme
mkdir $STATIC_PATH/themes/$theme
# copy the common scss files
cp $MAIN_SCSS_SRC_PATH/*.scss $STATIC_PATH/themes/$theme
# then the specific overrinding scss files
cp $THEMES_SRC_PATH/$theme/*.scss $STATIC_PATH/themes/$theme
# build the css file from the sass one
sass -t compressed $STATIC_PATH/themes/$theme/main.scss > $STATIC_PATH/themes/$theme/miaou.css 
# remove the now useless sass files
rm $STATIC_PATH/themes/$theme/*.scss
# concat plugin css
cat $ROOT_PATH/plugins/*/css/*.css >> $STATIC_PATH/themes/$theme/miaou.css
done

##################################################################
# building static/miaou.min.js
##################################################################

# concat common client side javascript
echo "\"use strict\";" > $STATIC_PATH/miaou.concat.js
cat $COMMON_SCRIPTS_SRC_PATH/*.js >> $STATIC_PATH/miaou.concat.js

# add plugin client side scripts
cat $ROOT_PATH/plugins/*/client-scripts/*.js >> $STATIC_PATH/miaou.concat.js

# minify the common js using uglify.js
cd $STATIC_PATH
# fixme : remove mountyhall from here
uglifyjs miaou.concat.js --screw-ie8 -cmt --reserved "chat,ed,gui,hist,links,locals,md,mh,mod,ms,notif,prof,skin,usr,win,ws,wz,games,plugins,mountyhall" --output miaou.min.js --source-map miaou.min.js.map

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
fname="${f%.*}.min.js"
uglifyjs "$f" --screw-ie8 -ct --output "$STATIC_PATH/$fname"
# uncomment the next line to get the sizes of the specific scripts
# echo $fname gzipped : `cat $STATIC_PATH/$fname | gzip -9f | wc -c` bytes
done


