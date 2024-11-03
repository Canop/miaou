#!/bin/bash

nvm use 12

# starts Miaou server in nohup and shows the log in the console
( nohup node --use_strict main.js 2>&1 & echo $! > miaou.pid ) | tee -a server.log &

