

# Introduction

This documentation describes the long installation process. There is an alternative: you may use vagrant instead (see [related documentation](vagrant/vagrant.md)).

It also assumes you're on a recent Ubuntu *(help needed for the doc on other distributions)*.

It's a work in progress and you're invited to come chat with other developers on Miaou before and while installing.

# Standard Tools

You probably already have them if you coded on that computer. Basically you'll need recent versions of gcc, git, make, Python, etc.

	sudo apt-get install build-essential
	sudo apt-get install git
	sudo apt-get install tcl8.5

*(this should probably be completed)*


# iojs

Installing it from the sources rather than from binaries is easier and make updates straightforward.

	git clone git@github.com:iojs/io.js.git
	cd io.js/
	./configure 
	make
	sudo make install
	
*TODO: is something missing for npm?*

Note that `make` may take a while (about 10 to 20 minutes)

# redis

You must install and start redis. There's no specific configuration to do for Miaou (it's preferable to configure redis to *not* save on disk, as we only use it as a session cache making it possible to restart miaou without the users noticing).

	sudo apt-get install redis-server
	
There's several ways to start it. Here's the simplest one:

	redis-server &

## sass

Reference: http://sass-lang.com/install

	sudo apt-get install ruby ruby-dev
	sudo gem install sass

## uglify 

	sudo npm install -g uglify-js

# Installing Miaou

## Get the repository
You need to fetch the repository from github, either directly of after a fork.

For example if not forking:

	git clone https://githup.com/Canop/miaou.git
	cd miaou

When you'll want to update Miaou later, you'll do

	git pull origin

*TODO: explain how to deal with tagged stable releases*

## Fetch the npm dependencies

	npm install
	
## Build Miaou

	make

## Fill the configuration

Before to start configuring, copy the `config-default.js` file into `config.js`:

	cp config-default.js config.js

Most of the configuration is simple and documented in the file itself. We'll see how to set-up the database access and the OAUth authentication later in this document.

# Postgresql


## Installing postgresql

A different aventure every time. Basically it should be something like

	sudo apt-get install postgresql-9.4

but it might be a little harder...

## Creating the Miaou database and user

First create the DB and user, and grant the rights.

	> sudo su postgres
	[sudo] password for youruser: 
	postgres@yourcomputer:/home/youruser$ psql
	psql (9.4.0)
	Type "help" for help.

	postgres=# create database miaou;
	CREATE DATABASE
	postgres=# create user miaou with password 'chooseanotherpwdplease';
	CREATE ROLE
	postgres=# grant all privileges on database "miaou" to miaou;
	GRANT
	postgres=# SHOW hba_file;
				   hba_file			   
	--------------------------------------
	 /etc/postgresql/9.4/main/pg_hba.conf
	(1 row)

Now you must modify the `pg_hba.conf` file (whose location vary, hence the query) to allow a md5 authentication.

Add the following :

	local   all			 miaou								   md5

Then restart pg :

	sudo /etc/init.d/postgresql restart
	
## Start the pg shell

You'll need this shell every time you want to mess with the tables, or for the first installation. Here's how it's launched :

	psql -U miaou -W miaou
	
## Create the tables

The easiest solution is to copy-paste the content of /sql/postgres-creation.sql into the pg shell

## Configure miaou to connect the database

In the config.js file, set up the required configuration :

	"database": {
		"url": "postgres://miaou:choose-another-password-please@localhost/miaou",
		"native_pg": false
	},

# OAuth2 providers

You need to set up at least one OAuth provider.

* Google: create an OAuth account on https://code.google.com/apis/console/ 
* StackExchange: create an OAuth account on http://stackapps.com/apps/oauth/
* Github: create an OAuth account on https://github.com/settings/applications

With Google at least the same account can be used both for your local tests and for the deployement on a public server. Don't forget to register the callback with adresss `127.0.0.1`, not `localhost`.

Fill the relevant parts of the configuration `config.js`.


# start, stop, restart the application

Use the script:

	./restart.sh

# Configure a reverse proxy with nginx (optional)

This makes it easy to share the 80 port with other applications and to let nginx serve static resources for better performances.

Be careful that most servers aren't able to proxy websockets, which results in Miaou falling back to slow protocols. Don't try to use another server than nginx unless you really know what you do and how to check websockets correcly pass trough.

Installation is done with

	sudo apt-get install nginx

## Exemple configuration

	cd /etc/nginx/site-enabed
	vim www.yourdomain.conf

Copy (and maybe complete) this:

	 server {
		listen 80;
		root /var/www/miaou;
		index index.html;
		server_name www.www.yourdomain;
		error_page 404 /404.html;	  	  
	  
		# a reverse proxy for miaou, apart static which can be directly served
		#  (assuming the deploy script copies the static directory in /var/www/miaou/static)
		location / {
			access_log off;	
			proxy_pass http://www.www.yourdomain:8204/;
			proxy_http_version 1.1;
			proxy_set_header Upgrade $http_upgrade;
			proxy_set_header Connection "upgrade";
		}
		location /static/ {
			access_log off;
			location ~*  \.(jpg|jpeg|png|gif|ico)$ {
				expires 60d;
			}
		}
		location /socket.io/ {
			access_log off;	
			proxy_pass http://www.yourdomain:8204/socket.io/;
			proxy_http_version 1.1;
			proxy_set_header Upgrade $http_upgrade;
			proxy_set_header Connection "upgrade";
		}
	  }

Restart nginx:
	
	service nginx restart
	  

*TODO: SSL*
