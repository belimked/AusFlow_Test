CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`text` text NOT NULL,
	`user` text,
	`source` text NOT NULL,
	`at` text
);
--> statement-breakpoint
CREATE INDEX `notes_entity_idx` ON `notes` (`entity_type`,`entity_id`);--> statement-breakpoint
ALTER TABLE `change_logs` ADD `entity_type` text DEFAULT 'device' NOT NULL;--> statement-breakpoint
ALTER TABLE `change_logs` ADD `entity_id` text;--> statement-breakpoint
UPDATE `change_logs` SET `entity_id` = `device_id` WHERE `entity_id` IS NULL;