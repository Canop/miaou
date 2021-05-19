# add a column to store the clause used in repeatable pingme alarms

alter table pingme_alarm 
	add column repeat TEXT NULL;
