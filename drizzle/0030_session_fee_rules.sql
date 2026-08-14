-- Add configurable registration fee rules for session fee configs
ALTER TABLE `session_fee_configs` ADD COLUMN `pricing_rules` text DEFAULT '[]' NOT NULL;
