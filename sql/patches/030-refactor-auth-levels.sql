# This patch changes the auth_level enum
# from ('read', 'write', 'admin', 'own')
# to ('member', 'admin', 'owner')
# in order to merge the 'read' and 'write' values.
#
# 'read' is not used which means there is no actual value to change:
#
# This enum is only used in the room_auth table.
#
# postgresql does not seem to support dropping or renaming enum values
# so we have a few operations to do.

# first add the new names to the old enum
alter type auth_level add value 'member' before 'read';
alter type auth_level add value 'owner' after 'own';

# use the new value
update room_auth set auth='member' where auth='write';
update room_auth set auth='owner' where auth='own';

# rename the old enum
alter type auth_level rename to auth_level_old;

# create the new enum
create type auth_level as enum ('member', 'admin', 'owner');

# change the room_auth table to use the new enum
# mapping using the text of the value
alter table room_auth alter column auth type auth_level using auth::text::auth_level;

# drop the old enum
drop type auth_level_old;
