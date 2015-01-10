CREATE TABLE survey_vote (
	message bigint references message(id),
	player integer references player(id),
	item int2 NOT NULL,
	PRIMARY KEY(message, player)
);
create index survey_vote_idx on survey_vote (message,item);
