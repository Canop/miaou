
// Rename this file to config.js and fill it to configure Miaou
// If necessary, you can build the config object dynamically

module.exports = {

	server: "http://yourdomain:8204", // the URL of Miaou as seen by the browser
	base: "/", 	// path to Miaou as seen by the browser
	port: 8204, // port on which to start Miaou (might be hidden from the browser by a proxy)

	trustProxy: false, // set to true when you add a front-end proxy

	// If your server is behind a proxy, the config may be different.
	// Here's the example of the Miaou server on http://miaou.dystroy.org/
	// 		server: "http://miaou.dystroy.org/",
	// 		base: "/miaou/",
	// 		port: 8204,

	// If you're installing locally in order to develop,
	//  here's a recommended configuration:
	//		server: "http://127.0.0.1:8204",
	//		base: "/",
	//		port: 8204,

	maxMessageContentSize:			5000,	// in characters
	minDelayBetweenMessages:		500,	// in milliseconds
	maxAgeForMessageEdition: 		500,	// in seconds
	maxAgeForMessageTotalDeletion:	200,	// in seconds

	secret: "some string you should keep secret",

	// bot avatar
	botAvatar: {
		src:"url", key:"http://miaou.dystroy.org/static/M-150.png"

		// you may use another type of avatar. Examples :
		// "src":"facebook", "key":"123456789"
		// "src":"gravatar", "key":"some@email"
		// "src":"gravatar", "key":"0a74859ec2d68811668fc44bb32b53e5"
		// "src":"twitter", "key":"123456789"
	},

	database: {
		database: "miaou",
		user: "miaou",
		password: "choose_a_password",
		native_pg: false // let it to false unless you're a wizard
	},

	// connect-redis session store options. Leave empty to use default ones
	redisStore: {
	},

	// list of the plugins you want to activate. You may add your ones
	plugins: [
		"./plugins/stats/plugin.js",
		"./plugins/stackoverflow/plugin.js",
		"./plugins/wikipedia/plugin.js",
		"./plugins/github-identity/plugin.js",
		"./plugins/scm-hooks/plugin.js",
		"./plugins/video/plugin.js",
		"./plugins/whiteboard/plugin.js",
		"./plugins/youtube/plugin.js",
		"./plugins/survey/plugin.js",
		"./plugins/graph/plugin.js",
		"./plugins/hashcolor/plugin.js",
		"./plugins/shield/plugin.js",
		"./plugins/table-controls/plugin.js",
	],

	// specific configurations required by plugins
	"pluginConfig":{
		"video": {
			"webRTC": { // standard webRTC config passed to RTCPeerConnection
				"iceServers": [{
					urls: ["some STUN and or TURN server(s)"]
				}]
			}
		}
	},

	// available themes. The first one is the default theme
	"themes": [
		"snobbish-goldfish",
		"stingy-ray",
		"boring-goose",
		"slippery-seal",
		"perverse-otter",
		"sadistic-otter",
		"stoned-bear",
	],

	// the theme to use on mobile phones
	"mobileTheme": "stingy-ray",

	// OAuth providers. Remove or comment the ones you don't want to use
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

	// an imgur account is needed for image uploading
	// Create one at https://imgur.com/account/settings/apps
	imgur: {
		"clientID": "your client ID"
	},

	// Possible room languages (ISO lang codes)
	langs: ["en", "fr", "it"],

	// regular expressions of the names you want to forbid
	// Note that it's only verified at creation, it won't apply
	// to already created names
	forbiddenUsernames: ["miaou", "^server", "bot$", "^chat", "^every", "^all", "admin"],

	// identifiants of the rooms that are proposed as entry point to new users
	// (regular users of the server should be invited to watch those rooms)
	// Don't fill this array until you created the rooms
	welcomeRooms: [],

	// Server admins may have access to specific server wide admin commands
	// They can be specified using their id (which is constant)
	// or their name (which is easier)
	serverAdmins: [],

	"cleaning-frequencies": { // in seconds
		"old-access-requests": 2*24*60*60
	},

	// parameterization of the search
	"search": {
		// If true, expressions between quotes are considered as exact expression searches.
		// Right now this is costly and involves a full scan.
		exactExpressions: false,
		// Regular expressions are very powerful but they involve a full scan and they put
		// you at the risk of catastrophic backtracking
		regularExpressions: false,
	},

	// rate limits per day, hour or minute (per user). They're applied to expensive actions
	//  (mostly inserts in database)
	"throttler": {
		hour: 1000,
		minute: 50
	},
	legal: {
		introduction: "This is the 'about this server' part of the legal page."
	}
}
