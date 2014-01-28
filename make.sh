#!/bin/bash

# builds Miaou

ROOT_PATH=`dirname $0`
STATIC_PATH="$ROOT_PATH/static"
CLIENT_SCRIPTS_SRC_PATH="$ROOT_PATH/src/client-scripts"
CLOSURE_PATH="$ROOT_PATH/tools/closure-compiler"
UGLIFY="$ROOT_PATH/node_modules/uglify-js/bin/uglifyjs"

rm $STATIC_PATH/miaou.concat.js
cat $CLIENT_SCRIPTS_SRC_PATH/*.js >> $STATIC_PATH/miaou.concat.js

# minify the js using closure compiler
# Don't use the ADVANCED_OPTIMIZATIONS compilation level, it's shitty, doesn't reduce the compiled js much but make you
#  increase the size and complexity of the source js.
#java -jar $CLOSURE_PATH/compiler.jar --js $STATIC_PATH/miaou.concat.js --js_output_file $STATIC_PATH/miaou.min.js

# minify the js using uglify.js
uglifyjs $STATIC_PATH/miaou.concat.js --screw-ie8 -c > $STATIC_PATH/miaou.min.js

# builds the css file from the sass one
# rm $STATIC_PATH/main.css
# sass $STATIC_PATH/main.scss > $STATIC_PATH/main.css 
