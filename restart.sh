#!/bin/bash
# restarts Miaou: with systemd where the miaou service exists (prod server), else with kill.sh and start.sh
if [ -f /etc/systemd/system/miaou.service ]; then
	sudo systemctl restart miaou && sleep 2 && systemctl status miaou --no-pager | head -5
else
	./kill.sh
	./start.sh
fi
