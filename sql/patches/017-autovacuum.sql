ALTER TABLE message SET (autovacuum_vacuum_scale_factor = 0.0);  
ALTER TABLE message SET (autovacuum_vacuum_threshold = 5000);  
ALTER TABLE message SET (autovacuum_analyze_scale_factor = 0.0);  
ALTER TABLE message SET (autovacuum_analyze_threshold = 5000);

ALTER TABLE room SET (autovacuum_vacuum_scale_factor = 0.0);  
ALTER TABLE room SET (autovacuum_vacuum_threshold = 50);  
ALTER TABLE room SET (autovacuum_analyze_scale_factor = 0.0);  
ALTER TABLE room SET (autovacuum_analyze_threshold = 50);

ALTER TABLE player SET (autovacuum_vacuum_scale_factor = 0.0);  
ALTER TABLE player SET (autovacuum_vacuum_threshold = 100);  
ALTER TABLE player SET (autovacuum_analyze_scale_factor = 0.0);  
ALTER TABLE player SET (autovacuum_analyze_threshold = 100);

ALTER TABLE room_auth SET (autovacuum_vacuum_scale_factor = 0.0);  
ALTER TABLE room_auth SET (autovacuum_vacuum_threshold = 500);  
ALTER TABLE room_auth SET (autovacuum_analyze_scale_factor = 0.0);  
ALTER TABLE room_auth SET (autovacuum_analyze_threshold = 500);

ALTER TABLE ping SET (autovacuum_vacuum_scale_factor = 0.0);  
ALTER TABLE ping SET (autovacuum_vacuum_threshold = 100);  
ALTER TABLE ping SET (autovacuum_analyze_scale_factor = 0.0);  
ALTER TABLE ping SET (autovacuum_analyze_threshold = 100);

ALTER TABLE message_vote SET (autovacuum_vacuum_scale_factor = 0.0);  
ALTER TABLE message_vote SET (autovacuum_vacuum_threshold = 100);  
ALTER TABLE message_vote SET (autovacuum_analyze_scale_factor = 0.0);  
ALTER TABLE message_vote SET (autovacuum_analyze_threshold = 100);
