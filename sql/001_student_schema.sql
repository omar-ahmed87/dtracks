-- Run in Supabase SQL editor for full student features

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS enrolled_courses JSONB DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'cancelled')),
  progress JSONB NOT NULL DEFAULT '{"completedLessons":[],"quizCompleted":false,"quizScore":0}'::jsonb,
  phone TEXT,
  applicant_name TEXT,
  applicant_email TEXT,
  form_data JSONB DEFAULT '{}'::jsonb,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_id)
);

ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS applicant_name TEXT;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS applicant_email TEXT;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS form_data JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id);

CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone TEXT,
  email TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'email')),
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS idx_password_resets_phone ON password_resets(phone);
