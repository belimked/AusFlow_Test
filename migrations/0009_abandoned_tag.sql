CREATE TABLE `inspections` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`inspector` text,
	`at` text,
	`result` text NOT NULL,
	`comments` text,
	`next_inspection` text,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inspections_device_idx` ON `inspections` (`device_id`);--> statement-breakpoint
CREATE TABLE `reported_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`category` text NOT NULL,
	`description` text,
	`reported_by` text,
	`at` text,
	`status` text DEFAULT 'open' NOT NULL,
	`source` text DEFAULT 'App' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reported_issues_device_idx` ON `reported_issues` (`device_id`);--> statement-breakpoint
ALTER TABLE `companies` ADD `types` text DEFAULT '["hauler"]' NOT NULL;--> statement-breakpoint
UPDATE `companies` SET `types` = '["hauler"]';--> statement-breakpoint
ALTER TABLE `locations` ADD `owner_id` text;--> statement-breakpoint
ALTER TABLE `locations` ADD `occupier_id` text;