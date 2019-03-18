
create table hosted_file (
	id bigint primary key,
	uploader integer references player(id),
	size integer,
	ext varchar(24) not null,
	hash bytea not null
);
