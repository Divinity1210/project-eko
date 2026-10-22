-- =========================================================
-- PROJECT EKO — CANONICAL DATABASE SCHEMA (POSTGRESQL)
-- Core Ledger, Identity/Sessions, Vehicle Ownership, Businesses,
-- Property, Missions, Co-op Settlements, Audit Logs & Payout State Machine
-- =========================================================

CREATE TABLE IF NOT EXISTS accounts (
    account_id VARCHAR(64) PRIMARY KEY,
    handle VARCHAR(40) UNIQUE NOT NULL,
    email VARCHAR(160) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt VARCHAR(128) NOT NULL,
    age_band VARCHAR(16) NOT NULL DEFAULT 'ADULT',
    role VARCHAR(32) NOT NULL DEFAULT 'PLAYER',
    game_naira_balance BIGINT NOT NULL DEFAULT 15000,
    consent_accepted BOOLEAN NOT NULL DEFAULT TRUE,
    consent_withdrawn_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_valid_age_band CHECK (age_band IN ('TEEN_13_17', 'ADULT')),
    CONSTRAINT check_non_negative_wallet CHECK (game_naira_balance >= 0)
);

CREATE TABLE IF NOT EXISTS sessions (
    session_token VARCHAR(128) PRIMARY KEY,
    account_id VARCHAR(64) NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    user_agent TEXT,
    ip_address VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS idempotency_keys (
    idempotency_key VARCHAR(160) PRIMARY KEY,
    account_id VARCHAR(64) NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    endpoint VARCHAR(128) NOT NULL,
    request_hash VARCHAR(128) NOT NULL,
    response_status INT NOT NULL,
    response_payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_idempotency_account ON idempotency_keys(account_id);

CREATE TABLE IF NOT EXISTS players (
    player_id VARCHAR(64) PRIMARY KEY,
    account_id VARCHAR(64) UNIQUE REFERENCES accounts(account_id) ON DELETE CASCADE,
    username VARCHAR(40) UNIQUE NOT NULL,
    age_band VARCHAR(16) NOT NULL DEFAULT 'ADULT',
    reputation_score INT NOT NULL DEFAULT 100,
    driver_rating DECIMAL(3, 2) NOT NULL DEFAULT 5.00,
    current_zone_id VARCHAR(64) NOT NULL DEFAULT 'zone_marina_cms',
    active_vehicle_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicles (
    vehicle_id VARCHAR(64) PRIMARY KEY,
    owner_id VARCHAR(64) REFERENCES players(player_id),
    vehicle_class VARCHAR(32) NOT NULL,
    plate_number VARCHAR(16) UNIQUE NOT NULL,
    fuel_liters DECIMAL(5, 2) NOT NULL DEFAULT 45.00,
    body_condition INT NOT NULL DEFAULT 100,
    engine_condition INT NOT NULL DEFAULT 100,
    tyre_tread_percent INT NOT NULL DEFAULT 100,
    oil_quality_percent INT NOT NULL DEFAULT 100,
    is_immobilized BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS owned_vehicles (
    ownership_id VARCHAR(64) PRIMARY KEY,
    account_id VARCHAR(64) NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    vehicle_class VARCHAR(64) NOT NULL,
    plate_number VARCHAR(24) UNIQUE NOT NULL,
    purchase_price_gn BIGINT NOT NULL,
    fuel_liters DECIMAL(6, 2) NOT NULL DEFAULT 45.00,
    condition_percent INT NOT NULL DEFAULT 100,
    customization_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (account_id, vehicle_class)
);

CREATE TABLE IF NOT EXISTS businesses (
    business_instance_id VARCHAR(64) PRIMARY KEY,
    account_id VARCHAR(64) NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    business_template_id VARCHAR(64) NOT NULL,
    zone_id VARCHAR(64) NOT NULL,
    level INT NOT NULL DEFAULT 1,
    staff_count INT NOT NULL DEFAULT 1,
    inventory_units INT NOT NULL DEFAULT 0,
    hourly_earnings_gn BIGINT NOT NULL DEFAULT 0,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (account_id, business_template_id)
);

CREATE TABLE IF NOT EXISTS supply_chain_batches (
    batch_id VARCHAR(64) PRIMARY KEY,
    account_id VARCHAR(64) NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    commodity_id VARCHAR(64) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    stage VARCHAR(32) NOT NULL, -- 'RAW_HARVESTED', 'PROCESSED', 'WHOLESALE_DELIVERED', 'RETAIL_SOLD'
    unit_cost_gn BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS property_parcels (
    ownership_id VARCHAR(64) PRIMARY KEY,
    account_id VARCHAR(64) NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    parcel_id VARCHAR(64) NOT NULL,
    ownership_mode VARCHAR(16) NOT NULL CHECK (ownership_mode IN ('RENTED', 'OWNED')),
    contract_price_gn BIGINT NOT NULL,
    comfort_score INT NOT NULL DEFAULT 50,
    security_score INT NOT NULL DEFAULT 50,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (account_id, parcel_id)
);

CREATE TABLE IF NOT EXISTS household_items (
    item_ownership_id VARCHAR(64) PRIMARY KEY,
    account_id VARCHAR(64) NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    parcel_id VARCHAR(64) NOT NULL,
    item_id VARCHAR(64) NOT NULL,
    purchase_price_gn BIGINT NOT NULL,
    installed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (account_id, parcel_id, item_id)
);

CREATE TABLE IF NOT EXISTS career_job_runs (
    run_id VARCHAR(64) PRIMARY KEY,
    account_id VARCHAR(64) NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    job_id VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(160) UNIQUE NOT NULL,
    payout_gn BIGINT NOT NULL,
    xp_awarded INT NOT NULL DEFAULT 0,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS danfo_hustle_runs (
    run_id VARCHAR(64) PRIMARY KEY,
    account_id VARCHAR(64) NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    route_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'IN_PROGRESS',
    stops_completed INT NOT NULL DEFAULT 0,
    passengers_ferried INT NOT NULL DEFAULT 0,
    gross_fare_gn BIGINT NOT NULL DEFAULT 0,
    net_earnings_gn BIGINT NOT NULL DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    settled_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS coop_settlements (
    settlement_id VARCHAR(64) PRIMARY KEY,
    coop_session_id VARCHAR(64) UNIQUE NOT NULL,
    driver_account_id VARCHAR(64) NOT NULL REFERENCES accounts(account_id),
    conductor_account_id VARCHAR(64) NOT NULL REFERENCES accounts(account_id),
    gross_fare_gn BIGINT NOT NULL,
    driver_share_gn BIGINT NOT NULL,
    conductor_share_gn BIGINT NOT NULL,
    checkpoint_token_hash VARCHAR(128) NOT NULL,
    settled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_audit_logs (
    audit_id VARCHAR(64) PRIMARY KEY,
    staff_account_id VARCHAR(64) NOT NULL REFERENCES accounts(account_id),
    staff_handle VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    target_account_id VARCHAR(64),
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ledger_accounts (
    account_code VARCHAR(128) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    category VARCHAR(32) NOT NULL -- 'asset', 'liability', 'equity', 'revenue', 'expense', 'sink'
);

CREATE TABLE IF NOT EXISTS ledger_transactions (
    transaction_id VARCHAR(64) PRIMARY KEY,
    event_id VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(128) UNIQUE NOT NULL,
    actor_id VARCHAR(64) NOT NULL,
    reason TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ledger_entry_lines (
    line_id BIGSERIAL PRIMARY KEY,
    transaction_id VARCHAR(64) REFERENCES ledger_transactions(transaction_id) ON DELETE CASCADE,
    account_code VARCHAR(128) REFERENCES ledger_accounts(account_code),
    debit DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    credit DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    CONSTRAINT positive_amounts CHECK (debit >= 0 AND credit >= 0)
);

CREATE INDEX IF NOT EXISTS idx_ledger_lines_account ON ledger_entry_lines(account_code);
CREATE INDEX IF NOT EXISTS idx_ledger_tx_idemp ON ledger_transactions(idempotency_key);

-- Deferrable constraint trigger ensuring every ledger transaction is strictly balanced (SUM(debit) == SUM(credit))
CREATE OR REPLACE FUNCTION verify_ledger_transaction_balanced()
RETURNS TRIGGER AS $$
DECLARE
    total_debit DECIMAL(14, 2);
    total_credit DECIMAL(14, 2);
BEGIN
    SELECT COALESCE(SUM(debit), 0.00), COALESCE(SUM(credit), 0.00)
    INTO total_debit, total_credit
    FROM ledger_entry_lines
    WHERE transaction_id = COALESCE(NEW.transaction_id, OLD.transaction_id);

    IF total_debit <> total_credit OR total_debit <= 0 THEN
        RAISE EXCEPTION 'LEDGER_INVARIANT_VIOLATION: Transaction % is unbalanced (debit=%, credit=%)',
            COALESCE(NEW.transaction_id, OLD.transaction_id), total_debit, total_credit;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS missions (
    mission_id VARCHAR(64) PRIMARY KEY,
    player_id VARCHAR(64) REFERENCES players(player_id),
    mission_type VARCHAR(32) NOT NULL,
    pickup_node_id VARCHAR(64) NOT NULL,
    dropoff_node_id VARCHAR(64) NOT NULL,
    reward_game_naira INT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'available', -- 'available', 'accepted', 'completed', 'failed'
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS reward_evidence (
    evidence_id VARCHAR(64) PRIMARY KEY,
    mission_id VARCHAR(64) NOT NULL,
    player_id VARCHAR(64) NOT NULL,
    ruleset_version VARCHAR(32) NOT NULL,
    telemetry_hash VARCHAR(128) NOT NULL,
    average_speed_kmh DECIMAL(5, 2) NOT NULL,
    max_speed_kmh DECIMAL(5, 2) NOT NULL,
    collision_impulse_sum DECIMAL(8, 2) NOT NULL,
    risk_score DECIMAL(4, 3) NOT NULL,
    server_signature TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reward_payables (
    payable_id VARCHAR(64) PRIMARY KEY,
    evidence_id VARCHAR(64) REFERENCES reward_evidence(evidence_id),
    player_id VARCHAR(64) REFERENCES players(player_id),
    campaign_id VARCHAR(64) NOT NULL,
    amount_fiat_ngn DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'NGN',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'VERIFIED', 'APPROVED', 'PAYMENT_PROCESSING', 'PAID', 'ON_HOLD', 'REVERSED', 'FAILED'
    external_provider_ref VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
