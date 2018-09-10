
create table web_push_subscription (
	player integer references player(id) primary key,
	subscription text not null,
	pings boolean not null default false,
	created integer not null
);
