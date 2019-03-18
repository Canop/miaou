

# Introduction


This document assumes you're on a recent Debian or Ubuntu *(help needed for the doc on other distributions)*.

It's a work in progress and you're invited to come chat with other developers on Miaou before and while installing.

# Standard Tools

You probably already have them if you coded on that computer. Basically you'll need recent versions of gcc, git, Python, etc.

	sudo apt-get install build-essential
	sudo apt-get install git
	sudo apt-get install tcl8.5

*(this should probably be completed)*


# node & npm

There are various valid ways to install them. Be sure to install a recent version of node. Versions lower than 11 aren't compatible with Miaou.

# gulp cli

	npm install -g gulp-cli

# redis

You must install and start redis. There's no specific configuration to do for Miaou (it's preferable to configure redis to *not* save on disk, as we only use it as a session cache making it possible to restart miaou without the users noticing).

	sudo apt-get install redis-server

There's several ways to start it. Here's the simplest one:

	redis-server &

# Installing Miaou

## Get the repository
You need to fetch the repository from github, either directly of after a fork.

For example if not forking:

	git clone https://github.com/Canop/miaou.git
	cd miaou

When you'll want to update Miaou later, you'll do

	git pull origin

*TODO: explain how to deal with tagged stable releases*

## Fetch the npm dependencies

	npm install

## Build Miaou

To build the application, run

	gulp

If you want a continuous build of the client side files, in order to test while you code, do

	gulp watch

## Test

You only need to do it when you change the source code.

	./test.sh

## Fill the configuration

Before to start configuring, copy the `config-default.js` file into `config.js`:

	cp config-default.js config.js

Most of the configuration is simple and documented in the file itself. We'll see how to set-up the database access and the OAUth authentication later in this document.

# Postgresql


## Installing postgresql

A different aventure every time. Basically it should be something like

	sudo apt-get install postgresql

but it might be a little harder.

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

Add the following at the start of the list of authentication methods:

	local   all			 miaou								   md5

Then restart pg :

	sudo /etc/init.d/postgresql restart

## Start the pg shell

You'll need this shell every time you want to mess with the tables, or for the first installation. Here's how it's launched :

	psql -U miaou -W miaou

## Create the tables

A solution is to copy-paste the content of `/sql/postgres-creation.sql` into the pg shell.

Alternatively you can run the script from the standard shell using

        psql -U miaou -d miaou -a -f postgres.creation.sql

Note that you won't have to update the tables yourself, Miaou takes care of this updating when the schema changes or when a plugin needs a specific table.

## Configure miaou to connect the database

In the config.js file, set up the required configuration :

	"database": {
	        database:"miaou",
		user:"miaou",
		password:"choose-another-password-please",
		"url": "postgres://miaou:choose-another-password-please@localhost/miaou",
		"native_pg": false
	},

# OAuth2 providers

You need to set up at least one OAuth provider.

* Google: create an OAuth account on https://code.google.com/apis/console/
* StackExchange: create an OAuth account on http://stackapps.com/apps/oauth/
* Github: create an OAuth account on https://github.com/settings/applications

To fill the relevant parts of the configuration config.js, look for that commented part:

	// OAuth providers. Remove or comment the ones you don't want to use

Once found, put the relevant info.

	oauth2: {
		"google": { // create one at https://code.google.com/apis/console/
			"clientID": "your client ID",
			"clientSecret": "your client secret"
		},
		"stackexchange": { // create one at http://stackapps.com/apps/oauth/
			"clientID": "your client ID",
			"clientSecret": "your client secret"
		},
		"github": { // create one at https://github.com/settings/applications
			"clientID": "your client ID",
			"clientSecret": "your client secret"
		},
		"reddit": {
			"clientID": "your client ID",
			"clientSecret": "your client secret"
		}
	},

Note: The clientId for Google look like this

		"clientID": "883537075919-amp1s8ddogixnidpmu1kttvvhllqv1qt.apps.googleusercontent.com853539085919-amp1s8dqogiqnidump1kttvvhllqv1qt.apps.googleusercontent.com"

And the client secret for Google like this below

		"clientSecret": "ceMq7gk81IltKHZZJiUVtU4Z"


With Google at least the same account can be used both for your local tests and for the deployment on a public server. Don't forget to register the callback with address `127.0.0.1`, not `localhost`.

For example with Google OAuth2, the registered callbacks used for the dystroy Miaou server are

	http://127.0.0.1:8204/auth/google/callback
	https://miaou.dystroy.org/auth/google/callback

The first one is for the local tests, the second one for the public server.

Hint: With Google as provider you now need to enable the Google+ API in the Google console developper (simply go to https://console.developers.google.com then look for "Google+" API in the Enable API menu).

Hint: OAuth providers often need a small delay before propagating the changes so you might have to wait a few minutes before it works.

# start, stop, restart the application

Use the script:

	./restart.sh

# Configure a reverse proxy with nginx (optional)

This makes it easy to share the 80 port with other applications and to let nginx serve static resources for better performances. It's also the recommended solution to serve Miaou in HTTPS.

Don't try to use another proxy than nginx unless you really know what you do and how to check websockets correctly pass trough.

Installation is done with

	sudo apt-get install nginx

## Example configuration

	cd /etc/nginx/site-enabled
	vim www.yourdomain.conf

Copy (and maybe complete) this:

	 server {
		listen 80;

		# remove the following lines if you don't want to serve miaou over https
		listen 443 ssl;
		if ($ssl_protocol = "") {
			rewrite ^ https://$host$request_uri? permanent;
		}
		ssl_certificate some-path.crt;
		ssl_certificate_key some-other-path.key;

		root /var/www/miaou;
		index index.html;
		server_name www.yourdomain;
		error_page 404 /404.html;

		# a reverse proxy for miaou, apart static which can be directly served
		#  (assuming the deploy script copies the static directory in /var/www/miaou/static)
		location / {
			access_log off;
			proxy_pass http://www.yourdomain:8204/;
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

