-- ══════════════════════════════════════════════════════
-- Yedidogan POS — PostgreSQL schema (SQL)
-- Idempotent: birnäçe gezek işledip bolýar
-- psql ýa-da init-db.bat bilen işlediň
-- ══════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE enum_users_role AS ENUM ('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  email       VARCHAR(255) NOT NULL UNIQUE,
  name        VARCHAR(255),
  code_hash   VARCHAR(255) NOT NULL,
  role        enum_users_role NOT NULL DEFAULT 'user',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS items (
  id          SERIAL PRIMARY KEY,
  plu         VARCHAR(255),
  name        VARCHAR(255) NOT NULL,
  gram        DECIMAL(12, 3) NOT NULL DEFAULT 0,
  mm          INTEGER NOT NULL DEFAULT 0,
  code        VARCHAR(255) NOT NULL UNIQUE,
  tare        DECIMAL(10, 3) NOT NULL DEFAULT 0,
  barcode     VARCHAR(255),
  mode        VARCHAR(255),
  "self"      VARCHAR(255),
  label       VARCHAR(255),
  shop        VARCHAR(255),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS items_code ON items (code);
CREATE INDEX IF NOT EXISTS items_barcode ON items (barcode);
CREATE INDEX IF NOT EXISTS items_plu ON items (plu);
CREATE INDEX IF NOT EXISTS items_name ON items (name);

CREATE TABLE IF NOT EXISTS invoices (
  id          SERIAL PRIMARY KEY,
  faktura_no  VARCHAR(255),
  zawod       VARCHAR(255),
  sklad       VARCHAR(255),
  date        DATE,
  issued      VARCHAR(255),
  received    VARCHAR(255),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id          SERIAL PRIMARY KEY,
  invoice_id  INTEGER NOT NULL,
  plu         VARCHAR(255),
  name        VARCHAR(255),
  code        VARCHAR(255),
  width       VARCHAR(255),
  mode        VARCHAR(255),
  gross       DECIMAL(10, 3) NOT NULL DEFAULT 0,
  tare        DECIMAL(10, 3) NOT NULL DEFAULT 0,
  net         DECIMAL(10, 3) NOT NULL DEFAULT 0,
  "self"      VARCHAR(255),
  label       VARCHAR(255),
  shop        VARCHAR(255),
  box_qty     INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_invoice_id_fkey'
  ) THEN
    ALTER TABLE invoice_items
      ADD CONSTRAINT invoice_items_invoice_id_fkey
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS invoice_items_invoice_id ON invoice_items (invoice_id);

CREATE TABLE IF NOT EXISTS production_orders (
  id            SERIAL PRIMARY KEY,
  zf_no         VARCHAR(255),
  musteri       VARCHAR(255),
  sargytsy      VARCHAR(255),
  date          DATE,
  product_name  VARCHAR(255),
  product_code  VARCHAR(255),
  order_qty     VARCHAR(255),
  deadline      VARCHAR(255),
  job_name      VARCHAR(255),
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS production_orders_zf_no ON production_orders (zf_no);
CREATE INDEX IF NOT EXISTS production_orders_musteri ON production_orders (musteri);
CREATE INDEX IF NOT EXISTS production_orders_product_code ON production_orders (product_code);
