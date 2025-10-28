-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 28, 2025 at 11:20 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `direct_sales_tree`
--

-- --------------------------------------------------------

--
-- Table structure for table `members`
--

CREATE TABLE `members` (
  `id` bigint(20) NOT NULL,
  `wallet_address` varchar(42) NOT NULL,
  `username` varchar(80) DEFAULT NULL,
  `joined_at` datetime NOT NULL DEFAULT current_timestamp(),
  `root_id` bigint(20) DEFAULT NULL,
  `sponsor_id` bigint(20) DEFAULT NULL,
  `activation_sequence` int(11) DEFAULT NULL,
  `current_level` int(11) DEFAULT NULL,
  `total_nft_claimed` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `member_closure`
--

CREATE TABLE `member_closure` (
  `ancestor_id` bigint(20) NOT NULL,
  `descendant_id` bigint(20) NOT NULL,
  `depth` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `placements`
--

CREATE TABLE `placements` (
  `parent_id` bigint(20) NOT NULL,
  `child_id` bigint(20) NOT NULL,
  `position` tinyint(4) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `members`
--
ALTER TABLE `members`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `wallet_address` (`wallet_address`),
  ADD KEY `fk_members_root` (`root_id`),
  ADD KEY `idx_members_wallet` (`wallet_address`),
  ADD KEY `idx_members_sponsor` (`sponsor_id`),
  ADD KEY `idx_members_activation` (`activation_sequence`);

--
-- Indexes for table `member_closure`
--
ALTER TABLE `member_closure`
  ADD PRIMARY KEY (`ancestor_id`,`descendant_id`),
  ADD KEY `idx_mc_anc_depth` (`ancestor_id`,`depth`),
  ADD KEY `idx_mc_des_depth` (`descendant_id`,`depth`);

--
-- Indexes for table `placements`
--
ALTER TABLE `placements`
  ADD PRIMARY KEY (`child_id`),
  ADD UNIQUE KEY `uq_parent_pos` (`parent_id`,`position`),
  ADD KEY `idx_pl_parent` (`parent_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `members`
--
ALTER TABLE `members`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `members`
--
ALTER TABLE `members`
  ADD CONSTRAINT `fk_members_root` FOREIGN KEY (`root_id`) REFERENCES `members` (`id`),
  ADD CONSTRAINT `fk_members_sponsor` FOREIGN KEY (`sponsor_id`) REFERENCES `members` (`id`);

--
-- Constraints for table `member_closure`
--
ALTER TABLE `member_closure`
  ADD CONSTRAINT `fk_mc_anc` FOREIGN KEY (`ancestor_id`) REFERENCES `members` (`id`),
  ADD CONSTRAINT `fk_mc_des` FOREIGN KEY (`descendant_id`) REFERENCES `members` (`id`);

--
-- Constraints for table `placements`
--
ALTER TABLE `placements`
  ADD CONSTRAINT `fk_pl_child` FOREIGN KEY (`child_id`) REFERENCES `members` (`id`),
  ADD CONSTRAINT `fk_pl_parent` FOREIGN KEY (`parent_id`) REFERENCES `members` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
