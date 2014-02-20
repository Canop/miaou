# Vagrant

Vagrant is used to help you quickly set up a development environment.

If you don't know vagrant, please go to its [documentation](http://www.vagrantup.com/).

## How to

TL;DR:

    vagrant up

For now, it's only been tested on OSX/Linux, but should work on Windows as well.

Once the machine is up, simply run:

    vagrant ssh

Go to `/vagrant/`, and you'll see the `miaou` files.

Change the `config.json` file to your liking. Here is the postgresql configuration for the user that vagrant creates:

- Database name: `miaou`
- Database user: `miaou_user`
- Database password: `password`

Run `node main.js` to launch the server. Open your browser at `http://localhost:8204/` and start hacking!
