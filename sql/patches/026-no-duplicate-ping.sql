-- we drop the useless index
drop index ping_idx;

-- we remove the duplicates
with deleted as (delete from ping returning *)
insert into ping (player, room, message) select distinct player, room, message from deleted;

-- and we add the new primary key
alter table ping add primary key(player, room, message);
