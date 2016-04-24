# Miaou

A chat server with authentication, persistent and searchable history, rich markdown formatting, video, private rooms, conversation highlighting, plugins, persisted notifications, and many other features.

[![Build Status](https://travis-ci.org/Canop/miaou.svg?branch=master)](https://travis-ci.org/Canop/miaou)
[![Chat on Miaou](https://dystroy.org/miaou/static/shields/room-en.svg?v=1)](https://dystroy.org/miaou/1?Miaou)
[![Chat on Miaou](https://dystroy.org/miaou/static/shields/room-fr.svg?v=1)](https://dystroy.org/miaou/3?Code_Croissants)

**[Introduction/Gallery](http://dystroy.org/miaou/static/intro.html)**

You can see it in action or use it on http://dystroy.org/miaou (anybody can create a room for public or private use on this server).

To discuss the code and feature of Miaou, please come to [the dedicated room](http://dystroy.org/miaou/1?Miaou).

# Installing a server

A [vagrant](http://www.vagrantup.com/) configuration is available to help you set up a development environment quickly. See more information at its [documentation](vagrant/vagrant.md).

If you prefer to use [docker](https://www.docker.com/) as development environment, it's also available. See more information at its [documentation](docker/README.md).

If you want to install Miaou on your own, the installation documentation is available [here](installation.md).

And if you run your own server, please tell us.

# Contributing

As described in [the help](http://dystroy.org/miaou/help#Technical_Stack), Miaou is mostly coded in JavaScript. Stuff includes node, PostgreSQL, OAuth2, socket.io, WebRTC, express, Bluebird, Redis, Jade, Passport.js, hu.js, jQuery, sass/scss, Uglify-js, gulp, travis-ci, and nginx.

If you have the ability and will to contribute, come and discuss with us. The best landing place is usually the [Miaou room](http://dystroy.org/miaou/1?Miaou) where you can ping @dystroy or @Florian. We'll show you where we manage ideas, reports, [tasks](https://trello.com/b/s4adghOI/miaou-tasks) and you'll see the list of tasks waiting for a volunteer.

Help is welcome but remember:

1. Come and discuss with us before to code
2. And, **always test before doing a pull request**.

## License

Most of Miaou follows the [MIT License](http://opensource.org/licenses/MIT). Exceptions are specified [here](license.md).

Copyright (c) 2014 Denys Séguret <[http://dystroy.org/](http://dystroy.org/)>
