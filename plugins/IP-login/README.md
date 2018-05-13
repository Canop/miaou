This plugin enables a simple and very low security IP based login.

Its purpose is to ease development while out of network or when configuring OAuth providers doesn't seem necessary.

To enable IP based login, declare the plugin and the relevant configuration in the config.js file :

	module.exports = {
		"server": "http://127.0.0.1:8204",
		...
		"plugins": [
			"plugins/IP-login/plugin.js",
		],
		"pluginConfig":{
			"IP-login":{
				"logins":{
					"127.0.0.1":"dystroy",
					"::ffff:127.0.0.1":"dystroy",
					":1":"dystroy",
				}
			}
		},
		...
	}

To log in, simply go to the "ip-login" page. For example

	http://localhost:8024/ip-login
