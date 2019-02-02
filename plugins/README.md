# Anatomy

Plugins are extensions of Miaou, installed on the server, and having those parts:

1. some server-side javascript code, executed in the same process than Miaou
1. some client-side javascript code, concatenated and minified with Miaou's core javascript code
1. some CSS and SCSS
1. some static resources, served without modidification
1. sql scripts used to install and update plugin's tables

While everything is optional, a server side file is necessary for plugin activation (its path is written in the config). It may be empty though.

There's no sandboxing, plugins can read, change, and break everything. A plugin must thus be validated by the server owner before being installed.

Before messing with plugins, installing them, or making new ones, you should be familiar with the general working of Miaou and have a server [installed](../installation.md). While the present document should provide a complete enough description of plugins, looking at the existing standard plugins should be considered the next logical step to acquire familiarity.

# Adding a plugin to Miaou

Adding an existing plugin into your Miaou installation is a three step process:

1. Installation
1. Compilation with Miaou
1. Enabling

Some plugins are standard, and can be found in the `plugins` directory of the miaou repository. They don't have to be installed, they must only be enabled.
Non standard plugins, coming from another repository, have exactly the same structure but aren't distributed with Miaou. In order to be available, they must be installed, that is usually just copied to the ̀"plugins" directory of Miaou.

After a plugin is installed, its scripts, styles and resources can be made available by miaou compilation, which is done using

	npm build

The last step is enabling the plugin in the config.js file, which is done by adding the path to the main plugin file:

	// list of the plugins you want to activate. You may add your ones
	plugins: [
		"./plugins/stackoverflow/plugin.js",
		"./plugins/wikipedia/plugin.js",
		"./plugins/my-plugin/plugin.js",
	],

Some plugins may require a specific configuration. The convention is to add it in the "pluginConfig"/"yourPluginName" section of the config.js file.

Now that the plugin is enabled, it will be available next time you restart Miaou:

	./restart.sh

# General Operation of a Plugin

## Server Side Operation

Most server side operations of a plugins are exported functions called by Miaou's core. Those functions have conventionnal names (see the "server side hooks" chapter), which avoids the task of registering them: the core calls the function if it is found in the plugin, doesn't call anything otherwise.

Exemples of those functions are

* the `exports.init` function, usually dedicated to fetching some configuration or starting some periodic task
* the `exports.registerRoutes` function, in which a plugin can declare Express routes to directly answer HTTP requests
* the `exports.registerCommands` function, in which all !! commands of a plugin are declared

Additionnaly to those functions, it's good practice to export also the name of the plugin, as `exports.name = "somestring";`.

## Client Side Operation

The client side part of a plugin's javascript code is, comparatively, much more open, there's no real difference with the core code.

Like all client side scripts, plugin modules are declared with the `miaou` function whose arguments are all the modules it uses. For example, here's the `attention` client-side code:


	miaou(function(attention, chat, locals, plugins, ws){

		function onNotable(m, $md){
			...
		}

		function onAlert(alert){
			...
		}

		function onRemove(mid){
			...
		}

		plugins.attention = {
			start: function(){
				chat.on('notable', onNotable);
				ws.on('attention.alert', onAlert);
				ws.on('attention.remove', onRemove);
			}
		};
	});

Here an object with a ̀`start` function is added to the `plugins` plugin registry. The `start` hook is defined. This function is automatically called when the chat's client code is ready to run. In this function, event listeners are registered using the same registering functions used by the standard core code:

* `chat.on('notable'` registers a listener wich will be called when a notable message is displayed
* `ws.on(` registers a listener which will be called on specific events coming on the user's socket.io socket

More details about those hooks are available in the relevant chat and ws modules.

# Database

While a plugin can technically do anything in database using the core API, it should avoid modifying the core structure or querying core records.

It should instead install, update and query its own tables.

The same mechanism used for core table update is available for plugins: A plugin shoud contain a list of SQL scripts named sql/number-name.sql where number starts at 1 and is incremented for every new script.

At server start, if the plugin is enabled, scripts whose number is greater than the last executed script for that plugin are executed, in order.

That behavior is triggered at plugin start in the init function of the plugin:


	exports.init = function(miaou){
		db = miaou.db;
		return db.upgrade(exports.name, path.resolve(__dirname, 'sql'));
	}


# Commands

A command is issued by the user in a message starting with `!!` (possibly with a ping or reply mark before).

Command listeners are registered by plugins using the `registerCommand` callback they are given if they export the `registerCommands` function:

	exports.registerCommands = function(registerCommand){
		registerCommand({
			name: 'broadcast',
			fun: broadcast,
			help: "send a flake to all rooms",
			detailedHelp: "Only server admins can do that"
		});
	}

The `registerCommand` callback accepts an object with the following properties:

- `name`: how the command will be called by the user
- `fun(commandTask)`: the function which will be called for command execution
- `botfun()` : the function called for command execution when the message author is a server bot
- `filter(room)` : a function answering true if the function is available in that room
- `help` : a short help displayed in the command list
- `detailledHelp` : a text displayed when the user requires the help of that specific command

Only the `name`, `fun` and `help` properties are mandatory.

## `fun` callback

This function is called with context (`this`) being the DB transaction handling the message. It is called before the message is saved in database and can thus change its content or prevent the saving. If its action is asynchronous and it's better to have it done before the following steps (saving, ping distribution, boxing, etc.) then it should delay those steps by returning a promise.

The `fun` function is passed as argument an instance of `CommandTask` whose properties are:

- `cmd`: the name of the command used (the same used for registration)
- `message`: the message object (whose properties are the content, author, id when it's already saved, etc.)
- `args`: the optional arguments of the command (what comes after `!!command` in the message's first line
- `shoe`: an instance of `Shoe`, on which the command implementation can execute socket related actions
- `nostore`: a boolean that can be set to true to prevent the message storage in database
- `silent`: a boolean that can be set to true to prevent the message distribution

Additionnaly, this object offers the following methods:

- `reply(content, asFlake)`: sends a reply to the command's message
- `text`:  set or get the content of the command message

Example: a command replying "pong" to every !!ping command would be defined with

	exports.registerCommands = function(registerCommand){
		registerCommand({
			name: 'ping',
			fun: function(ct){
				ct.reply("pong");
			},
			help: "pong..."
		});
	}

(this can be the whole plugin)

## `botfun` callback

Like the `fun` callback, `botfun` is called with context a DB transaction and it may return a promise. But it is not passed an instance of commandTask but the following arguments:

- `cmd`: the name of the command used (the same used for registration)
- `args`: the optional arguments of the command (what comes after `!!command` in the message's first line
- `bot`: the bot author of the message
- `message`: the message object (whose properties are the content, author, id when it's already saved, etc.)


# Bots

Bots are the authors of messages that aren't sent from a browser (which is presumed used by a human). The default miaou bot, whose name is miaou, is the natural author of most of them, perfectly suited to any simple message. It's the author of messages sent from server code when no bot is specified (for example `ct.reply` in the last example).

But when the bot must have a personnality, for example because he's a Tribo player, or is a proxy for a distant service, for example he notifies of events on GitHub repositories, then a specific bot should be defined and used.

## Get a bot

For most purposes, a bot is a normal registered user, with a dedicated record in the `player` table of the database, but with the `bot` boolean set to true.

A plugin which needs a bot should

1. fetch it by name from the database using the `getBot` function which creates it if necessary
1. update its fields (avatar, description, etc.)

Example:

	var	me;

	exports.init = function(miaou){
		var db = miaou.db;
		var botConf = miaou.conf("pluginConfig", "myPlugin", "bot");
		return db.on(botConf.name).then(db.getBot)
		.then(function(bot){
			me = bot;
			if (botConf.avatar.src!==me.avatarsrc || botConf.avatar.key!==me.avatarkey) {
				me.avatarsrc = botConf.avatar.src;
				me.avatarkey = botConf.avatar.key;
				return this.updateUser(me)
			}
		}).finally(db.off);
	}

## Send messages

The simplest way to send a message as a bot is to use the `botMessage` function of the `ws` module:

		var ws = require("../../libs/ws.js");
		ws.botMessage(me, roomId, "Hello World");


## Listen for pings

A plugin can read any message (see [onReceiveMessage](#onReceiveMessage)) but it's preferable to avoid useless parsings. The standard way for a bot to react to the right messages is to listen for commands but it can also be part of a conversation by listening to pings:

	const	bots = require('../../libs/bots.js'),
	var	me;

	exports.init = function(miaou){
		... bot initialization here ...
		.then(function(){
			bots.register(me, {
				onPing: async function(shoe, message){
					shoe.botMessage(me, "Hi");
				}
			});
		})
		.finally(db.off);
	}

# Boxing

Boxing is the replacement of one line of a message by a different content. Most typical examples are the replacement of the URL to an image by the image itself (i.e. an HTML img element) or the URL of a Wikipedia page by an abstract of that page.

## Using the page boxer

The most usual server-side boxing follows this logic:

1. a message is sent to a browser (a new or updated message, or maybe an old one because the user looks to the past)
1. the server detects that a line in a sent message matches a specific regular expression
1. the server looks in the cache (a LRU cache with a TTL of 30 minutes), to look if that URL has been requested recently. In that case, it goes to 8 if it was a success, or just gives up if it failed
1. the server queries that URL
1. if that query failed, it gives up, just noting it in the cache so that it isn't fetched again too soon
1. if it was a success it builds an abstract, using cheerio (a server-side API similar to jQuery)
1. it stores that abstract in the cache
1. the server sends a instruction to the browser (and to all other browsers which may have requested that message during the asynchronous fetching of the boxable content), telling it to replace a specific line of a specific message by the new content

Doing this correctly and efficiently is tedious, that's why there's a standard utility in Miaou making it easy for plugins to register boxings. You use it by registering your pattern and abstracting function using the `miaou.lib("page-boxers").register` function.

Here's for example how is done the urbandictionary boxing:

	exports.init = function(miaou){
		miaou.lib("page-boxers").register({
			name: "urban",
			pattern: /^\s*https?:\/\/(www\.)?urbandictionary\.com\/define\.php\?term=[^ ]*\s*$/,
			box: abstract
		});
	}

	function abstract($, line){
		var	$box = $('<div/>').addClass('urban'),
			$abstract = $('<div/>').addClass('abstract'),
			$def = $('.def-panel').eq(0);
		$box.append($abstract);
		if ($def.length) {
			$abstract.append($("<h1>").append(
				$("<a>").attr("href", line).attr("target", "_blank").text(
					"Urban Dictionary: " + $def.find(".def-header").text()
				)
			));
			$abstract.append($("<p>").text($def.find(".meaning").text()));
		} else {
			$box.append("no definition found on Urban");
		}
		return $('<div>').append($box).html();
	}

## Building the URL

Most plugins ensuring the boxing of URLs also provide a companion feature, the building of that URL. For example when the user sends the message

	!!urban chat

the plugin should responds to that command with a message containing

	http://www.urbandictionary.com/define.php?term=chat

and this message would then be intercepted to be boxed.

Such a command is simple to make, here's the `!!urban` implementation:

	exports.registerCommands = function(cb){
		cb({
			name: 'urban',
			fun: onCommand,
			help: "display the relevant Urban Dictionary page. Example : `!!urban miaou`",
			detailedHelp: "You may also simply paste the URL of a page to have it abstracted for you."
		});
	}

	function onCommand(ct){
		ct.reply('\nhttp://www.urbandictionary.com/define.php?term='+encodeURIComponent(ct.args))
	}

# Themes & CSS

To define styles, a plugin can provide CSS files:  `plugins/<plugin>/css/*.css` files are automatically merged with the core styles.

A plugin maker must be aware Miaou is themable. As such, he can't define hardcoded colors and just hope they'll be fine with any theme. If coloring is necessary, then the solution is to use SCSS.

`plugins/<plugin>/scss/*.scss` files are compiled with core scss files, and may use all the variables defined in themes and whose names are listed in `src/main-scss/variables-default.scss`. This makes it possible to reuse theme tuned colors either as is or using one of the color transformation functions of scss.

# Static Resources

Static resources that must be served without changes must be present in the `rsc` sub-directory of the plugin directory.

A file whose path is

	plugins/<plugin-name>/rsc/<filename>

is visible from the chat with this relative URL:

	static/plugins/<plugin-name>/rsc/<filename>

# Reference: Server Side Hooks

All those functions, when declared in the exports of the main plugin file (the one referenced in configuration), are called by the core server as part of its operations. Many examples of those hooks can be found in the standard plugins.

## appuse

	appuse(req, res, next)

Act as an Express middleware, called after authentication middlewares. Note: when the purpose is to add routes, it's better to export `registerRoutes`.

Follow the Express API: https://expressjs.com/en/4x/api.html#app.use

## init

	init(miaou)

Called before the server goes live, this is typically where plugins fetch their configuration, the global bot, the database facade or launch initializations.

When its action is asynchronous, the init function should return a promise (unless the server can immediately start).

Example:

	exports.init = function(miaou){
		db = miaou.db; // store locally a reference to the DB facade
		miaouBot = miaou.bot; // store a reference to the bot, for later use
		threshold = miaou.conf("pluginConfig", "myPlugin", "threshold") || 33; // read a plugin's configuration property
		return db.upgrade(exports.name, path.resolve(__dirname, 'sql')); // ensure the plugin's tables are up to date
	}

## registerCommands

	registerCommands(registerCallback)

Let the plugin register commands that the user will be able to issue. See the [Commands](#Commands) chapter.

Example:

	exports.registerCommands = function(registerCommand){
		registerCommand({
			name:'broadcast',
			fun:broadcast,
			help:"send a flake to all rooms",
			detailedHelp:"Only server admins can do that"
		});
	}

## registerRoutes

	registerRoutes(registerCallback)

Let the plugin map routes to Express middleware. This is rarely needed as the chat mostly communicates using sockets but sometimes you may want to implement some data export, or a web-hook, or some upload facility, this is when `registerRoutes` is needed.

The `registerCallback` takes the following arguments:

- HTTP verb
- route
- Express middleware
- boolean set to true if a complete profile (with a name) isn't needed
- boolean set to true if a valid login isn't needed

Example:

	exports.registerRoutes = function(map){
		map('get', '/say-hi', function(req, res, next){
			res.send("Hi " + req.user.name + "!");
		});
	}


## onNewShoe

When a user connects to the Miaou chat, an instance of `Shoe` is created and wraps a socket along with a few other information.
As soon as it has completed the room entry process (which implies the `room` property of the shoe is set), all plugins exporting the `onNewShoe` function are called and passed that shoe so that they can listen for socket.io events.

This is most commonly used for communication between the client and server parts of a plugin.

For example the client side part of the Ludogene plugin (which lets you play Tribo game) does this when a player does a move:

	ws.emit('ludo.move', {
		mid: panel.m.id,
		move: Tribo.encodeMove({p:panel.u, x:i, y:j})
	});

And the server part handles it this way:


	exports.onNewShoe = function(shoe){
		shoe.socket
		.on('ludo.move', function(arg){
			var messageId = arg.mid;

			// here we fetch the message, check the move, update the state of the game, save it in db
			// then we propagate that move to all the users currently in the game message's room:

			ws.emitToRoom(messageId, "ludo.move", {mid: messageId, move: move});
		})
		.on('ludo.accept', function(arg){

			// start of a game: we do about the same thing than for incoming moves

		});
	}

## onReceiveMessage

This function is called when a message is received from a browser.

The incoming message may be new (no `id`) or a modified one (strictly positive `id`).

This function is called with arguments

- the shoe wrapping the socket on which the message was received
- the message


## onSendMessage

This hook is called for all messages sent from the server to a browser, be them new, updated or old ones. It's called with arguments

- the shoe
- the message
- a callback that can be used later to resend the message (for example if it has been asynchronously modified) or another one

Note that all messages emissions aren't guaranteed to go through this so no security solution should be dependant on this hook.
