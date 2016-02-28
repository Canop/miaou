#!/bin/bash
# Unit testing
# buster must be installed (see http://busterjs.org)
# Simply execute test.sh

# nodification of miaou.format so that it can be required in tests
(echo "var miaou=function(f){f(miaou.fmt)};miaou.fmt={};module.exports=miaou.fmt;"; cat src/main-js/miaou.fmt.js; cat src/main-js/miaou.fmt.Table.js) > test/format/miaou.format.node.js

# calling buster
BUSTER_REPORTER=specification buster-test

