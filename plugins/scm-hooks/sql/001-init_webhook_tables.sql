CREATE TABLE scm_hook (
	provider text not null,
	repo text not null,
	nb_calls integer,
	PRIMARY KEY(provider, repo)
);
CREATE TABLE scm_hook_room (
	provider text not null,
	repo text not null,
	room integer references room(id),
	PRIMARY KEY(provider, repo, room)
);
