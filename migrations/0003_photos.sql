CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text,
	`data_url` text NOT NULL,
	`user` text,
	`at` text
);
--> statement-breakpoint
CREATE INDEX `photos_entity_idx` ON `photos` (`entity_type`,`entity_id`);--> statement-breakpoint
INSERT INTO `photos` (`id`, `entity_type`, `entity_id`, `kind`, `name`, `data_url`, `user`, `at`) SELECT `id`, 'device', `device_id`, `kind`, `name`, `data_url`, `user`, `at` FROM `device_photos`;
