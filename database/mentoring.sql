-- Dedicated Business Forward mentoring database. Apply once to a new project.
CREATE TABLE mentoring_companies (
  id text PRIMARY KEY,
  name text NOT NULL,
  budget_minutes integer NOT NULL DEFAULT 600 CHECK (budget_minutes BETWEEN 0 AND 60000),
  display_order integer NOT NULL
);
CREATE TABLE mentoring_entries (
  id uuid PRIMARY KEY,
  company_id text NOT NULL REFERENCES mentoring_companies(id),
  session_date date NOT NULL,
  meeting_minutes integer NOT NULL CHECK (meeting_minutes BETWEEN 0 AND 1440),
  followup_minutes integer NOT NULL CHECK (followup_minutes BETWEEN 0 AND 1440),
  private_note text NOT NULL DEFAULT '' CHECK (length(private_note) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz,
  CHECK (meeting_minutes + followup_minutes > 0)
);
CREATE INDEX mentoring_entries_company ON mentoring_entries(company_id, session_date DESC);
CREATE TABLE mentoring_timer (
  id integer PRIMARY KEY CHECK (id = 1),
  company_id text NOT NULL REFERENCES mentoring_companies(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  private_note text NOT NULL DEFAULT '' CHECK (length(private_note) <= 2000)
);
CREATE TABLE mentoring_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id text NOT NULL,
  action text NOT NULL,
  record_id text,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO mentoring_companies (id,name,display_order) VALUES
  ('acc','ACC',1),
  ('elmar-trading','Elmar Trading',2),
  ('laboratorul-de-bucurii','Laboratorul de Bucurii',3),
  ('scule-tencuiala','Scule Tencuiala',4),
  ('ai-consulting','A&I Consulting',5);
-- No browser database access or Data API. Only the server uses DATABASE_URL.
