CREATE TABLE `alert_reads` (
	`id` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `change_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text,
	`field` text,
	`old_value` text,
	`new_value` text,
	`user` text,
	`source` text,
	`at` text
);
--> statement-breakpoint
CREATE INDEX `change_logs_device_idx` ON `change_logs` (`device_id`);--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`abn` text,
	`contact` text,
	`phone` text,
	`address` text,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`ref` text NOT NULL,
	`number` text,
	`aka` text,
	`status` text NOT NULL,
	`type` text,
	`waste` text,
	`qr` text,
	`capacity` real,
	`lat` real,
	`lng` real,
	`freq_weeks` real,
	`last_service` text,
	`approval_category` text,
	`risk` text,
	`location_desc` text,
	`comments` text,
	`location_id` text,
	`company_id` text
);
--> statement-breakpoint
CREATE INDEX `devices_location_idx` ON `devices` (`location_id`);--> statement-breakpoint
CREATE INDEX `devices_company_idx` ON `devices` (`company_id`);--> statement-breakpoint
CREATE TABLE `drivers` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text,
	`name` text NOT NULL,
	`account` text,
	`phone` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text
);
--> statement-breakpoint
CREATE INDEX `drivers_company_idx` ON `drivers` (`company_id`);--> statement-breakpoint
CREATE TABLE `facilities` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`lat` real,
	`lng` real,
	`qr` text,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `import_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`at` text,
	`user` text,
	`file_name` text,
	`total` integer,
	`added` integer,
	`updated` integer,
	`unchanged` integer,
	`failed` integer,
	`new_locations` integer,
	`new_companies` integer,
	`errors` text
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`agreement_no` text,
	`address1` text,
	`address2` text,
	`suburb` text,
	`state` text,
	`postcode` text,
	`lat` real,
	`lng` real,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `pickups` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text,
	`location_id` text,
	`company_id` text,
	`driver_id` text,
	`vehicle_id` text,
	`volume` real,
	`start_at` text,
	`end_at` text,
	`start_lat` real,
	`start_lng` real,
	`end_lat` real,
	`end_lng` real,
	`distance` real,
	`photos` integer,
	`flags` text,
	`note` text,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pickups_device_idx` ON `pickups` (`device_id`);--> statement-breakpoint
CREATE INDEX `pickups_vehicle_idx` ON `pickups` (`vehicle_id`);--> statement-breakpoint
CREATE TABLE `transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text,
	`driver_id` text,
	`from_vehicle_id` text,
	`to_vehicle_id` text,
	`volume` real,
	`at` text,
	`lat` real,
	`lng` real
);
--> statement-breakpoint
CREATE INDEX `transfers_from_idx` ON `transfers` (`from_vehicle_id`);--> statement-breakpoint
CREATE INDEX `transfers_to_idx` ON `transfers` (`to_vehicle_id`);--> statement-breakpoint
CREATE TABLE `unloads` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text,
	`driver_id` text,
	`vehicle_id` text,
	`facility_id` text,
	`volume` real,
	`at` text,
	`lat` real,
	`lng` real
);
--> statement-breakpoint
CREATE INDEX `unloads_vehicle_idx` ON `unloads` (`vehicle_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'authority' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text,
	`plate` text NOT NULL,
	`type` text,
	`tank` real,
	`qr` text,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `vehicles_company_idx` ON `vehicles` (`company_id`);