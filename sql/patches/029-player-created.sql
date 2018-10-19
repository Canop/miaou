
alter table player
	add column created integer not null default 0;

with mcm as (select author, min(created) m from message group by author)
update player set created=m from mcm where mcm.author=player.id and m>0;

with mnc as (select player, min(changed) m from player_name_change group by player)
update player set created=m from mnc where mnc.player=player.id and m>0 and player.created>m;

