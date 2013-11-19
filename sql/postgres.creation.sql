CREATE TABLE room (
    id serial primary key,
    name varchar(50) UNIQUE NOT NULL,
    description text NOT NULL
);
CREATE TABLE player (
    id serial primary key,
    name varchar(30) UNIQUE NOT NULL
);
CREATE TABLE message (
	id bigserial primary key,
	room integer references room(id),
	author integer references player(id),
	content text NOT NULL,
	created bigint NOT NULL,
	changed bigint
);
create index message_room_created on message (room, created);
