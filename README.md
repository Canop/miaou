# Miaou

A chat server with authentication, persistent history, markdown formatting, private rooms, stars and votes, and a few other features.

You can see it in action or use it on http://dystroy.org/miaou.

To discuss the code and feature of Miaou, please come to [the dedicated room](http://dystroy.org/miaou/1?Miaou).

# Features

* Muti-room
* Public and Private rooms
* Persisted with no limit
* Searchable
* Votes
* Pin and star
* Markdown formatting, with keyboard shortcuts
* Message preview
* Image boxing
* Pings, optional desktop notification and loud pings
* Pings are cross-rooms
* Answers
* Message edition
* Permanent links
* All message links are in place (no new window, no passive extracts)
* Authorization levels and administration
* OAuth2 authentication (Google, StackExchange, GitHub)
* User names are global and unique to prevent impersonation
* Long messages appear reduced at first
* Mobile Touch devices optimized interface

# Technical stack

As described in [the help](http://dystroy.org/miaou/help#Technical_Stack), Miaou is mostly coded in JavaScript. Stuff includes node.js, PostgreSQL, OAuth2, socket.io, express, Bluebird, Redis, Jade, Passport.js, jQuery, sass/scss, Moment.js and nginx.

## License

[The MIT License](http://opensource.org/licenses/MIT)

Copyright (c) 2014 Denys Séguret <[http://dystroy.org/](http://dystroy.org/)>
