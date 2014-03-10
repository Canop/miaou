
alter table access_request
	add column request_message varchar(200),
	add column deny_message varchar(200),
	add column denied integer;
