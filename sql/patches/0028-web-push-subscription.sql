
create table web_push_subscription (
	player integer references player(id) primary key,
	subscription text not null,
	created integer not null
);
