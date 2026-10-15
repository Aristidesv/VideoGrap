CREATE TABLE IF NOT EXISTS premium_payment_settings (
  id smallint PRIMARY KEY CHECK (id = 1),
  mobile_money_details text NOT NULL DEFAULT '',
  bank_details text NOT NULL DEFAULT '',
  paypal_details text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO premium_payment_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS premium_payment_requests (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_method text NOT NULL
    CHECK (payment_method IN ('mobile_money', 'bank', 'paypal')),
  transaction_reference text NOT NULL CHECK (char_length(transaction_reference) BETWEEN 2 AND 200),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 1000),
  amount_mzn integer NOT NULL DEFAULT 100 CHECK (amount_mzn = 100),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS premium_payment_requests_status_created_idx
  ON premium_payment_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS premium_payment_requests_user_created_idx
  ON premium_payment_requests (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS premium_payment_requests_one_pending_per_user_idx
  ON premium_payment_requests (user_id)
  WHERE status = 'pending';
