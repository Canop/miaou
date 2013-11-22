CREATE TABLE room (
    id serial primary key,
    name varchar(50) UNIQUE NOT NULL,
    description text NOT NULL
);
CREATE TABLE player (
    id serial primary key,
    name varchar(30) UNIQUE,
	email varchar(150) UNIQUE NOT NULL,
	oauthprovider varchar(50),
	oauthid varchar(150),
	oauthdisplayname varchar(255)
);
CREATE TABLE message (
	id bigserial primary key,
	room integer references room(id),
	author integer references player(id),
	content text NOT NULL,
	created integer NOT NULL,
	changed integer
);
create index message_room_created on message (room, created);

