
create type badge_level as enum ('bronze', 'silver', 'gold');

create table badge (
	id serial primary key,
	tag varchar(50) not null references tag(name),
	name varchar(50) not null,
	level badge_level not null,
	manual boolean not null default false,
	condition text not null
);

create unique index badge_tag_name on badge(tag, name);

create table player_badge (
	badge integer references badge(id),
	player integer references player(id),
	message integer references message(id),
	primary key(badge, player)
);

