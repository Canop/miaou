
// Rename this file to config.js and fill it to configure Miaou
// If necessary, you can build the config object dynamically

module.exports = {
	
	// the URL of Miaou
	server: "http://yourdomain:8204",
	base: "/",
	port: 8204,
	
	// If your server is behind a proxy, the config may be different. 
	// Here's the example of the Miaou server on dystroy.org:
	// "server": "http://dystroy.org/miaou",
	// "base": "/miaou/",
	// "port": 8204,

	// max size of a message, in characters
	maxMessageContentSize: 5000,
	
	// durations are in seconds
	minDelayBetweenMessages: 500,
	maxAgeForMessageEdition: 3600,
	maxAgeForMessageTotalDeletion: 360,

	secret: "some string you should keep secret",
	
	// bot avatar
	botAvatar: {
		src:"url", key:"http://dystroy.org/miaou/static/M-150.png"
		
		// you may use another type of avatar. Examples :
		// "src":"facebook", "key":"123456789"
		// "src":"gravatar", "key":"some@email"
		// "src":"gravatar", "key":"0a74859ec2d68811668fc44bb32b53e5"
		// "src":"twitter", "key":"123456789"		
	},
	
	database: {
		url: "postgres://miaou:somepassword@localhost/miaou",
		native_pg: false
	},

	// list of the plugins you want to activate. You may add your ones
	plugins: [
		"./plugins/stackoverflow/plugin.js",
		"./plugins/wikipedia/plugin.js",
		"./plugins/github/plugin.js",
		"./plugins/video/plugin.js",
		"./plugins/whiteboard/plugin.js",
		"./plugins/youtube/plugin.js",
		"./plugins/survey/plugin.js",
		"./plugins/graph/plugin.js",
		"./plugins/hashcolor/plugin.js",
	],

	// available themes. The first one is both the default theme and the one
	//  used on smartphones
	themes: [
		"stingy-ray",
		"boring-goose",
		"perverse-otter",
		"sadistic-otter",
		"slippery-seal",
		"stoned-bear",
	],
	
	// OAuth providers. Remove the ones you don't want to use
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
	"imgur": {
		"clientID": "your client ID"
	},
	
	// Possible room languages (ISO lang codes)
	"langs": ["en", "fr", "it"],
	
	// regular expressions of the names you want to forbid
	// Note that it's only verified at creation, it won't apply
	// to already created names
	"forbiddenUsernames": ["miaou", "^server", "bot$", "^chat", "^every", "^all", "admin"],
	
	// identifiants of the rooms that are proposed as entry point to new users
	// (regular users of the server should be invited to watch those rooms)
	// Don't fill this array until you created the rooms
	"welcomeRooms": [688, 689]
}
