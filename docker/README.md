Miaou development environment using Docker
===
**Build a local tiny Virtual Machine which allows you to run Miaou on any OS (including Windows/OS X)**


## Requirements (for Windows/OS X users only, Linux can [run Docker on its own](https://docs.docker.com/installation/ubuntulinux/))

 - [Docker-machine](https://docs.docker.com/machine/#installation) ([version 0.3.0+](https://github.com/docker/machine/releases)) => an executable to rename `docker-machine` and to move somewhere in your `PATH`
 - [VirtualBox](https://www.virtualbox.org/wiki/Downloads)


## What's inside?

### docker-machine-dev(.bat/.sh) (for Windows/OS X users only)
A simple yet powerful script that use Docker Machine to build a local Docker aware VM (it uses boot2docker in the background). 
It's also used to set some useful aliases in the VM (such as`docker-compose` which run Docker Compose in a container).

### Dockerfile
 - Miscellaneous useful Ubuntu packages
 - Python (needed to build some `npm` dependencies)
 - Ruby and `sass`
 - IOJS with `nodemon`, `uglify-js` and `buster` globally installed

### docker-entrypoint.sh
This file is the default ENTRYPOINT of the image. It will be executed every time you run the Miaou container. This is where you should put all your project specific stuff (e.g. run services, run a Makefile, etc.).

### docker-compose.yml
This file (using Docker Compose) is the recommended way to build the whole environment. It will run and link several containers through a single command. 
Keep in mind that this could also be done using many long `docker` commands without the need of `docker-compose` at all.


## How to use?

### First time (assuming you already cloned your fork)

 1. Go to the docker directory `cd /path/to/miaou/docker` and type `docker-machine-dev` (if on Windows) or `./docker-machine-dev.sh` (if on OS X).
If you followed the [Requirements](#requirements), after a few seconds you will be landed in the VM where you will be able to run `docker` commands.

 2. Now that you are in your VM, you can build the image `docker-compose` with: 
	```
	docker build -t docker-compose github.com/docker/compose
	```
At this point, you should be able to run `docker-compose` which is an alias picked from `docker-machine-dev` script.
 
 3. Then, again, `cd` to the docker directory (the VM shared your `C:\Users\` (windows) or `/Users/` (os x) folder as `/c/Users/` or `/Users/` --- see [complete reference here](https://github.com/boot2docker/boot2docker#virtualbox-guest-additions)).
 
 4. Build and run the whole Miaou environment with:
	```
	docker-compose run miaou
	```
It will leave you in the Miaou container at `/var/www/html` where you will be able to manage everything like if you were on a server with everything installed.
If you `exit` this container, it will be stopped then you'll have 2 solutions to come back in it:
    - Remove the container with `docker rm docker_miaou_run_1` then run it again with `docker-compose run miaou` 
    - Restart the container with `docker start docker_miaou_run_1` then execute `bash` in it with `docker exec -it docker_miaou_run_1 bash`
 
 5. Once you have all the containers running, you'll have to create all the tables in your database. The whole database is running in its own container.
In order to be able to run SQL commands, type `docker exec -it docker_postgres_1 psql -U miaou -w`.
Now that you have a prompt for `miaou` psql user, copy/paste the content of the SQL creation file located at `sql/postgres.creation.sql` in Miaou sources, then exit the container with `\q`.

 6. Copy the `docker/config.js` preconfigured file to the root of the Miaou sources.

 7. Now to be able to log in Miaou, you have to set a OAuth provider (here we'll use Google which is really easy to configure).
First, go to `https://console.developers.google.com/project`, create a new project, then go to `APIs & auth` > `Credentials` to `Create new OAuth Client ID`.
Select `Web application` as *Application type*, set `http://miaou.dev` as *Authorized Javascript origins* and `http://miaou.dev/auth/google/callback` as *Authorized redirect URIs*.
Now you'll be given a *Client ID* and a *Client secret* that you'll have to copy/paste in the `config.js` file.
 
 8. At this point, you should be able to start Miaou. 
Go back to the Miaou container (see step 4. if you exited the container), run `make` to build all Miaou assets, then run the application with `nodemon main.js` (thanks to nodemon, the server will restart automatically after each file modification).
 
 9. Finally, update your own **hosts file** (e.g. `C:\Windows\System32\drivers\etc\hosts` on Windows) to bind the VM IP address to `miaou.dev`.
You can check the VM IP by running `docker-machine ip dev` in your host terminal. Typically, it should be `192.168.99.100`.
So add this line to your hosts file:
	```
	192.168.99.100 miaou.dev
	```

 10. Now you should see your Miaou application running in your host browser at `miaou.dev`.

When you want to stop contribute to Miaou, `exit` your VM then stop it with `docker-machine stop dev`.

### Second time and more

```
# Host terminal
cd C:\Users\myMiaouSources\docker
docker-machine-dev
# VM terminal
cd /c/Users/myMiaouSources/docker
docker-compose run miaou
# Miaou container
nodemon main.js
```


## Troubleshooting

### `npm install` fails in my project
This issue comes from your application shared folders, `vboxsf` seems to be not powerful enough to handle so many files.
There are currently 2 workarounds for this kind of issue:

- In your Miaou container, copy the `package.json` file to another (not shared) directory. Run `npm install` there. Then copy back the new `node_modules` directory to the root of Miaou sources.

or

- Run `npm install` on your host machine (it requires you to have `npm` already installed on your host of course). 
