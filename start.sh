# nohup node main.js >> server.log 2>&1 < /dev/null &
nohup node main.js 2>&1 | tee -a server.log &
