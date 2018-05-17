
Files in the `libs` directory are the core parts of the Miaou back-end.

They're normally not obtained through `require("pathToLib.js")` but using `miaou.lib("libname")` which ensures
that any necessary synchroneous initialization is done.

This initialization is defined in a synchronous function as this:

	exports.configure = function(miaou){
		...
	}

The main entry-point is the `start` function in `libs/server.js`.
