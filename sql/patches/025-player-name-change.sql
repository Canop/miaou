CREATE TABLE player_name_change (
	player bigserial references player(id),
	new_name varchar(20),
	changed integer NOT NULL
);
create index player_name_change_player on player_name_change(player);

# sets the first name change to the date of the first message
# with default being approximatively now (not bothering about TZ)
insert into player_name_change (player, new_name, changed)
	select
		id, name,
		coalesce( (select min(created) from message m where m.author=p.id), floor(extract(epoch from timestamp 'now'))  )
	from player p limit 20;
