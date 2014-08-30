CREATE TABLE ban (
	id bigserial primary key,
	room integer references room(id) NULL,
	banned integer references player(id),
	banner integer references player(id),
	bandate integer NOT NULL,
	expires integer NOT NULL,
	reason varchar(255)
);
create index ban_idx on ban(room, banned, expires);
