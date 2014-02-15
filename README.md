# Miaou

A chat server with authentication, persistent and searchable history, markdown formatting, private rooms, stars and votes, and a few other features.

You can see it in action or use it on http://dystroy.org/miaou.

To discuss the code and feature of Miaou, please come to [the dedicated room](http://dystroy.org/miaou/1?Miaou).

# Features

* Muti-room
* Public and Private rooms
* Persisted
* Searchable
* Votes
* Pin and star
* Markdown formatting, with keyboard shortcuts
* Message preview
* Image boxing
* Pings, optional desktop notification and loud pings
* Cross-rooms pings 
* Answers
* Message edition
* Permanent links
* All message links are in place (no new window, no passive extracts)
* Authorization levels and administration
* OAuth2 authentication (Google, StackExchange, GitHub)
* User names are global and unique to prevent impersonation
* Long messages appear reduced at first
* Mobile Touch devices optimized interface
* Plugins enabling the verification the chat user is linked to external profiles

# Compatibility

## Desktop

Miaou works on Chrome, Firefox and Safari. It doesn't on Internet Explorer.

## Mobile devices

Miaou should work on most webkit based browsers in recent Android devices (KitKat might be a requirement).

# Technical stack

As described in [the help](http://dystroy.org/miaou/help#Technical_Stack), Miaou is mostly coded in JavaScript. Stuff includes node.js, PostgreSQL, OAuth2, socket.io, express, Bluebird, Redis, Jade, Passport.js, jQuery, sass/scss, Moment.js, Uglify-js and nginx.

A [vagrant](http://www.vagrantup.com/) configuration is available to help you set up a development environment quickly. See more information at its [documentation](vagrant.md).

## License

[The MIT License](http://opensource.org/licenses/MIT)

Copyright (c) 2014 Denys Séguret <[http://dystroy.org/](http://dystroy.org/)>
