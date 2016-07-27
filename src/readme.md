This directory contains files that will be moved out of here, concatenated, minified or modified before execution (see gulpfile).

## main-js

The scripts that make /static/miaou.min.js. They're concatenated and minified.

## page-js

Scripts only used in specific pages, minified and then moved to /static.

## main-scss

Sources of the main css file. They will be merged with the files in /themes, compiled to css and then copied to the /static/themes sub-directories.

## page-scss

Sources of page specific css files.

## rsc

Those files will be copied as is in the /static directory.
