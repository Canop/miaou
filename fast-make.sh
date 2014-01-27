#!/bin/bash

# builds Miaou
# This fast-make
# - is fast
# - produces a poorly optimized JavaScript
# - doesn't compile the sass/scss files (assuming they're automatically compiled elsewhere)

ROOT_PATH=`dirname $0`
STATIC_PATH="$ROOT_PATH/static"
CLIENT_SCRIPTS_SRC_PATH="$ROOT_PATH/src/client-scripts"
CLOSURE_PATH="$ROOT_PATH/tools/closure-compiler"

rm $STATIC_PATH/miaou.concat.js
cat $CLIENT_SCRIPTS_SRC_PATH/*.js >> $STATIC_PATH/miaou.concat.js

# this is the not optimizing compilation. It's fast
java -jar $CLOSURE_PATH/compiler.jar --js $STATIC_PATH/miaou.concat.js --js_output_file $STATIC_PATH/miaou.min.js


