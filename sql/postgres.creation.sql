CREATE TABLE room (
    id serial primary key,
    name varchar(50) UNIQUE NOT NULL,
    private boolean NOT NULL default false,
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
CREATE TYPE auth_level AS ENUM ('read', 'write', 'admin', 'own');
CREATE TABLE room_auth (
	room integer references room(id),
	player integer references player(id),
	auth auth_level NOT NULL,
	granter integer references player(id),
	granted integer,
	PRIMARY KEY(room, player)
);
CREATE TABLE access_request (
	room integer references room(id),
	player integer references player(id),
	requested integer NOT NULL
);
create index access_request_idx on access_request (room, requested);
CREATE TABLE ping (
	player integer references player(id),
	room integer references room(id),
	message bigint references message(id),
	created integer NOT NULL
);
create index ping_idx on ping (player, room);
