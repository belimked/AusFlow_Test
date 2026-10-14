CREATE TABLE `alert_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`alert_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text,
	`text` text,
	`user` text,
	`at` text
);
--> statement-breakpoint
CREATE INDEX `alert_notes_alert_idx` ON `alert_notes` (`alert_id`);