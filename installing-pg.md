
# Installing postgresql

A different aventure every time. Basically it should be something like

    sudo apt-get install postgresql-9.4

but it might be a little harder...

# Creating the database and user

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

	local   all             miaou                                   md5

Then restart pg :

	sudo /etc/init.d/postgresql restart
	
# Start the pg shell

You'll need this shell every time you want to mess with the tables, or for the first installation. Here's how it's launched :

	psql -U miaou -W miaou
	
# Create the tables

The easiest solution is to copy-paste the content of /sql/postgres-creation.sql into the pg shell

# Configure miaou

In the config.json file, set up the required configuration :

	"database": {
		"url": "postgres://miaou:chooseanotherpwdplease@localhost/miaou",
		"native_pg": false
	},

You may now try to start miaou (with `./start.sh` for example), but only after you've build the application using `make`.
