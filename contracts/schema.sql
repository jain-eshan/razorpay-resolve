-- Blindspot contract schema v0.1. world.db. v1 section 14 followed by v2 section 5 (ALTERs then new tables).
CREATE TABLE merchants (
  id TEXT PRIMARY KEY,                 -- 'acc_KAKSHA001'
  name TEXT NOT NULL,                  -- 'Kaksha (fictional)'
  segment TEXT NOT NULL,               -- 'digital_access_subscription'
  mid TEXT NOT NULL,
  tech_contact TEXT, owner_contact TEXT,
  grace_hours_after_failed_renewal INTEGER DEFAULT 48
);

CREATE TABLE customers (
  id TEXT PRIMARY KEY,                 -- 'cust_...'
  merchant_id TEXT REFERENCES merchants(id),
  name TEXT, email TEXT, phone TEXT, vpa TEXT,
  language_pref TEXT,                  -- 'en' | 'hi_latn'
  created_at TEXT
);

CREATE TABLE plans (
  id TEXT PRIMARY KEY, merchant_id TEXT, name TEXT,
  amount_paise INTEGER, interval TEXT  -- 'one_time' | 'monthly' | 'annual'
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,                 -- 'order_...'
  merchant_id TEXT, customer_id TEXT, plan_id TEXT,
  receipt TEXT,                        -- merchant receipt 'KK-2026-000123'
  amount_paise INTEGER, status TEXT,   -- 'created'|'attempted'|'paid'
  client_app_version TEXT,             -- e.g. 'android-3.4.1', 'web-2.8.0'
  created_at TEXT
);

CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,                 -- 'sub_...'
  merchant_id TEXT, customer_id TEXT, plan_id TEXT,
  method TEXT,                         -- 'upi_autopay' | 'card_mandate'
  status TEXT,                         -- 'active'|'halted'|'cancelled'|'completed'
  current_start TEXT, current_end TEXT, created_at TEXT
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,                 -- 'pay_' + 14 chars
  merchant_id TEXT, order_id TEXT, subscription_id TEXT, customer_id TEXT,
  amount_paise INTEGER, currency TEXT DEFAULT 'INR',
  method TEXT,                         -- 'upi'|'card'|'netbanking'|'wallet'
  issuer TEXT,                         -- normalised bank name (fictional allowed)
  app TEXT,                            -- UPI app (fictional names in screenshots)
  card_network TEXT, card_last4 TEXT, vpa TEXT,
  status TEXT,                         -- 'created'|'authorized'|'captured'|'failed'|'refunded'
  error_code TEXT, error_description TEXT, error_source TEXT, error_step TEXT, error_reason TEXT,
  rrn TEXT, upi_txn_id TEXT, auth_code TEXT,
  is_renewal INTEGER DEFAULT 0,
  created_at TEXT, authorized_at TEXT, captured_at TEXT,
  email TEXT, contact TEXT             -- as captured by checkout
);

CREATE TABLE refunds (
  id TEXT PRIMARY KEY,                 -- 'rfnd_...'
  payment_id TEXT, amount_paise INTEGER,
  status TEXT,                         -- 'pending'|'processed'|'failed'
  arn TEXT, rrn TEXT,                  -- ARN 23 digits (card), RRN 12 digits (UPI)
  speed TEXT, created_at TEXT, processed_at TEXT,
  source TEXT                          -- 'world' | 'make_good'
);

CREATE TABLE webhook_endpoints (
  id TEXT PRIMARY KEY, merchant_id TEXT, url TEXT,
  status TEXT,                         -- 'active'|'disabled'
  disabled_at TEXT, disable_email_sent_at TEXT
);

CREATE TABLE webhook_events (           -- one per business event
  id TEXT PRIMARY KEY,                 -- 'evt_...'
  merchant_id TEXT, endpoint_id TEXT,
  event_type TEXT,                     -- 'payment.captured'|'subscription.charged'|'refund.processed'|...
  payment_id TEXT, subscription_id TEXT,
  created_at TEXT,
  final_delivery_class TEXT            -- '2xx'|'4xx'|'5xx'|'timeout'|'not_attempted_disabled'
);

CREATE TABLE webhook_deliveries (       -- [assumption] per-attempt log; mocked
  id TEXT PRIMARY KEY, event_id TEXT, attempt_no INTEGER,
  attempted_at TEXT, http_status INTEGER, latency_ms INTEGER,
  error_class TEXT,                    -- null|'timeout'|'tls'|'dns'
  response_body_excerpt TEXT           -- first 1 KB
);

CREATE TABLE entitlements (             -- merchant-supplied (CSV or endpoint snapshot)
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT, subscription_id TEXT,  -- join keys (one of them is set)
  razorpay_payment_id TEXT,             -- blank when the merchant never learned of the payment
  customer_id TEXT,
  entitlement_state TEXT,              -- 'none'|'unpaid'|'active'|'expired'|'cancelled'
  access_until TEXT,                   -- for subscriptions
  updated_at TEXT, source TEXT,        -- 'csv'|'endpoint'|'manual'|'make_good_grant'
  UNIQUE (order_id), UNIQUE (subscription_id)
);

CREATE TABLE merchant_events (          -- deploys, config changes, app releases
  id TEXT PRIMARY KEY, merchant_id TEXT,
  kind TEXT,                           -- 'deploy'|'config_change'|'app_release'
  label TEXT,                          -- 'web v2.8.0: auth middleware on /api/*'
  at TEXT
);

CREATE TABLE downtime_events (
  id TEXT PRIMARY KEY, method TEXT, issuer TEXT,
  started_at TEXT, ended_at TEXT, severity TEXT
);

-- Pipeline tables
CREATE TABLE complaints (
  id TEXT PRIMARY KEY,                 -- 'cmp_...'
  merchant_id TEXT, channel TEXT,      -- 'ray_whatsapp'|'paste'|'email_csv'
  received_at TEXT, from_handle TEXT,
  raw_text TEXT, raw_hash TEXT, redacted_text TEXT,
  attachment_path TEXT,
  data_role TEXT                       -- 'merchant_data_processor'|'razorpay_fiduciary'
);

CREATE TABLE token_vault (token TEXT PRIMARY KEY, complaint_id TEXT, kind TEXT, value TEXT);

CREATE TABLE extractions (
  complaint_id TEXT PRIMARY KEY, model_id TEXT, prompt_version TEXT,
  json TEXT, rejected_fields TEXT, injection_suspected INTEGER,
  status TEXT,                         -- 'ok'|'retry_ok'|'failed'
  created_at TEXT
);

CREATE TABLE match_candidates (
  complaint_id TEXT, payment_id TEXT, method TEXT,  -- 'exact_payment_id'|'exact_rrn'|...|'fuzzy'
  raw_score REAL, calibrated_score REAL, features TEXT, rank INTEGER,
  PRIMARY KEY (complaint_id, payment_id)
);

CREATE TABLE cases (
  id TEXT PRIMARY KEY, complaint_id TEXT,
  match_status TEXT,                   -- 'matched'|'needs_detail'|'no_payment_found'|'not_payment'
  matched_payment_ids TEXT,            -- JSON array
  mismatch_type TEXT, owner TEXT, incident_id TEXT, created_at TEXT
);

CREATE TABLE signals (
  id TEXT PRIMARY KEY, monitor TEXT, metric TEXT,
  detected_at TEXT, onset_at TEXT, before_level REAL, after_level REAL,
  details TEXT
);

CREATE TABLE incidents (
  id TEXT PRIMARY KEY,                 -- 'INC-1' style display id plus uuid
  merchant_id TEXT, mismatch_type TEXT, status TEXT,  -- 'open'|'fixing'|'verifying'|'closed'
  signature TEXT, onset_at TEXT, resolved_at TEXT,
  owner TEXT, owner_rule_id INTEGER, cause_code TEXT,
  verdict_json TEXT, agent_trace_id TEXT,
  opened_by TEXT,                      -- 'signal'|'complaint'|'backfill'
  created_at TEXT, closed_at TEXT
);

CREATE TABLE incident_members (
  incident_id TEXT, payment_id TEXT,
  tier TEXT,                           -- 'exact'|'likely'|'check'|'excluded'
  exclusion_reason TEXT, complained INTEGER, case_id TEXT,
  amount_paise INTEGER,
  PRIMARY KEY (incident_id, payment_id)
);

CREATE TABLE agent_traces (id TEXT PRIMARY KEY, incident_id TEXT, steps_json TEXT, model_id TEXT, tokens_in INTEGER, tokens_out INTEGER, created_at TEXT);

CREATE TABLE actions (
  id TEXT PRIMARY KEY, incident_id TEXT,
  action_type TEXT,                    -- 'grant'|'resend_events'|'refund'|'message'|'recovery_link'|'evidence_pack'|'escalation_pack'|'alert_rule'
  status TEXT,                         -- 'drafted'|'approved'|'executing'|'done'|'failed'|'reverted'
  stage TEXT,                          -- 'dry_run'|'first_5'|'rest'
  params_json TEXT, approved_by TEXT, approved_at TEXT, created_at TEXT
);

CREATE TABLE action_items (
  id TEXT PRIMARY KEY, action_id TEXT, payment_id TEXT,
  idempotency_key TEXT UNIQUE,
  status TEXT,                         -- 'pending'|'done'|'failed'|'verified'|'verify_failed'|'reverted'
  prior_state_json TEXT, result_json TEXT, executed_at TEXT, verified_at TEXT
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY, action_id TEXT, payment_id TEXT, customer_id TEXT,
  template_id TEXT, language TEXT, category TEXT,   -- 'utility'|'service'|'service_promotional'
  sender TEXT, body TEXT, holdout INTEGER DEFAULT 0, status TEXT, created_at TEXT
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT, actor TEXT,  -- 'system'|'llm'|'merchant:<name>'
  kind TEXT,                           -- 'llm_call'|'tool_call'|'approval'|'action'|'verify'
  ref_id TEXT, input_hash TEXT, payload_json TEXT, model_id TEXT,
  latency_ms INTEGER, cost_usd REAL
);

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);

-- v2 changes
-- Orders now carry attempt counts (documented signal: dashboard Orders shows Attempts)
ALTER TABLE orders ADD COLUMN attempts INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN first_attempt_at TEXT;
ALTER TABLE orders ADD COLUMN last_attempt_at TEXT;

-- Replay eligibility per affected event (rules in section 8)
ALTER TABLE webhook_events ADD COLUMN replay_eligibility TEXT;
  -- 'replayable_by_support' | 'not_replayable_disabled_window' | 'too_old' | 'n/a'

ALTER TABLE incidents ADD COLUMN zone TEXT;              -- 'before' | 'during' | 'after'
ALTER TABLE incidents ADD COLUMN inferred INTEGER DEFAULT 0;
ALTER TABLE incidents ADD COLUMN evidence_json TEXT;     -- list of evidence items with weights
ALTER TABLE complaints ADD COLUMN thread_id TEXT;
ALTER TABLE complaints ADD COLUMN customer_ref TEXT;     -- tokenised

CREATE TABLE channels (
  id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL,
  type TEXT NOT NULL,                  -- help_button|whatsapp_payments|email|ig_dm|fb_dm|public_mention|ray_forward|paste|csv
  status TEXT NOT NULL,                -- disconnected|connected|paused
  reply_identity TEXT,                 -- e.g. 'Kaksha payment help, powered by Razorpay'
  autonomy_level TEXT NOT NULL DEFAULT 'suggest',   -- suggest|assist|autopilot_reversible
  connected_at TEXT, disconnected_at TEXT
);

CREATE TABLE consents (
  id TEXT PRIMARY KEY, merchant_id TEXT, channel_id TEXT,
  scopes_json TEXT, granted_by TEXT, granted_at TEXT, revoked_at TEXT, retention_days INTEGER
);

CREATE TABLE suppressions (
  id TEXT PRIMARY KEY, merchant_id TEXT, customer_ref_hash TEXT, reason TEXT, created_at TEXT
);

CREATE TABLE threads (
  id TEXT PRIMARY KEY, merchant_id TEXT, channel_id TEXT,
  external_ref TEXT, customer_ref TEXT,         -- tokenised
  opened_at TEXT, last_inbound_at TEXT, window_expires_at TEXT,
  state TEXT,                                   -- see 4.1
  claim TEXT, zone TEXT, language TEXT,
  case_id TEXT, incident_id TEXT, handover_state TEXT,
  disclosed INTEGER DEFAULT 0, question_count INTEGER DEFAULT 0,
  is_public INTEGER DEFAULT 0, closed_at TEXT
);

CREATE TABLE thread_messages (
  id TEXT PRIMARY KEY, thread_id TEXT,
  direction TEXT,                               -- inbound|outbound
  sender_role TEXT,                             -- customer|agent|founder|system
  body_redacted TEXT, raw_hash TEXT, attachments_json TEXT,
  template_id TEXT, approved_by TEXT, policy_json TEXT,
  cost_inr_milli INTEGER DEFAULT 0, created_at TEXT
);

CREATE TABLE order_signals (                     -- aggregated per merchant per 30-minute bucket
  merchant_id TEXT, bucket_start TEXT,
  orders_created INTEGER, orders_with_zero_attempts INTEGER, orders_paid INTEGER,
  complaints_cannot_pay INTEGER, complaints_unmatched INTEGER,
  PRIMARY KEY (merchant_id, bucket_start)
);

CREATE TABLE baselines (
  merchant_id TEXT, metric TEXT, hour_of_week INTEGER,
  mean REAL, var REAL, n INTEGER, updated_at TEXT,
  PRIMARY KEY (merchant_id, metric, hour_of_week)
);

CREATE TABLE probes (
  id TEXT PRIMARY KEY, merchant_id TEXT, url TEXT, checked_at TEXT,
  http_status INTEGER, load_ms INTEGER, checkout_script_present INTEGER, note TEXT
);

CREATE TABLE handovers (
  id TEXT PRIMARY KEY, thread_id TEXT, from_app TEXT, to_app TEXT,
  reason TEXT, passed_at TEXT, released_at TEXT
);

CREATE TABLE escalations (
  id TEXT PRIMARY KEY, incident_id TEXT, thread_id TEXT,
  target TEXT,                                  -- founder|developer|razorpay
  pack_json TEXT, ref TEXT, status TEXT, created_at TEXT, updated_at TEXT
);

CREATE TABLE feedback_events (
  id TEXT PRIMARY KEY, merchant_id TEXT,
  subject_type TEXT, subject_id TEXT,
  kind TEXT,    -- verdict_wrong|false_alarm|missed_incident|reply_edited|reply_sent|customer_replied|customer_silent|link_paid|match_confirmed|match_rejected
  payload_json TEXT, at TEXT
);

CREATE TABLE learning_params (
  merchant_id TEXT, key TEXT, version INTEGER, value_json TEXT, reason TEXT, updated_at TEXT,
  PRIMARY KEY (merchant_id, key, version)
);

CREATE TABLE recovery_offers (
  id TEXT PRIMARY KEY, incident_id TEXT, thread_id TEXT, order_id TEXT,
  link_ref TEXT, amount_paise INTEGER, holdout INTEGER DEFAULT 0,
  sent_at TEXT, paid_at TEXT
);
