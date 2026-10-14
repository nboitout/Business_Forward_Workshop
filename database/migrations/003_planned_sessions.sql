-- Planned work reserves time without being reported as completed work.
ALTER TABLE mentoring_entries ADD COLUMN status text NOT NULL DEFAULT 'completed'
  CHECK (status IN ('completed', 'planned'));
ALTER TABLE mentoring_entries ALTER COLUMN session_date DROP NOT NULL;
ALTER TABLE mentoring_entries ADD CONSTRAINT completed_session_has_date
  CHECK (status = 'planned' OR session_date IS NOT NULL);
