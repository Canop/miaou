#!/bin/bash

# builds Miaou

ROOT_PATH=`dirname $0`
STATIC_PATH="$ROOT_PATH/static"
CLIENT_SCRIPTS_SRC_PATH="$ROOT_PATH/src/client-scripts"
CLOSURE_PATH="$ROOT_PATH/tools/closure-compiler"

rm $STATIC_PATH/miaou.concat.js
cat $CLIENT_SCRIPTS_SRC_PATH/*.js >> $STATIC_PATH/miaou.concat.js

# minify the js. Produces a compact code but takes a few minutes and produces thousands of warnings
java -jar $CLOSURE_PATH/compiler.jar --compilation_level ADVANCED_OPTIMIZATIONS --externs $STATIC_PATH/jquery-2.0.3.min.js --js $STATIC_PATH/miaou.concat.js --js_output_file $STATIC_PATH/miaou.min.js

# builds the css file from the sass one
rm $STATIC_PATH/main.css
sass $STATIC_PATH/main.scss > $STATIC_PATH/main.css 
