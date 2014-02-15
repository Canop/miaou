# Vagrant

Vagrant is used to help you quickly set up a development environment.

If you don't know vagrant, please go to its [documentation](http://www.vagrantup.com/).

## How to

TL;DR:

    ./vagrant-deps
    vagrant up

For now, it's only been tested on OSX/Linux.

The `vagrant-deps` script installs a few [Puppet](http://puppetlabs.com/) dependencies necessary for the vagrant VM to properly install itself.

Once the machine is up, simply run:

    vagrant ssh

Go to `/vagrant/`, and you'll see the `miaou` files. Run `node main.js` to launch the server. Open your browser at `http://localhost:8204/` and start hacking!
