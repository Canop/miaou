#!/bin/bash
# Unit testing
# buster must be installed (see http://busterjs.org)
# Simply execute test.sh

# nodification of miaou.format so that it can be required in tests
(echo "var miaou={};module.exports=miaou;"; cat src/main-js/miaou.format.js) > test/format/miaou.format.node.js

# calling buster
BUSTER_REPORTER=specification buster-test

# cleaning
rm test/format/miaou.format.node.js
