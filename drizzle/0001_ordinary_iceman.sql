CREATE TABLE `students` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int,
	`displayName` varchar(160) NOT NULL,
	`gradeLevel` varchar(40),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `students_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `passages` ADD `studentId` int;--> statement-breakpoint
ALTER TABLE `readingSessions` ADD `studentId` int;