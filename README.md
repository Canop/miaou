# Miaou

A chat server with authentication, persistent and searchable history, rich markdown formatting, video, private rooms, conversation highlighting, plugins, persisted notifications, code and table rendering, specialized link boxing, github hooks, bots, and many other features.

![screenshot](https://i.imgur.com/gqHo9Mu.png)

[![Build Status](https://travis-ci.org/Canop/miaou.svg?branch=master)](https://travis-ci.org/Canop/miaou)
[![Chat on Miaou](https://miaou.dystroy.org/static/shields/room-en.svg?v=1)](https://miaou.dystroy.org/1?Miaou)
[![Chat on Miaou](https://miaou.dystroy.org/static/shields/room-fr.svg?v=1)](https://miaou.dystroy.org/3?Code_Croissants)

**[Introduction/Gallery](http://miaou.dystroy.org/static/intro.html)**

You can see it in action or use it on https://dystroy.org/miaou (anybody can create a room for public or private use on this server).

# Discussing features, bugs, problems, issues

Please come discuss it in one of the dedicated chat rooms [![Chat on Miaou](https://miaou.dystroy.org/static/shields/room-en.svg?v=1)](https://miaou.dystroy.org/1?Miaou) and [![Chat on Miaou](https://miaou.dystroy.org/static/shields/room-fr.svg?v=1)](https://miaou.dystroy.org/3?Code_Croissants) before you create an issue in the GitHub tracker (please note that they're currently more active between 8 and 19 GMT).

# Installing a server

If you want to install Miaou, the installation documentation is available [here](installation.md).

And if you run your own server, please tell us.

# Contributing

As described in [the help](https://dystroy.org/miaou/help#Technical_Stack), Miaou is mostly coded in JavaScript. Stuff includes node, PostgreSQL, OAuth2, socket.io, WebRTC, express, Bluebird, Redis, Jade, Passport.js, hu.js, jQuery, sass/scss, Uglify-js, gulp, travis-ci, and nginx.

Many features are implemented as plugins, and that's where you should look first: [Plugin developpement](plugins/README.md).

If you have the ability and will to contribute, come and discuss with us. The best landing place is usually the [Miaou room](http://dystroy.org/miaou/1?Miaou) where you can ping @dystroy or @Florian.

Help is welcome but remember:

1. Come and discuss with us before to code
2. And, **always test before doing a pull request**.

## License

Most of Miaou follows the [MIT License](http://opensource.org/licenses/MIT). Exceptions are specified [here](license.md).

Copyright (c) 2014 Denys Séguret <[https://www.dystroy.org/](https://www.dystroy.org/)>
