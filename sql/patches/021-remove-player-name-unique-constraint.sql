
# this uniquer constraint is useless
# as there is also a lower(name) unique constraint
alter table player drop constraint player_name_key;
