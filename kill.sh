#!/bin/bash
# stops Miaou: with systemd where the miaou service exists (prod server),
# else kills the last instance started with start.sh or restart.sh
if [ -f /etc/systemd/system/miaou.service ]; then
	sudo systemctl stop miaou
else
	kill -INT $(<miaou.pid)
	rm miaou.pid
fi
