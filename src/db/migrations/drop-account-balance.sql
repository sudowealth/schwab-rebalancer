-- Migration to drop the balance column from account table
-- The balance is now calculated from the sum of holdings

-- Drop the balance column
ALTER TABLE account DROP COLUMN balance;