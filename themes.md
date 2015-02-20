
# Theming in Miaou

For now, themes only apply to the chat rooms and only the desktop version. The reason is nobody probably wants to do all the tests you need to do in order to buid a global theme applying to all parts.

## How to create a theme

1. You can't test anything without having installed the Miaou server. Fortunately it's easy enough (see main readme) 
1. Create a directory in `/themes/`. The name of the directory will be the public name of the theme
1. That directory should contain a file named `variables.scss` in which you'll override the necessary variables (variables are defined in `/src/main-scss/variables-default.scss`)
1. Compile Miaou using `/make`
1. Register your theme in `/config.json`
1. Restart the server using `/restart.sh`

## Scss Variables

A theme may only set SCSS variables. No direct CSS rule is allowed.

Of course `!important` is totally forbidden too. Always.

When something doesn't seem possible or convenient enough because there's no suitable variable, the common style and variables list may be changed by the core developpers.

These limitations will make it possible to have Miaou still evolving and being maintained.

