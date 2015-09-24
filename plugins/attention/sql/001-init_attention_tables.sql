create table attention_alert (
	message bigint references message(id) primary key,
	room bigint references room(id) not null,
	creator integer references player(id) not null
);
create index attention_alert_room on attention_alert(room);

create table attention_seen (
	message bigint references message(id),
	player integer references player(id),
	primary key (message, player)
);	
