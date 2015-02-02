create table watch (
	player integer references player(id),
	room integer references room(id),
	primary key(player, room)
);
