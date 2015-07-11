CREATE TABLE github_hook (
	repo text not null PRIMARY KEY,
	nb_calls integer
);
CREATE TABLE github_hook_room (
	repo text not null,
	room integer references room(id),
	PRIMARY KEY(repo, room)
);
