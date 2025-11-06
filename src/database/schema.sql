-- Direct Sales Tree Database Schema
-- Based on the 3-wide tree structure guide

-- Drop tables if they exist (for development)
DROP TABLE IF EXISTS member_closure;
DROP TABLE IF EXISTS placements;
DROP TABLE IF EXISTS members;

-- members: business identity + sponsor link + BeeHive system fields
CREATE TABLE members (
  id         BIGINT PRIMARY KEY AUTO_INCREMENT,
  wallet_address VARCHAR(42) NOT NULL UNIQUE,  -- Ethereum wallet address
  username   VARCHAR(80) NULL,                 -- Optional username
  joined_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  root_id    BIGINT NULL,                      -- top ancestor of the placed team
  sponsor_id BIGINT NULL,                      -- business referrer (not always the placement parent)
  activation_sequence INT NULL,               -- order of activation from CSV
  current_level INT NULL,                     -- level from CSV (for reference)
  total_nft_claimed INT NULL,                 -- NFT count from CSV
  -- BeeHive system fields (merged from beehive_members)
  beehive_current_level INT DEFAULT 0,        -- 0 = not started, 1-19 = current BeeHive level
  beehive_total_inflow DECIMAL(10,2) DEFAULT 0.00,
  beehive_total_outflow_usdt DECIMAL(10,2) DEFAULT 0.00,
  beehive_total_outflow_bcc INT DEFAULT 0,
  beehive_direct_sponsor_claimed_count INT DEFAULT 0, -- Track how many direct sponsors claimed (max 2 for level 1)
  beehive_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_members_sponsor FOREIGN KEY (sponsor_id) REFERENCES members(id),
  CONSTRAINT fk_members_root FOREIGN KEY (root_id) REFERENCES members(id)
);

-- placements: actual tree parenting with fixed positions 1..3
CREATE TABLE placements (
  parent_id BIGINT NOT NULL,
  child_id  BIGINT NOT NULL,
  position  TINYINT NOT NULL,       -- 1, 2, or 3
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (child_id),
  CONSTRAINT fk_pl_parent FOREIGN KEY (parent_id) REFERENCES members(id),
  CONSTRAINT fk_pl_child  FOREIGN KEY (child_id)  REFERENCES members(id),
  CONSTRAINT uq_parent_pos UNIQUE (parent_id, position),
  CONSTRAINT chk_pos CHECK (position BETWEEN 1 AND 3)
);

-- member_closure: transitive closure for fast subtree/level queries
CREATE TABLE member_closure (
  ancestor_id   BIGINT NOT NULL,
  descendant_id BIGINT NOT NULL,
  depth         INT    NOT NULL,    -- 0=self, 1=parent, 2=grandparent, ...
  PRIMARY KEY (ancestor_id, descendant_id),
  CONSTRAINT fk_mc_anc FOREIGN KEY (ancestor_id) REFERENCES members(id),
  CONSTRAINT fk_mc_des FOREIGN KEY (descendant_id) REFERENCES members(id)
);

-- helpful indexes
CREATE INDEX idx_pl_parent   ON placements(parent_id);
CREATE INDEX idx_mc_anc_depth ON member_closure(ancestor_id, depth);
CREATE INDEX idx_mc_des_depth ON member_closure(descendant_id, depth);
CREATE INDEX idx_members_wallet ON members(wallet_address);
CREATE INDEX idx_members_sponsor ON members(sponsor_id);
CREATE INDEX idx_members_activation ON members(activation_sequence);
CREATE INDEX idx_members_beehive_level ON members(beehive_current_level);
