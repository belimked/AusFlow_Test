CREATE TABLE `device_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text,
	`data_url` text NOT NULL,
	`user` text,
	`at` text
);
--> statement-breakpoint
CREATE INDEX `device_photos_device_idx` ON `device_photos` (`device_id`);--> statement-breakpoint
ALTER TABLE `devices` ADD `tags` text;--> statement-breakpoint
UPDATE `devices` SET `tags` = `qr` WHERE `tags` IS NULL AND `qr` <> '';
