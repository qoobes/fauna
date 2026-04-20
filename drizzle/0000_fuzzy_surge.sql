CREATE TABLE `account` (
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`providerAccountId` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	PRIMARY KEY(`provider`, `providerAccountId`),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `scan` (
	`id` text PRIMARY KEY NOT NULL,
	`ownerId` text NOT NULL,
	`ownerEmail` text NOT NULL,
	`url` text NOT NULL,
	`status` text NOT NULL,
	`config` text NOT NULL,
	`overallScore` integer DEFAULT 0 NOT NULL,
	`totalPages` integer DEFAULT 0 NOT NULL,
	`totalIssues` integer DEFAULT 0 NOT NULL,
	`criticalCount` integer DEFAULT 0 NOT NULL,
	`result` text,
	`errorMessage` text,
	`createdAt` integer NOT NULL,
	`startedAt` integer,
	`completedAt` integer,
	FOREIGN KEY (`ownerId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scan_createdAt_idx` ON `scan` (`createdAt`);--> statement-breakpoint
CREATE INDEX `scan_owner_idx` ON `scan` (`ownerId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `scan_status_idx` ON `scan` (`status`);--> statement-breakpoint
CREATE TABLE `session` (
	`sessionToken` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`emailVerified` integer,
	`image` text,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verificationToken` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
