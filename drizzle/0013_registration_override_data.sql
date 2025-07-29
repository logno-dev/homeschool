-- Add pending registration data field to family_registration_status table
ALTER TABLE family_registration_status ADD COLUMN pending_registration_data TEXT;