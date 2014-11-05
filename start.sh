#!/bin/bash
# starts Miaou server in nohup and shows the log in the console
( nohup node main.js 2>&1 & echo $! > miaou.pid ) | tee -a server.log &

