#!/bin/bash
# starts Miaou and shows the log in the console:
# with systemd where the miaou service exists (prod server), else in nohup
if [ -f /etc/systemd/system/miaou.service ]; then
	sudo systemctl start miaou && journalctl -u miaou -f -n 20
else
	( nohup node --use_strict main.js 2>&1 & echo $! > miaou.pid ) | tee -a server.log &
fi
