drop index message_room_author;
create index message_room_author_created on message (room,author,created);
