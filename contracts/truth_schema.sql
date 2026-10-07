-- truth.db (eval only). v1 section 14 then v2 section 5.
CREATE TABLE truth_payments (payment_id TEXT PRIMARY KEY, incident_id TEXT, mismatch_type TEXT, should_fix INTEGER, exclusion_reason TEXT);
CREATE TABLE truth_complaints (complaint_id TEXT PRIMARY KEY, payment_ids TEXT, mismatch_type TEXT, topic TEXT, is_injection INTEGER, language TEXT, amount_paise INTEGER, rrn TEXT);
CREATE TABLE truth_incidents (incident_id TEXT PRIMARY KEY, cause_code TEXT, owner TEXT, onset_at TEXT, resolved_at TEXT, linked_event_id TEXT);

CREATE TABLE truth_threads (thread_id TEXT PRIMARY KEY, script_id TEXT, expected_payment_id TEXT, expected_zone TEXT, expected_outcome TEXT, persona TEXT);
CREATE TABLE truth_zone1 (incident_id TEXT PRIMARY KEY, onset_at TEXT, resolved_at TEXT, cause_code TEXT, expected_lost_orders INTEGER, kind TEXT);   -- kind: positive | negative
CREATE TABLE truth_recovery (order_id TEXT PRIMARY KEY, would_pay INTEGER);
CREATE TABLE truth_zone1_members (incident_id TEXT, customer_id TEXT, role TEXT, PRIMARY KEY (incident_id, customer_id));   -- role: affected | affected_paid_since
