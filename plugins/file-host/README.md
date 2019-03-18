
When activated, this plugin is available for core miaou and other plugins which needs to store uploaded files, for example images.

When somebody uploads a file, it's stored on disk with a path built from a hash of the content. Additionnaly a record is written in database, recording who uploaded it and when.

If a file, as defined by its content, is uploaded twice, two records are written in database but there's only one file on disk.

The hash currently used is SHA-1 truncated to the first 12 bytes. The name of the file is this hash, in hexa, a dot, and the extension which could be guessed from the content.

This plugin needs a configuration, which must be added into the `"pluginConfig"` part of the *config.js* file.

	"file-host": {
		"base-directory": "/home/dys/prod/miaou/file-host/files",
		"max-size": 800*1024, // max size of one file, in bytes
		"rate-limit": { // limits per user
			"period": 24*60*60*1000, // a day
			"number": 1000,
			"sum-size": 2*1024*1024,
		}
	}

