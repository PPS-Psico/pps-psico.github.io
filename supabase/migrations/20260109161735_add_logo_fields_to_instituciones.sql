ALTER TABLE instituciones ADD COLUMN IF NOT EXISTS logo_url text; ALTER TABLE instituciones ADD COLUMN IF NOT EXISTS logo_invert_dark boolean DEFAULT false;
