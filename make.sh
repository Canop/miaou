#!/bin/bash
# builds Miaou

cwd=${PWD}
trap 'cd "$cwd"' EXIT

ROOT_PATH=`dirname $0`
STATIC_PATH="$ROOT_PATH/static"
CLIENT_SCRIPTS_SRC_PATH="$ROOT_PATH/src/client-scripts"

rm $STATIC_PATH/miaou.concat.js
cat $CLIENT_SCRIPTS_SRC_PATH/*.js >> $STATIC_PATH/miaou.concat.js

# add plugin client side scripts
cat $ROOT_PATH/plugins/*/client-scripts/*.js >> $STATIC_PATH/miaou.concat.js

cd $STATIC_PATH

# minify the js using uglify.js
uglifyjs miaou.concat.js  --screw-ie8 -c --output miaou.min.js --source-map miaou.min.js.map


# builds the css file from the sass one
# rm /main.css
# sass /main.scss > /main.css 
