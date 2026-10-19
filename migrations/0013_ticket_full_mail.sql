CREATE TABLE `ticket_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`filename` text,
	`mime_type` text,
	`content_id` text,
	`disposition` text,
	`size` integer,
	`data_url` text
);
--> statement-breakpoint
CREATE INDEX `ticket_attachments_ticket_idx` ON `ticket_attachments` (`ticket_id`);--> statement-breakpoint
ALTER TABLE `tickets` ADD `body_html` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `headers` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `raw` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `from_email` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `dedupe_key` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `keywords` text;--> statement-breakpoint
CREATE INDEX `tickets_dedupe_idx` ON `tickets` (`dedupe_key`);