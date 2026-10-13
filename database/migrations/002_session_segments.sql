-- Keep public session names and stable session order independently of editing dates.
ALTER TABLE mentoring_entries ADD COLUMN session_label text NOT NULL DEFAULT 'Mentoring session' CHECK (length(session_label) BETWEEN 1 AND 80);
ALTER TABLE mentoring_entries ADD COLUMN session_number integer CHECK (session_number > 0);
WITH numbered AS (
  SELECT id, row_number() OVER (PARTITION BY company_id ORDER BY session_date NULLS LAST, created_at, id) AS number
  FROM mentoring_entries
)
UPDATE mentoring_entries e SET session_number=n.number FROM numbered n WHERE e.id=n.id;
CREATE UNIQUE INDEX mentoring_entries_number ON mentoring_entries(company_id, session_number);
