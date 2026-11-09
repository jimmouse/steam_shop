-- Rename PaymentProvider EZPAY -> BEPUSDT, keeping existing rows
ALTER TABLE `payments` MODIFY `provider` ENUM('MOCK', 'MANUAL_USDT', 'EZPAY', 'BEPUSDT') NOT NULL;
UPDATE `payments` SET `provider` = 'BEPUSDT' WHERE `provider` = 'EZPAY';
ALTER TABLE `payments` MODIFY `provider` ENUM('MOCK', 'MANUAL_USDT', 'BEPUSDT') NOT NULL;