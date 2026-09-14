ALTER TABLE `newsletters` ADD `delivered_count` integer NOT NULL DEFAULT 0;
ALTER TABLE `newsletters` ADD `opened_count` integer NOT NULL DEFAULT 0;
ALTER TABLE `newsletters` ADD `clicked_count` integer NOT NULL DEFAULT 0;
ALTER TABLE `newsletters` ADD `bounced_count` integer NOT NULL DEFAULT 0;
ALTER TABLE `newsletters` ADD `complained_count` integer NOT NULL DEFAULT 0;
ALTER TABLE `newsletters` ADD `unsubscribed_count` integer NOT NULL DEFAULT 0;
ALTER TABLE `newsletters` ADD `suppressed_count` integer NOT NULL DEFAULT 0;
ALTER TABLE `newsletters` ADD `metrics_updated_at` text;
