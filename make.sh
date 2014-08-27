#!/bin/bash
# builds Miaou

ROOT_PATH=`dirname $0`
STATIC_PATH="$ROOT_PATH/static"
CLIENT_SCRIPTS_SRC_PATH="$ROOT_PATH/src/client-scripts"
SCSS_SRC_PATH="$ROOT_PATH/src/scss"


# builds the css file from the sass one
rm $STATIC_PATH/main.css
sass -t compressed $SCSS_SRC_PATH/main.scss > $STATIC_PATH/main.css 

# concat plugin css
cat $ROOT_PATH/plugins/*/css/*.css >> $STATIC_PATH/main.css

# concat client side javascript
rm $STATIC_PATH/miaou.concat.js
cat $CLIENT_SCRIPTS_SRC_PATH/*.js >> $STATIC_PATH/miaou.concat.js

# add plugin client side scripts
cat $ROOT_PATH/plugins/*/client-scripts/*.js >> $STATIC_PATH/miaou.concat.js

# minify the js using uglify.js
cwd=${PWD}
trap 'cd "$cwd"' EXIT
cd $STATIC_PATH
# -mt to mangle names
uglifyjs miaou.concat.js --screw-ie8 -cmt --reserved "chat,ed,gui,hist,md,mh,mod,ms,prof,usr,win,ws,wz,games,plugins" --output miaou.min.js --source-map miaou.min.js.map
echo gzipped size :
cat miaou.min.js | gzip -9f | wc -c
