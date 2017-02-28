
alter table room add column img varchar(255);

# extract the image link from the description and put it in the new img column
update room r set img=matches[1], description=matches[2] from (
        select id, regexp_matches(description, '(?i)^(https?://\S{4,220}\.(?:jpe?g|png))\s(.*)$') matches from room
) s where matches is not null and r.id=s.id;
