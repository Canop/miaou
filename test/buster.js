// buster tests can be executed with
//   $ buster-test
// when you're at the root of the project.
// Note that it seems that buster must be
// installed globally and as root to work.

var config = module.exports;

config["core"] = {
    rootPath: "../",
    environment: "node",
    tests: [
        "test/*-test.js"
    ]
}
