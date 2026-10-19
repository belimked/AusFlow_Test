CREATE TABLE `ticket_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`kind` text NOT NULL,
	`text` text,
	`user` text,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ticket_notes_ticket_idx` ON `ticket_notes` (`ticket_id`);--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`body` text,
	`from_addr` text,
	`message_id` text,
	`priority` text NOT NULL,
	`confidence` real,
	`classified_by` text,
	`assignee_id` text,
	`status` text DEFAULT 'open' NOT NULL,
	`source` text DEFAULT 'email' NOT NULL,
	`received_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_message_id_unique` ON `tickets` (`message_id`);--> statement-breakpoint
CREATE INDEX `tickets_status_idx` ON `tickets` (`status`);--> statement-breakpoint
CREATE INDEX `tickets_assignee_idx` ON `tickets` (`assignee_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`abn` text,
	`contact` text,
	`phone` text,
	`address` text,
	`status` text DEFAULT 'active' NOT NULL,
	`types` text DEFAULT '["transport"]' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_companies`("id", "name", "abn", "contact", "phone", "address", "status", "types") SELECT "id", "name", "abn", "contact", "phone", "address", "status", "types" FROM `companies`;--> statement-breakpoint
DROP TABLE `companies`;--> statement-breakpoint
ALTER TABLE `__new_companies` RENAME TO `companies`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "username", "password_hash", "display_name", "role", "status") SELECT "id", "username", "password_hash", "display_name", "role", "status" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
ALTER TABLE `devices` ADD `owner_id` text;