-- Hot-path indexes for faster billing, kitchen, and login queries.
CREATE INDEX IF NOT EXISTS pops_bills_branch_status_created_idx
  ON pops_bills (branch_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS pops_kitchen_tickets_branch_status_idx
  ON pops_kitchen_tickets (branch_id, status);

CREATE INDEX IF NOT EXISTS organization_memberships_user_id_idx
  ON organization_memberships (user_id);
