-- BeeHive System Database Schema
-- Integrated with existing tree_diagram members and placements
-- Note: Tables are dropped by setup script before creation

-- BeeHive level definitions (19 levels)
CREATE TABLE beehive_levels (
  level INT PRIMARY KEY,
  level_name_cn VARCHAR(50) NOT NULL,
  level_name_en VARCHAR(100) NOT NULL,
  fee_usdt DECIMAL(10,2) NOT NULL,
  bcc_reward INT NOT NULL,
  layer_depth INT NOT NULL,
  usdt_payout DECIMAL(10,2) NOT NULL
);

-- Insert level definitions
INSERT INTO beehive_levels (level, level_name_cn, level_name_en, fee_usdt, bcc_reward, layer_depth, usdt_payout) VALUES
(1, '勇士', 'Warrior (Base)', 130.00, 500, 1, 100.00),
(2, '青铜', 'Bronze', 150.00, 100, 2, 150.00),
(3, '白银', 'Silver', 200.00, 200, 3, 200.00),
(4, '黄金', 'Gold', 250.00, 300, 4, 250.00),
(5, '精英', 'Elite', 300.00, 400, 5, 300.00),
(6, '铂金', 'Platinum', 350.00, 500, 6, 350.00),
(7, '大师', 'Master', 400.00, 600, 7, 400.00),
(8, '钻石', 'Diamond', 450.00, 700, 8, 450.00),
(9, '宗师', 'Grandmaster', 500.00, 800, 9, 500.00),
(10, '星耀', 'Starlight', 550.00, 900, 10, 550.00),
(11, '史诗', 'Epic', 600.00, 1000, 11, 600.00),
(12, '殿堂', 'Hall (Legend)', 650.00, 1100, 12, 650.00),
(13, '最强王者', 'Supreme King', 700.00, 1200, 13, 700.00),
(14, '无双王者', 'Peerless King', 750.00, 1300, 14, 750.00),
(15, '荣耀王者', 'Glory King', 800.00, 1400, 15, 800.00),
(16, '传奇主宰', 'Legendary Overlord', 850.00, 1500, 16, 850.00),
(17, '至尊主宰', 'Supreme Overlord', 900.00, 1600, 17, 900.00),
(18, '至尊神话', 'Mythic Supreme', 950.00, 900, 18, 950.00),
(19, '神话巅峰', 'Mythic Apex', 1000.00, 1950, 19, 1000.00);

-- BeeHive member status is now merged into members table
-- (beehive_members table removed - fields are now in members table)

-- Payment/Transaction records (chronological order matters)
CREATE TABLE beehive_transactions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  member_id BIGINT NOT NULL, -- FK to members.id (direct reference, no beehive_members table)
  wallet_address VARCHAR(42) NOT NULL,
  referrer_wallet VARCHAR(42) NULL,
  payment_datetime DATETIME NOT NULL,
  total_payment DECIMAL(10,2) NOT NULL,
  target_level INT NOT NULL,
  status ENUM('pending', 'qualified', 'failed') DEFAULT 'pending',
  qualified_at DATETIME NULL,
  expires_at DATETIME NOT NULL, -- payment_datetime + 72h
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  INDEX idx_payment_datetime (payment_datetime),
  INDEX idx_status (status),
  INDEX idx_expires_at (expires_at)
);

-- Reward records (earned, pending, claimed, passed up)
CREATE TABLE beehive_rewards (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  recipient_member_id BIGINT NOT NULL, -- FK to members.id (direct reference)
  recipient_wallet VARCHAR(42) NOT NULL,
  source_transaction_id BIGINT NULL, -- Which upgrade triggered this
  source_wallet VARCHAR(42) NULL, -- Who triggered this reward
  reward_type ENUM('direct_sponsor', 'layer_payout', 'bcc_token') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency ENUM('USDT', 'BCC') NOT NULL,
  status ENUM('instant', 'pending', 'claimed', 'passed_up', 'expired') NOT NULL,
  layer_number INT NULL, -- For layer payouts
  layer_upgrade_sequence INT NULL, -- 1st, 2nd, or 3rd upgrade in this layer for this upline
  pending_expires_at DATETIME NULL,
  passed_up_to BIGINT NULL, -- If passed up, to whom (FK to members.id)
  passed_up_to_wallet VARCHAR(42) NULL,
  notes TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  claimed_at DATETIME NULL,
  FOREIGN KEY (recipient_member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (source_transaction_id) REFERENCES beehive_transactions(id) ON DELETE SET NULL,
  FOREIGN KEY (passed_up_to) REFERENCES members(id) ON DELETE SET NULL,
  INDEX idx_recipient (recipient_member_id),
  INDEX idx_status (status),
  INDEX idx_reward_type (reward_type),
  INDEX idx_pending_expires (pending_expires_at)
);

-- Track layer upgrade counts for 1st/2nd/3rd rule
CREATE TABLE beehive_layer_counters (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  upline_member_id BIGINT NOT NULL, -- FK to members.id (direct reference)
  upline_wallet VARCHAR(42) NOT NULL,
  layer_number INT NOT NULL,
  upgrade_count INT DEFAULT 0, -- How many people upgraded to this level in this layer
  last_upgrade_at DATETIME NULL,
  UNIQUE KEY unique_upline_layer (upline_member_id, layer_number),
  FOREIGN KEY (upline_member_id) REFERENCES members(id) ON DELETE CASCADE,
  INDEX idx_upline_layer (upline_member_id, layer_number)
);

