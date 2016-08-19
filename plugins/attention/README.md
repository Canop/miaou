
The "attention" plugin makes it possible for admins of a room to get the attention of everybody to a pinned message.

## Usage

The right area displaying starred and pinned messages normally looks like this:

![initial state](doc/attention-nothing.png)

When a room admin hovers the message, an exclamation icon shows the feature is available. It's grey here because no attention has been brought to that message.

![hovering](doc/attention-nothing-hovering.png)

Moving the mouse to the exclamation icon reveals a menu:

![menu](doc/attention-nothing-menu.png)

Raising the alert makes the icon red and visible for all other users:

![alert raised](doc/attention-bang.png)

The menu for those users make it possible to acknowledge the alert. In this specific case the user's also an admin and can thus remove the alert for everybody:

![hovering](doc/attention-bang-menu.png)

Once acknowledged, the icon turns green and is only visible when hovering the message:

![hovering](doc/attention-bang-hovering.png)

## Limits

Alerts can't currently be raised or displayed on the mobile version of the Miaou GUI.


