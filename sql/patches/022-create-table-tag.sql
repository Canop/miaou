
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
