-- AlterTable
ALTER TABLE `payments` ADD COLUMN `meta` JSON NULL,
    MODIFY `provider` ENUM('MOCK', 'MANUAL_USDT', 'EZPAY') NOT NULL;
