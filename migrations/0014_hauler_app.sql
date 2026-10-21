ALTER TABLE `pickups` ADD `planned_facility_id` text;--> statement-breakpoint
ALTER TABLE `users` ADD `failed_logins` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `locked_until` text;