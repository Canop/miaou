CREATE TABLE db_version (
	component varchar(30) primary key,
	version integer NOT NULL
);
insert into db_version (component, version) values('core', 24);

CREATE TABLE room (
	id serial primary key,
	name varchar(50) NOT NULL,
	private boolean NOT NULL default false,
	listed boolean NOT NULL default true,
	dialog boolean NOT NULL default false,
	lang varchar(2) NOT NULL default 'en',
	img varchar(255),
	description text NOT NULL
);

CREATE TABLE player (
	id serial primary key,
	name varchar(20),
	email varchar(254),
	oauthprovider varchar(50),
	oauthid varchar(150),
	oauthdisplayname varchar(255),
	bot boolean NOT NULL default false,
	description varchar(255),
	location varchar(255),
	url varchar(255),
	lang varchar(2) NOT NULL default 'en',
	avatarsrc varchar(20),
	avatarkey varchar(255),
	tzoffset smallint
);
CREATE UNIQUE INDEX player_lower_name_index on player (lower(name));

CREATE TABLE message (
	id bigserial primary key,
	room integer references room(id),
	author integer references player(id),
	content text NOT NULL,
	created integer NOT NULL,
	changed integer NOT NULL default 0,
	pin integer NOT NULL default 0,
	star integer NOT NULL default 0,
	up integer NOT NULL default 0,
	down integer NOT NULL default 0,
	score integer NOT NULL default 0
);
create index message_room_created on message (room, created);
create index message_author_created_room on message (author, created, room);
create index message_room_author_created on message (room,author,created);
create index message_fts on message using GIN(to_tsvector('english', content));
create index message_score on message (score);
create index message_room_id on message (room, id);

CREATE OR REPLACE FUNCTION message_score() RETURNS trigger AS '
	BEGIN
		NEW.score := 25*NEW.pin + 5*NEW.star + NEW.up - NEW.down;
		RETURN NEW;
	END;
' LANGUAGE plpgsql;
CREATE TRIGGER message_score BEFORE INSERT OR UPDATE ON message FOR EACH ROW EXECUTE PROCEDURE message_score();

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
	requested integer NOT NULL,
	request_message varchar(200),
	deny_message varchar(200),
	denied integer
);
create index access_request_idx on access_request (room, requested);

CREATE TABLE ping (
	player integer references player(id),
	room integer references room(id),
	message bigint references message(id)
);
create index ping_idx on ping (player, room);

CREATE TYPE vote_level AS ENUM ('down', 'up', 'star', 'pin');

CREATE TABLE message_vote (
	message bigint references message(id),
	player integer references player(id),
	vote vote_level NOT NULL,
	PRIMARY KEY(message, player)
);
create index vote_idx on message_vote (vote);

CREATE TABLE plugin_player_info (
	plugin varchar(20),
	player integer references player(id),
	info json NOT NULL,
	PRIMARY KEY(plugin, player)
);

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

CREATE TABLE pref (
	player integer references player(id),
	name varchar(6) not null,
	value varchar(20) not null,
	primary key(player,name)
);

create table watch (
	player integer references player(id),
	room integer references room(id),
	last_seen bigint,
	primary key(player, room)
);

CREATE TABLE tag (
	name varchar(50) NOT NULL PRIMARY KEY,
	description text NOT NULL
);
CREATE UNIQUE INDEX tag_lower_name_index on  tag(lower(name));

CREATE TABLE room_tag (
	room integer references room(id),
	tag varchar(50) references tag(name),
	primary key(room, tag)
);

ALTER TABLE message SET (autovacuum_vacuum_scale_factor = 0.0);  
ALTER TABLE message SET (autovacuum_vacuum_threshold = 5000);  
ALTER TABLE message SET (autovacuum_analyze_scale_factor = 0.0);  
ALTER TABLE message SET (autovacuum_analyze_threshold = 5000);

ALTER TABLE room SET (autovacuum_vacuum_scale_factor = 0.0);  
ALTER TABLE room SET (autovacuum_vacuum_threshold = 50);  
ALTER TABLE room SET (autovacuum_analyze_scale_factor = 0.0);  
ALTER TABLE room SET (autovacuum_analyze_threshold = 50);

ALTER TABLE player SET (autovacuum_vacuum_scale_factor = 0.0);  
ALTER TABLE player SET (autovacuum_vacuum_threshold = 100);  
ALTER TABLE player SET (autovacuum_analyze_scale_factor = 0.0);  
ALTER TABLE player SET (autovacuum_analyze_threshold = 100);

ALTER TABLE room_auth SET (autovacuum_vacuum_scale_factor = 0.0);  
ALTER TABLE room_auth SET (autovacuum_vacuum_threshold = 500);  
ALTER TABLE room_auth SET (autovacuum_analyze_scale_factor = 0.0);  
ALTER TABLE room_auth SET (autovacuum_analyze_threshold = 500);

ALTER TABLE ping SET (autovacuum_vacuum_scale_factor = 0.0);  
ALTER TABLE ping SET (autovacuum_vacuum_threshold = 100);  
ALTER TABLE ping SET (autovacuum_analyze_scale_factor = 0.0);  
ALTER TABLE ping SET (autovacuum_analyze_threshold = 100);

ALTER TABLE message_vote SET (autovacuum_vacuum_scale_factor = 0.0);  
ALTER TABLE message_vote SET (autovacuum_vacuum_threshold = 100);  
ALTER TABLE message_vote SET (autovacuum_analyze_scale_factor = 0.0);  
ALTER TABLE message_vote SET (autovacuum_analyze_threshold = 100);

