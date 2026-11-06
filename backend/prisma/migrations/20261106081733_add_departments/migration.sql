-- AlterTable
ALTER TABLE `users` ADD COLUMN `department_id` CHAR(36) NULL;

-- CreateTable
CREATE TABLE `departments` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `description` VARCHAR(500) NULL,
    `manager_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `departments_code_key`(`code`),
    UNIQUE INDEX `departments_name_key`(`name`),
    INDEX `departments_deleted_at_idx`(`deleted_at`),
    INDEX `departments_manager_id_idx`(`manager_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `users_department_id_idx` ON `users`(`department_id`);

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_manager_id_fkey` FOREIGN KEY (`manager_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
