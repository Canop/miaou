
This plugin lets server admin send an instant, non persisted, message to all rooms.

The most obvious use case is to alert everybody about a server wide event.

## Usage

    !!broadcast Warning, I'll stop the server for a few minutes in order to restart it

## Settings

This command is only available to server admins. They're defined in the [config file](../config-default.js).

In the following example, two server admins are defined, one by name and one by id:

	"serverAdmins": ["dystroy", 3],



