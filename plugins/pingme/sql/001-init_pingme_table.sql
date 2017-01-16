
create table pingme_alarm (
	message bigint primary key,
	ping_date integer not null,
	creator integer references player(id) not null,
	alarm_text text NOT NULL
);
create index pingme_ping_date on pingme_alarm(ping_date);
create index pingme_creator on pingme_alarm(creator);
