-- Manual USDT flow removed: drop MANUAL_USDT provider and SUBMITTED status
DELETE FROM `payments` WHERE `provider` = 'MANUAL_USDT';
UPDATE `payments` SET `status` = 'FAILED' WHERE `status` = 'SUBMITTED';
ALTER TABLE `payments` MODIFY `provider` ENUM('MOCK', 'BEPUSDT') NOT NULL,
    MODIFY `status` ENUM('PENDING', 'CONFIRMED', 'FAILED', 'EXPIRED') NOT NULL DEFAULT 'PENDING';