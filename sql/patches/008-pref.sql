CREATE TABLE pref (
	player integer references player(id),
	name varchar(6) not null,
	value varchar(20) not null,
	primary key(player,name)
);
