
alter table watch add column last_seen bigint;

update watch set last_seen = (select max(id) from message where message.room=watch.room); 
