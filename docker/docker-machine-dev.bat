@echo off

REM create machine if not already exist, then start it
docker-machine create --driver="virtualbox" --virtualbox-memory="2048" dev
docker-machine start dev

REM set environment variables for this machine
docker-machine env --shell="cmd" dev | sed 's/#/REM/g' > temp.cmd
call temp.cmd
del temp.cmd





REM
REM INDEPENDENT ALIASES
REM

REM alias dstop-all='docker stop $(docker ps -q)'
docker-machine ssh dev "echo \"alias dstop-all='docker stop \$(docker ps -q)'\" >> ~/.ashrc"

REM alias drm-all='docker rm $(docker ps -q --filter status=exited)'
docker-machine ssh dev "echo \"alias drm-all='docker rm \$(docker ps -q --filter status=exited)'\" >> ~/.ashrc"

REM alias drmi-notag='docker rmi $(docker images -q --filter dangling=true)'
docker-machine ssh dev "echo \"alias drmi-notag='docker rmi \$(docker images -q --filter dangling=true)'\" >> ~/.ashrc"

REM alias dclean-volumes='docker run --rm -v /var/run/docker.sock:/var/run/docker.sock:ro -v /var/lib/docker:/var/lib/docker martin/docker-cleanup-volumes:1.6.2'
docker-machine ssh dev "echo \"alias dclean-volumes='docker run --rm -v /var/run/docker.sock:/var/run/docker.sock:ro -v /var/lib/docker:/var/lib/docker martin/docker-cleanup-volumes:1.6.2'\" >> ~/.ashrc"

REM alias install-docker-compose='docker build -t docker-compose github.com/docker/compose'
docker-machine ssh dev "echo \"alias install-docker-compose='docker build -t docker-compose github.com/docker/compose'\" >> ~/.ashrc"

REM alias docker-compose='docker run --rm -it -v /var/run/docker.sock:/var/run/docker.sock -v $(pwd):$(pwd) -w $(pwd) docker-compose'
docker-machine ssh dev "echo \"alias docker-compose='docker run --rm -it -v /var/run/docker.sock:/var/run/docker.sock -v \$(pwd):\$(pwd) -w \$(pwd) docker-compose'\" >> ~/.ashrc"





REM connect to the machine
docker-machine ssh dev
