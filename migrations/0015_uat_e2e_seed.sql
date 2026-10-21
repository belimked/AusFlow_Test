-- UAT ONLY (uat branch). Accounts and data for the AusFlow iOS end-to-end tests (Maestro, GitHub Actions).
-- Never merge this file into main. Passwords are random and stored as GitHub secrets in belimked/ausflow_ios;
-- only their PBKDF2 hashes are here. Every id starts with E2E- so the records are easy to recognise and remove.
INSERT OR IGNORE INTO `users` (`id`, `username`, `password_hash`, `display_name`, `role`, `email`, `status`) VALUES ('E2E-US-OPS1', 'e2e_ops', 'pbkdf2$100000$oYmoJy5apz2zg11JRHBsnQ$ji9bUftL9eU2a4Edhh-wYU_EoYJPb4TXJEt8su57-mw', 'E2E Driver One', 'ops', NULL, 'active');
--> statement-breakpoint
INSERT OR IGNORE INTO `users` (`id`, `username`, `password_hash`, `display_name`, `role`, `email`, `status`) VALUES ('E2E-US-OPS2', 'e2e_ops2', 'pbkdf2$100000$QcWNGovAmWKNeTqo8__xlQ$QGl5m3DqlvxbUV8tN2nngOycCaA88vURjS1JYNMtPAo', 'E2E Driver Two', 'ops', NULL, 'active');
--> statement-breakpoint
INSERT OR IGNORE INTO `users` (`id`, `username`, `password_hash`, `display_name`, `role`, `email`, `status`) VALUES ('E2E-US-VIEW', 'e2e_view', 'pbkdf2$100000$gbiR3Ta_6Y-YgFYLaYGt0Q$1xcr9Xk8HXa-l6zVRrjfJq5PQvBSV2XGlZps-RJpUr0', 'E2E Viewer', 'user', NULL, 'active');
--> statement-breakpoint
INSERT OR IGNORE INTO `companies` (`id`, `name`, `phone`, `status`, `types`) VALUES ('E2E-CO1', 'E2E Transport', NULL, 'active', '["transport"]');
--> statement-breakpoint
INSERT OR IGNORE INTO `drivers` (`id`, `company_id`, `name`, `account`, `status`) VALUES ('E2E-DR1', 'E2E-CO1', 'E2E Driver One', 'e2e_ops', 'active');
--> statement-breakpoint
INSERT OR IGNORE INTO `drivers` (`id`, `company_id`, `name`, `account`, `status`) VALUES ('E2E-DR2', 'E2E-CO1', 'E2E Driver Two', 'e2e_ops2', 'active');
--> statement-breakpoint
INSERT OR IGNORE INTO `vehicles` (`id`, `company_id`, `plate`, `type`, `tank`, `qr`, `status`) VALUES ('E2E-VE1', 'E2E-CO1', 'E2E 001', 'small', 4000, 'VHE2E0000001', 'active');
--> statement-breakpoint
INSERT OR IGNORE INTO `vehicles` (`id`, `company_id`, `plate`, `type`, `tank`, `qr`, `status`) VALUES ('E2E-VE2', 'E2E-CO1', 'E2E 002', 'large', 8000, 'VHE2E0000002', 'active');
--> statement-breakpoint
INSERT OR IGNORE INTO `locations` (`id`, `name`, `address1`, `suburb`, `state`, `postcode`, `lat`, `lng`, `status`) VALUES ('E2E-LO1', 'E2E Test Site', '1 Test Street', 'Adelaide', 'SA', '5000', -34.9285, 138.6007, 'active');
--> statement-breakpoint
INSERT OR IGNORE INTO `devices` (`id`, `ref`, `aka`, `status`, `type`, `waste`, `qr`, `capacity`, `lat`, `lng`, `freq_weeks`, `location_id`, `company_id`, `location_desc`) VALUES ('E2E-DV1', 'E2E-DEV-001', 'E2E Test Trap', 'Active', 'Grease Arrestor', 'Grease Trap Waste', 'E2EQR0001', 1000, -34.9285, 138.6007, 4, 'E2E-LO1', 'E2E-CO1', 'Automated test device, not a real site');
--> statement-breakpoint
INSERT OR IGNORE INTO `facilities` (`id`, `name`, `address`, `lat`, `lng`, `qr`, `status`) VALUES ('E2E-FA1', 'E2E Treatment Plant', '2 Test Street, Adelaide SA 5000', -34.93, 138.6, 'FAE2E0000001', 'active');
