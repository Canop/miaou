#!/bin/bash
# kills the last instance of Miaou started with start.sh or restart.sh
kill -INT $(<miaou.pid)
rm miaou.pid
