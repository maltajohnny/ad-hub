-- Opcional: executar quando ligar persistência PostgreSQL ao handler.
CREATE TABLE IF NOT EXISTS business_profiles (
  id SERIAL PRIMARY KEY,
  name TEXT,
  address TEXT,
  phone TEXT,
  website TEXT,
  rating DOUBLE PRECISION,
  reviews_count INT,
  category TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  place_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analysis_reports (
  id SERIAL PRIMARY KEY,
  business_id INT REFERENCES business_profiles (id) ON DELETE CASCADE,
  score INT,
  weak_points JSONB,
  strong_points JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
