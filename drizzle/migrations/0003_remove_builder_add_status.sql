-- Add status column to organization table
ALTER TABLE organization ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';

-- Migrate existing organizations to active status
UPDATE organization SET status = 'active' WHERE id IS NOT NULL;

-- Drop org_builder table
DROP TABLE IF EXISTS org_builder;
