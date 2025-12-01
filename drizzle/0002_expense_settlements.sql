CREATE TABLE IF NOT EXISTS expense_settlements (
  id SERIAL PRIMARY KEY,
  month DATE NOT NULL,
  category_id INTEGER NOT NULL REFERENCES budget_categories(id),
  from_user TEXT NOT NULL,
  to_user TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
