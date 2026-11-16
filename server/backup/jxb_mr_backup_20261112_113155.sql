-- MySQL dump 10.13  Distrib 8.0.40, for Win64 (x86_64)
--
-- Host: localhost    Database: jxb_mr
-- ------------------------------------------------------
-- Server version	5.5.5-10.4.28-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `jxb_mr`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `jxb_mr` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci */;

USE `jxb_mr`;

--
-- Table structure for table `_prisma_migrations`
--

DROP TABLE IF EXISTS `_prisma_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) NOT NULL,
  `checksum` varchar(64) NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) NOT NULL,
  `logs` text DEFAULT NULL,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `applied_steps_count` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `_prisma_migrations`
--

LOCK TABLES `_prisma_migrations` WRITE;
/*!40000 ALTER TABLE `_prisma_migrations` DISABLE KEYS */;
INSERT INTO `_prisma_migrations` VALUES ('7228ea3d-9b9c-431a-a6b2-1fecccfe614a','2750130ea5e5eded827a8a17708d0f3a9ec27aee8a4aa34edfb2e9651957958a','2026-11-02 04:09:24.933','20261102090000_init',NULL,NULL,'2026-11-02 04:09:14.485',1);
/*!40000 ALTER TABLE `_prisma_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `entityType` varchar(80) NOT NULL,
  `entityId` varchar(80) DEFAULT NULL,
  `before` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`before`)),
  `after` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`after`)),
  `ipAddress` varchar(64) DEFAULT NULL,
  `userAgent` varchar(500) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `audit_logs_userId_idx` (`userId`),
  KEY `audit_logs_entityType_entityId_idx` (`entityType`,`entityId`),
  KEY `audit_logs_createdAt_idx` (`createdAt`),
  CONSTRAINT `audit_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,2,'auth.login','Session',NULL,NULL,NULL,'::ffff:192.168.10.167','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36','2026-11-02 04:47:34.658'),(2,2,'auth.login','Session',NULL,NULL,NULL,'::ffff:192.168.10.167','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36','2026-11-02 04:47:36.480'),(3,2,'auth.logout','Session',NULL,NULL,NULL,NULL,NULL,'2026-11-02 07:12:02.389'),(4,1,'auth.login','Session',NULL,NULL,NULL,'::ffff:192.168.10.167','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36','2026-11-02 07:50:24.091'),(5,1,'auth.login','Session',NULL,NULL,NULL,'::ffff:192.168.10.167','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36','2026-11-02 07:50:25.882'),(6,1,'auth.logout','Session',NULL,NULL,NULL,NULL,NULL,'2026-11-02 07:54:36.830');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mitigation_evidence`
--

DROP TABLE IF EXISTS `mitigation_evidence`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mitigation_evidence` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `planId` int(11) NOT NULL,
  `type` enum('DOCUMENT','LINK','PHOTO','OTHER') NOT NULL DEFAULT 'DOCUMENT',
  `title` varchar(200) NOT NULL,
  `url` varchar(1000) DEFAULT NULL,
  `filePath` varchar(1000) DEFAULT NULL,
  `mimeType` varchar(100) DEFAULT NULL,
  `sizeBytes` int(11) DEFAULT NULL,
  `uploadedById` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `mitigation_evidence_planId_idx` (`planId`),
  KEY `mitigation_evidence_uploadedById_fkey` (`uploadedById`),
  CONSTRAINT `mitigation_evidence_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `mitigation_plans` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `mitigation_evidence_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `users` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mitigation_evidence`
--

LOCK TABLES `mitigation_evidence` WRITE;
/*!40000 ALTER TABLE `mitigation_evidence` DISABLE KEYS */;
INSERT INTO `mitigation_evidence` VALUES (1,1,'DOCUMENT','Ringkasan negosiasi pemasok','https://intranet.jxb.co.id/dokumen/negosiasi-pemasok',NULL,NULL,NULL,3,'2026-10-26 04:30:48.802');
/*!40000 ALTER TABLE `mitigation_evidence` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mitigation_plans`
--

DROP TABLE IF EXISTS `mitigation_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mitigation_plans` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `riskId` int(11) NOT NULL,
  `title` varchar(200) NOT NULL,
  `description` text DEFAULT NULL,
  `treatmentType` enum('MITIGATE','AVOID','TRANSFER','ACCEPT') NOT NULL DEFAULT 'MITIGATE',
  `ownerId` int(11) NOT NULL,
  `createdById` int(11) NOT NULL,
  `startDate` datetime(3) DEFAULT NULL,
  `dueDate` datetime(3) NOT NULL,
  `status` enum('PLANNED','ON_TRACK','AT_RISK','DELAYED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PLANNED',
  `progress` int(11) NOT NULL DEFAULT 0,
  `expectedImpact` text DEFAULT NULL,
  `budget` decimal(15,2) DEFAULT NULL,
  `completedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `mitigation_plans_riskId_idx` (`riskId`),
  KEY `mitigation_plans_ownerId_idx` (`ownerId`),
  KEY `mitigation_plans_status_idx` (`status`),
  KEY `mitigation_plans_dueDate_idx` (`dueDate`),
  KEY `mitigation_plans_createdById_fkey` (`createdById`),
  CONSTRAINT `mitigation_plans_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `mitigation_plans_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `mitigation_plans_riskId_fkey` FOREIGN KEY (`riskId`) REFERENCES `risks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mitigation_plans`
--

LOCK TABLES `mitigation_plans` WRITE;
/*!40000 ALTER TABLE `mitigation_plans` DISABLE KEYS */;
INSERT INTO `mitigation_plans` VALUES (1,1,'Negosiasi ulang kontrak pemasok utama','Lakukan negosiasi harga tahunan dengan tiga pemasok bahan baku utama dan terapkan klausul penyesuaian harga.','MITIGATE',3,2,'2026-09-13 04:30:48.802','2026-11-22 04:30:48.802','ON_TRACK',65,'Menahan kenaikan biaya bahan baku maksimal 5%.',15000000.00,NULL,'2026-11-02 04:30:50.930','2026-11-02 04:30:50.930'),(2,1,'Implementasi kontrol porsi dan pengurangan food waste','Pasang pencatatan food waste harian dan terapkan kontrol porsi pada buffet sarapan.','MITIGATE',3,2,'2026-10-03 04:30:48.802','2026-12-17 04:30:48.802','ON_TRACK',30,'Menurunkan biaya bahan baku dapur sebesar 3%.',8000000.00,NULL,'2026-11-02 04:30:50.930','2026-11-02 04:30:50.930'),(3,1,'Audit bulanan efisiensi energi','Audit konsumsi listrik dan air bulanan bersama engineering untuk menemukan pemborosan.','MITIGATE',3,2,'2026-09-18 04:30:48.802','2026-10-23 04:30:48.802','AT_RISK',45,'Mengidentifikasi penghematan energi minimal 4%.',NULL,NULL,'2026-11-02 04:30:50.930','2026-11-02 04:30:50.930'),(4,1,'Pelatihan pengendalian biaya untuk supervisor','Berikan pelatihan pengendalian biaya dan pembacaan laporan anggaran kepada seluruh supervisor operasional.','MITIGATE',3,2,'2026-09-08 04:30:48.802','2026-10-08 04:30:48.802','COMPLETED',100,'Meningkatkan kedisiplinan realisasi anggaran unit.',NULL,'2026-10-08 04:30:48.802','2026-11-02 04:30:50.930','2026-11-02 04:30:50.930');
/*!40000 ALTER TABLE `mitigation_plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mitigation_updates`
--

DROP TABLE IF EXISTS `mitigation_updates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mitigation_updates` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `planId` int(11) NOT NULL,
  `progress` int(11) NOT NULL,
  `note` text NOT NULL,
  `updateDate` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `createdById` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `mitigation_updates_planId_idx` (`planId`),
  KEY `mitigation_updates_createdById_fkey` (`createdById`),
  CONSTRAINT `mitigation_updates_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `mitigation_updates_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `mitigation_plans` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mitigation_updates`
--

LOCK TABLES `mitigation_updates` WRITE;
/*!40000 ALTER TABLE `mitigation_updates` DISABLE KEYS */;
INSERT INTO `mitigation_updates` VALUES (1,1,40,'Dua dari tiga pemasok menyetujui pembukaan negosiasi harga.','2026-10-09 04:30:48.802',3,'2026-11-02 04:30:50.930'),(2,1,65,'Draf kontrak baru telah diterima, menunggu review legal.','2026-10-26 04:30:48.802',3,'2026-11-02 04:30:50.930'),(3,2,30,'Pencatatan food waste sudah berjalan di dua outlet.','2026-10-28 04:30:48.802',3,'2026-11-02 04:30:50.930'),(4,3,45,'Audit tertunda karena pergantian teknisi senior.','2026-10-21 04:30:48.802',3,'2026-11-02 04:30:50.930'),(5,4,100,'Pelatihan selesai diikuti 24 supervisor. Evaluasi pemahaman 88%.','2026-10-08 04:30:48.802',3,'2026-11-02 04:30:50.930');
/*!40000 ALTER TABLE `mitigation_updates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `type` enum('INFO','RISK_ASSIGNED','REVIEW_DUE','WORKFLOW_UPDATE','MITIGATION_DUE','SYSTEM') NOT NULL DEFAULT 'INFO',
  `title` varchar(200) NOT NULL,
  `message` text NOT NULL,
  `link` varchar(500) DEFAULT NULL,
  `readAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `notifications_userId_readAt_idx` (`userId`,`readAt`),
  CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES (1,3,'WORKFLOW_UPDATE','Risiko RK-OPS-001 disetujui','Risiko Biaya Operasional Meningkat masuk tahap pemantauan.','/risks/1','2026-09-14 04:30:48.802','2026-09-13 04:30:48.802'),(2,3,'MITIGATION_DUE','Mitigasi melewati tenggat','Audit bulanan efisiensi energi melewati tenggat 10 hari.','/risks/1',NULL,'2026-10-24 04:30:48.802'),(3,2,'REVIEW_DUE','Tinjauan risiko akan jatuh tempo','RK-OPS-001 dijadwalkan ditinjau dalam 20 hari.','/risks/1',NULL,'2026-10-31 04:30:48.802');
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `number_sequences`
--

DROP TABLE IF EXISTS `number_sequences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `number_sequences` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(30) NOT NULL,
  `period` varchar(20) NOT NULL,
  `lastNumber` int(11) NOT NULL DEFAULT 0,
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `number_sequences_code_period_key` (`code`,`period`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `number_sequences`
--

LOCK TABLES `number_sequences` WRITE;
/*!40000 ALTER TABLE `number_sequences` DISABLE KEYS */;
INSERT INTO `number_sequences` VALUES (1,'RISK-OPS','2026',3,'2026-11-02 04:30:51.247'),(2,'RISK-FIN','2026',1,'2026-11-02 04:30:51.284'),(3,'RISK-STR','2026',1,'2026-11-02 04:30:51.290'),(4,'RISK-COM','2026',2,'2026-11-02 04:30:51.327'),(5,'RISK-HR','2026',1,'2026-11-02 04:30:51.331'),(6,'RISK-IT','2026',1,'2026-11-02 04:30:51.334');
/*!40000 ALTER TABLE `number_sequences` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `organizational_units`
--

DROP TABLE IF EXISTS `organizational_units`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `organizational_units` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(30) NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `parentId` int(11) DEFAULT NULL,
  `level` int(11) NOT NULL DEFAULT 1,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `sortOrder` int(11) NOT NULL DEFAULT 0,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `organizational_units_code_key` (`code`),
  KEY `organizational_units_parentId_idx` (`parentId`),
  CONSTRAINT `organizational_units_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `organizational_units` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `organizational_units`
--

LOCK TABLES `organizational_units` WRITE;
/*!40000 ALTER TABLE `organizational_units` DISABLE KEYS */;
INSERT INTO `organizational_units` VALUES (1,'CORP','Corporate & Manajemen','Unit Corporate & Manajemen.',NULL,1,1,1,'2026-11-02 04:30:49.481','2026-11-02 04:30:49.481'),(2,'OPS','Operasional Hotel','Unit Operasional Hotel.',NULL,1,1,2,'2026-11-02 04:30:49.485','2026-11-02 04:30:49.485'),(3,'FIN','Keuangan & Akuntansi','Unit Keuangan & Akuntansi.',NULL,1,1,3,'2026-11-02 04:30:49.492','2026-11-02 04:30:49.492'),(4,'COM','Komersial & Pemasaran','Unit Komersial & Pemasaran.',NULL,1,1,4,'2026-11-02 04:30:49.525','2026-11-02 04:30:49.525'),(5,'HR','People & Culture','Unit People & Culture.',NULL,1,1,5,'2026-11-02 04:30:49.529','2026-11-02 04:30:49.529');
/*!40000 ALTER TABLE `organizational_units` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `password_reset_tokens`
--

DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_reset_tokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tokenHash` varchar(191) NOT NULL,
  `userId` int(11) NOT NULL,
  `expiresAt` datetime(3) NOT NULL,
  `usedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `password_reset_tokens_tokenHash_key` (`tokenHash`),
  KEY `password_reset_tokens_userId_idx` (`userId`),
  CONSTRAINT `password_reset_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_reset_tokens`
--

LOCK TABLES `password_reset_tokens` WRITE;
/*!40000 ALTER TABLE `password_reset_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_reset_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(100) NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `permissions_code_key` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permissions`
--

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` VALUES (1,'dashboard.view','Melihat ringkasan',NULL,'2026-11-02 04:30:49.173'),(2,'risk.view.all','Melihat seluruh risiko',NULL,'2026-11-02 04:30:49.184'),(3,'risk.view.unit','Melihat risiko unit sendiri',NULL,'2026-11-02 04:30:49.223'),(4,'risk.create','Mendaftarkan risiko',NULL,'2026-11-02 04:30:49.231'),(5,'risk.edit','Mengubah risiko dan penilaian',NULL,'2026-11-02 04:30:49.236'),(6,'risk.submit','Mengajukan risiko',NULL,'2026-11-02 04:30:49.241'),(7,'risk.approve','Menyetujui atau menolak risiko',NULL,'2026-11-02 04:30:49.246'),(8,'risk.close','Menutup risiko',NULL,'2026-11-02 04:30:49.284'),(9,'mitigation.view','Melihat rencana mitigasi',NULL,'2026-11-02 04:30:49.291'),(10,'mitigation.manage','Mengelola rencana mitigasi',NULL,'2026-11-02 04:30:49.297'),(11,'report.view','Melihat laporan',NULL,'2026-11-02 04:30:49.302'),(12,'settings.manage','Mengelola pengaturan',NULL,'2026-11-02 04:30:49.337'),(13,'user.manage','Mengelola pengguna',NULL,'2026-11-02 04:30:49.342'),(14,'audit.view','Melihat jejak audit',NULL,'2026-11-02 04:30:49.346');
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `review_comments`
--

DROP TABLE IF EXISTS `review_comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `review_comments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `riskId` int(11) NOT NULL,
  `assessmentId` int(11) DEFAULT NULL,
  `authorId` int(11) NOT NULL,
  `body` text NOT NULL,
  `visibility` enum('INTERNAL','OWNER') NOT NULL DEFAULT 'OWNER',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `review_comments_riskId_idx` (`riskId`),
  KEY `review_comments_assessmentId_fkey` (`assessmentId`),
  KEY `review_comments_authorId_fkey` (`authorId`),
  CONSTRAINT `review_comments_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `risk_assessments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `review_comments_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `review_comments_riskId_fkey` FOREIGN KEY (`riskId`) REFERENCES `risks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `review_comments`
--

LOCK TABLES `review_comments` WRITE;
/*!40000 ALTER TABLE `review_comments` DISABLE KEYS */;
INSERT INTO `review_comments` VALUES (1,1,NULL,2,'Mohon pastikan bukti kontrak pemasok terbaru diunggah sebelum tinjauan kuartal berikutnya.','OWNER','2026-09-25 04:30:48.802','2026-11-02 04:30:50.930'),(2,1,NULL,3,'Kontrak baru sedang direview legal. Estimasi finalisasi minggu depan.','OWNER','2026-09-28 04:30:48.802','2026-11-02 04:30:50.930');
/*!40000 ALTER TABLE `review_comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `risk_assessment_history`
--

DROP TABLE IF EXISTS `risk_assessment_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `risk_assessment_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `riskId` int(11) NOT NULL,
  `assessmentId` int(11) DEFAULT NULL,
  `previousLikelihood` int(11) DEFAULT NULL,
  `previousImpact` int(11) DEFAULT NULL,
  `previousScore` int(11) DEFAULT NULL,
  `newLikelihood` int(11) NOT NULL,
  `newImpact` int(11) NOT NULL,
  `newScore` int(11) NOT NULL,
  `changeReason` text DEFAULT NULL,
  `changedById` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `risk_assessment_history_riskId_idx` (`riskId`),
  KEY `risk_assessment_history_assessmentId_fkey` (`assessmentId`),
  KEY `risk_assessment_history_changedById_fkey` (`changedById`),
  CONSTRAINT `risk_assessment_history_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `risk_assessments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `risk_assessment_history_changedById_fkey` FOREIGN KEY (`changedById`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `risk_assessment_history_riskId_fkey` FOREIGN KEY (`riskId`) REFERENCES `risks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `risk_assessment_history`
--

LOCK TABLES `risk_assessment_history` WRITE;
/*!40000 ALTER TABLE `risk_assessment_history` DISABLE KEYS */;
INSERT INTO `risk_assessment_history` VALUES (1,1,NULL,NULL,NULL,NULL,3,3,9,'Registrasi awal risiko.',2,'2026-09-03 04:30:48.802'),(2,1,NULL,3,3,9,2,3,6,'Evaluasi efektivitas kontrak pemasok dan pengendalian anggaran.',2,'2026-09-28 04:30:48.802'),(3,2,NULL,NULL,NULL,NULL,4,4,16,'Registrasi risiko baru.',2,'2026-09-18 04:30:48.802'),(4,2,NULL,4,4,16,3,3,9,'Pembaruan penilaian residual.',2,'2026-10-13 04:30:48.802'),(5,3,NULL,NULL,NULL,NULL,3,4,12,'Registrasi risiko baru.',2,'2026-09-18 04:30:48.802'),(6,3,NULL,3,4,12,2,3,6,'Pembaruan penilaian residual.',2,'2026-10-13 04:30:48.802'),(7,4,NULL,NULL,NULL,NULL,2,4,8,'Registrasi risiko baru.',2,'2026-09-18 04:30:48.802'),(8,4,NULL,2,4,8,2,3,6,'Pembaruan penilaian residual.',2,'2026-10-13 04:30:48.802'),(9,5,NULL,NULL,NULL,NULL,4,3,12,'Registrasi risiko baru.',2,'2026-09-18 04:30:48.802'),(10,5,NULL,4,3,12,3,2,6,'Pembaruan penilaian residual.',2,'2026-10-13 04:30:48.802'),(11,6,NULL,NULL,NULL,NULL,3,3,9,'Registrasi risiko baru.',2,'2026-09-18 04:30:48.802'),(12,6,NULL,3,3,9,2,3,6,'Pembaruan penilaian residual.',2,'2026-10-13 04:30:48.802'),(13,7,NULL,NULL,NULL,NULL,3,5,15,'Registrasi risiko baru.',2,'2026-09-18 04:30:48.802'),(14,7,NULL,3,5,15,2,4,8,'Pembaruan penilaian residual.',2,'2026-10-13 04:30:48.802'),(15,8,NULL,NULL,NULL,NULL,2,4,8,'Registrasi risiko baru.',2,'2026-09-18 04:30:48.802'),(16,8,NULL,2,4,8,1,4,4,'Pembaruan penilaian residual.',2,'2026-10-13 04:30:48.802'),(17,9,NULL,NULL,NULL,NULL,3,3,9,'Registrasi risiko baru.',2,'2026-09-18 04:30:48.802'),(18,9,NULL,3,3,9,2,3,6,'Pembaruan penilaian residual.',2,'2026-10-13 04:30:48.802');
/*!40000 ALTER TABLE `risk_assessment_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `risk_assessments`
--

DROP TABLE IF EXISTS `risk_assessments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `risk_assessments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `riskId` int(11) NOT NULL,
  `type` enum('INHERENT','RESIDUAL') NOT NULL,
  `likelihood` int(11) NOT NULL,
  `impact` int(11) NOT NULL,
  `score` int(11) NOT NULL,
  `levelId` int(11) NOT NULL,
  `rationale` text DEFAULT NULL,
  `assessedById` int(11) NOT NULL,
  `assessedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `risk_assessments_riskId_type_idx` (`riskId`,`type`),
  KEY `risk_assessments_levelId_fkey` (`levelId`),
  KEY `risk_assessments_assessedById_fkey` (`assessedById`),
  CONSTRAINT `risk_assessments_assessedById_fkey` FOREIGN KEY (`assessedById`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `risk_assessments_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `risk_levels` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `risk_assessments_riskId_fkey` FOREIGN KEY (`riskId`) REFERENCES `risks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `risk_assessments`
--

LOCK TABLES `risk_assessments` WRITE;
/*!40000 ALTER TABLE `risk_assessments` DISABLE KEYS */;
INSERT INTO `risk_assessments` VALUES (1,1,'INHERENT',3,3,9,2,'Tiga kali dalam dua kuartal terakhir terjadi kenaikan biaya input di atas rencana anggaran. Dampak moderat terhadap margin unit.',2,'2026-09-03 04:30:48.802','2026-11-02 04:30:50.930','2026-11-02 04:30:50.930'),(2,1,'RESIDUAL',2,3,6,2,'Kontrak harga dengan tiga pemasok utama dan pengawasan anggaran bulanan menurunkan probabilitas kenaikan biaya yang tidak terkendali.',2,'2026-09-28 04:30:48.802','2026-11-02 04:30:50.930','2026-11-02 04:30:50.930'),(3,2,'INHERENT',4,4,16,3,'Penilaian awal berdasarkan data operasional terkini.',2,'2026-09-18 04:30:48.802','2026-11-02 04:30:51.040','2026-11-02 04:30:51.040'),(4,2,'RESIDUAL',3,3,9,2,'Penilaian residual setelah mempertimbangkan pengendalian yang telah berjalan.',2,'2026-10-13 04:30:48.802','2026-11-02 04:30:51.040','2026-11-02 04:30:51.040'),(5,3,'INHERENT',3,4,12,3,'Penilaian awal berdasarkan data operasional terkini.',2,'2026-09-18 04:30:48.802','2026-11-02 04:30:51.118','2026-11-02 04:30:51.118'),(6,3,'RESIDUAL',2,3,6,2,'Penilaian residual setelah mempertimbangkan pengendalian yang telah berjalan.',2,'2026-10-13 04:30:48.802','2026-11-02 04:30:51.118','2026-11-02 04:30:51.118'),(7,4,'INHERENT',2,4,8,2,'Penilaian awal berdasarkan data operasional terkini.',2,'2026-09-18 04:30:48.802','2026-11-02 04:30:51.129','2026-11-02 04:30:51.129'),(8,4,'RESIDUAL',2,3,6,2,'Penilaian residual setelah mempertimbangkan pengendalian yang telah berjalan.',2,'2026-10-13 04:30:48.802','2026-11-02 04:30:51.129','2026-11-02 04:30:51.129'),(9,5,'INHERENT',4,3,12,3,'Penilaian awal berdasarkan data operasional terkini.',2,'2026-09-18 04:30:48.802','2026-11-02 04:30:51.140','2026-11-02 04:30:51.140'),(10,5,'RESIDUAL',3,2,6,2,'Penilaian residual setelah mempertimbangkan pengendalian yang telah berjalan.',2,'2026-10-13 04:30:48.802','2026-11-02 04:30:51.140','2026-11-02 04:30:51.140'),(11,6,'INHERENT',3,3,9,2,'Penilaian awal berdasarkan data operasional terkini.',2,'2026-09-18 04:30:48.802','2026-11-02 04:30:51.182','2026-11-02 04:30:51.182'),(12,6,'RESIDUAL',2,3,6,2,'Penilaian residual setelah mempertimbangkan pengendalian yang telah berjalan.',2,'2026-10-13 04:30:48.802','2026-11-02 04:30:51.182','2026-11-02 04:30:51.182'),(13,7,'INHERENT',3,5,15,3,'Penilaian awal berdasarkan data operasional terkini.',2,'2026-09-18 04:30:48.802','2026-11-02 04:30:51.218','2026-11-02 04:30:51.218'),(14,7,'RESIDUAL',2,4,8,2,'Penilaian residual setelah mempertimbangkan pengendalian yang telah berjalan.',2,'2026-10-13 04:30:48.802','2026-11-02 04:30:51.218','2026-11-02 04:30:51.218'),(15,8,'INHERENT',2,4,8,2,'Penilaian awal berdasarkan data operasional terkini.',2,'2026-09-18 04:30:48.802','2026-11-02 04:30:51.229','2026-11-02 04:30:51.229'),(16,8,'RESIDUAL',1,4,4,1,'Penilaian residual setelah mempertimbangkan pengendalian yang telah berjalan.',2,'2026-10-13 04:30:48.802','2026-11-02 04:30:51.229','2026-11-02 04:30:51.229'),(17,9,'INHERENT',3,3,9,2,'Penilaian awal berdasarkan data operasional terkini.',2,'2026-09-18 04:30:48.802','2026-11-02 04:30:51.239','2026-11-02 04:30:51.239'),(18,9,'RESIDUAL',2,3,6,2,'Penilaian residual setelah mempertimbangkan pengendalian yang telah berjalan.',2,'2026-10-13 04:30:48.802','2026-11-02 04:30:51.239','2026-11-02 04:30:51.239');
/*!40000 ALTER TABLE `risk_assessments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `risk_categories`
--

DROP TABLE IF EXISTS `risk_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `risk_categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(30) NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `color` varchar(20) NOT NULL DEFAULT '#64748b',
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `sortOrder` int(11) NOT NULL DEFAULT 0,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `risk_categories_code_key` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `risk_categories`
--

LOCK TABLES `risk_categories` WRITE;
/*!40000 ALTER TABLE `risk_categories` DISABLE KEYS */;
INSERT INTO `risk_categories` VALUES (1,'OPS','Operasional','Kategori risiko Operasional.','#2b5a4c',1,1,'2026-11-02 04:30:49.536','2026-11-02 04:30:49.536'),(2,'FIN','Keuangan','Kategori risiko Keuangan.','#b5924b',1,2,'2026-11-02 04:30:49.541','2026-11-02 04:30:49.541'),(3,'STR','Strategis','Kategori risiko Strategis.','#6b5b8c',1,3,'2026-11-02 04:30:49.574','2026-11-02 04:30:49.574'),(4,'COM','Komersial & Reputasi','Kategori risiko Komersial & Reputasi.','#b3542f',1,4,'2026-11-02 04:30:49.579','2026-11-02 04:30:49.579'),(5,'HR','Sumber Daya Manusia','Kategori risiko Sumber Daya Manusia.','#4f7c8a',1,5,'2026-11-02 04:30:49.584','2026-11-02 04:30:49.584'),(6,'IT','Teknologi Informasi','Kategori risiko Teknologi Informasi.','#4a6274',1,6,'2026-11-02 04:30:49.589','2026-11-02 04:30:49.589');
/*!40000 ALTER TABLE `risk_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `risk_levels`
--

DROP TABLE IF EXISTS `risk_levels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `risk_levels` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(30) NOT NULL,
  `name` varchar(80) NOT NULL,
  `minScore` int(11) NOT NULL,
  `maxScore` int(11) NOT NULL,
  `color` varchar(20) NOT NULL DEFAULT '#64748b',
  `description` text DEFAULT NULL,
  `sortOrder` int(11) NOT NULL DEFAULT 0,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `risk_levels_code_key` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `risk_levels`
--

LOCK TABLES `risk_levels` WRITE;
/*!40000 ALTER TABLE `risk_levels` DISABLE KEYS */;
INSERT INTO `risk_levels` VALUES (1,'RENDAH','Rendah',1,4,'#3e7351','Rentang skor 1 sampai 4.',1,'2026-11-02 04:30:49.624','2026-11-02 04:30:49.624'),(2,'SEDANG','Sedang',5,9,'#a2761f','Rentang skor 5 sampai 9.',2,'2026-11-02 04:30:49.631','2026-11-02 04:30:49.631'),(3,'TINGGI','Tinggi',10,16,'#b05a2a','Rentang skor 10 sampai 16.',3,'2026-11-02 04:30:49.636','2026-11-02 04:30:49.636'),(4,'SANGAT_TINGGI','Sangat Tinggi',17,25,'#91352f','Rentang skor 17 sampai 25.',4,'2026-11-02 04:30:49.641','2026-11-02 04:30:49.641');
/*!40000 ALTER TABLE `risk_levels` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `risk_settings`
--

DROP TABLE IF EXISTS `risk_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `risk_settings` (
  `id` int(11) NOT NULL DEFAULT 1,
  `organizationName` varchar(200) NOT NULL DEFAULT 'JXB Hospitality Group',
  `appetiteThreshold` int(11) NOT NULL DEFAULT 12,
  `reviewIntervalDays` int(11) NOT NULL DEFAULT 90,
  `defaultCurrency` varchar(10) NOT NULL DEFAULT 'IDR',
  `highRiskEscalationEmail` varchar(191) DEFAULT NULL,
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `risk_settings`
--

LOCK TABLES `risk_settings` WRITE;
/*!40000 ALTER TABLE `risk_settings` DISABLE KEYS */;
INSERT INTO `risk_settings` VALUES (1,'JXB Hospitality Group',12,90,'IDR','risk@jxb.co.id','2026-11-02 04:30:49.680');
/*!40000 ALTER TABLE `risk_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `risks`
--

DROP TABLE IF EXISTS `risks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `risks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `riskCode` varchar(40) NOT NULL,
  `title` varchar(200) NOT NULL,
  `description` text NOT NULL,
  `categoryId` int(11) NOT NULL,
  `unitId` int(11) NOT NULL,
  `ownerId` int(11) NOT NULL,
  `createdById` int(11) NOT NULL,
  `status` enum('DRAFT','SUBMITTED','IN_REVIEW','APPROVED','REJECTED','MONITORING','CLOSED') NOT NULL DEFAULT 'DRAFT',
  `inherentLikelihood` int(11) NOT NULL,
  `inherentImpact` int(11) NOT NULL,
  `inherentScore` int(11) NOT NULL,
  `inherentLevelId` int(11) NOT NULL,
  `residualLikelihood` int(11) DEFAULT NULL,
  `residualImpact` int(11) DEFAULT NULL,
  `residualScore` int(11) DEFAULT NULL,
  `residualLevelId` int(11) DEFAULT NULL,
  `targetScore` int(11) DEFAULT NULL,
  `treatmentType` enum('MITIGATE','AVOID','TRANSFER','ACCEPT') NOT NULL DEFAULT 'MITIGATE',
  `reviewDate` datetime(3) DEFAULT NULL,
  `lastReviewedAt` datetime(3) DEFAULT NULL,
  `closedAt` datetime(3) DEFAULT NULL,
  `closureNotes` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `risks_riskCode_key` (`riskCode`),
  KEY `risks_categoryId_idx` (`categoryId`),
  KEY `risks_unitId_idx` (`unitId`),
  KEY `risks_ownerId_idx` (`ownerId`),
  KEY `risks_status_idx` (`status`),
  KEY `risks_reviewDate_idx` (`reviewDate`),
  KEY `risks_createdById_fkey` (`createdById`),
  KEY `risks_inherentLevelId_fkey` (`inherentLevelId`),
  KEY `risks_residualLevelId_fkey` (`residualLevelId`),
  CONSTRAINT `risks_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `risk_categories` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `risks_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `risks_inherentLevelId_fkey` FOREIGN KEY (`inherentLevelId`) REFERENCES `risk_levels` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `risks_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `risks_residualLevelId_fkey` FOREIGN KEY (`residualLevelId`) REFERENCES `risk_levels` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `risks_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `organizational_units` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `risks`
--

LOCK TABLES `risks` WRITE;
/*!40000 ALTER TABLE `risks` DISABLE KEYS */;
INSERT INTO `risks` VALUES (1,'RK-OPS-001','Biaya Operasional Meningkat','Kenaikan harga bahan baku, energi, dan upah tidak diimbangi penyesuaian harga jual sehingga margin operasional hotel tertekan. Risiko ini berdampak langsung pada profitabilitas unit operasional.',1,2,3,2,'MONITORING',3,3,9,2,2,3,6,2,4,'MITIGATE','2026-11-22 04:30:48.802','2026-09-28 04:30:48.802',NULL,NULL,'2026-09-03 04:30:48.802','2026-11-02 04:30:50.930'),(2,'RK-OPS-002','Gangguan Pasokan Bahan Baku Utama','Ketergantungan pada satu pemasok bahan baku utama berisiko menghentikan operasional dapur apabila terjadi gangguan pengiriman atau kenaikan harga mendadak.',1,2,3,2,'APPROVED',4,4,16,3,3,3,9,2,NULL,'MITIGATE','2026-12-27 04:30:48.802',NULL,NULL,NULL,'2026-09-18 04:30:48.802','2026-11-02 04:30:51.040'),(3,'RK-FIN-001','Fluktuasi Nilai Tukar Memengaruhi Biaya Impor','Pergerakan nilai tukar rupiah terhadap dolar memengaruhi biaya pembelian peralatan dan bahan baku impor sehingga menekan anggaran belanja modal.',2,3,3,2,'MONITORING',3,4,12,3,2,3,6,2,NULL,'TRANSFER','2026-12-02 04:30:48.802',NULL,NULL,NULL,'2026-09-18 04:30:48.802','2026-11-02 04:30:51.118'),(4,'RK-STR-001','Ketergantungan pada Satu Segmen Pasar','Pendapatan saat ini terkonsentrasi pada segmen korporat. Perlambatan perjalanan bisnis dapat menurunkan okupansi secara signifikan.',3,4,3,2,'DRAFT',2,4,8,2,2,3,6,2,NULL,'MITIGATE','2027-01-31 04:30:48.802',NULL,NULL,NULL,'2026-09-18 04:30:48.802','2026-11-02 04:30:51.129'),(5,'RK-COM-001','Penurunan Okupansi akibat Reputasi Digital','Ulasan negatif yang menyebar cepat di platform perjalanan dapat menurunkan kepercayaan tamu dan tingkat okupansi dalam waktu singkat.',4,4,3,2,'SUBMITTED',4,3,12,3,3,2,6,2,NULL,'MITIGATE','2026-12-17 04:30:48.802',NULL,NULL,NULL,'2026-09-18 04:30:48.802','2026-11-02 04:30:51.140'),(6,'RK-HR-001','Kehilangan Talenta Kunci di Posisi Operasional','Ketergantungan pada sejumlah kecil supervisor berpengalaman menimbulkan risiko kesinambungan operasional ketika terjadi pengunduran diri.',5,5,3,2,'APPROVED',3,3,9,2,2,3,6,2,NULL,'MITIGATE','2027-01-11 04:30:48.802',NULL,NULL,NULL,'2026-09-18 04:30:48.802','2026-11-02 04:30:51.182'),(7,'RK-IT-001','Gangguan Sistem Reservasi akibat Serangan Siber','Serangan siber atau kegagalan sistem reservasi dapat menghentikan penerimaan pesanan dan mengekspos data pelanggan.',6,1,3,2,'MONITORING',3,5,15,3,2,4,8,2,NULL,'MITIGATE','2026-11-17 04:30:48.802',NULL,NULL,NULL,'2026-09-18 04:30:48.802','2026-11-02 04:30:51.218'),(8,'RK-OPS-003','Kecelakaan Kerja di Area Operasional','Aktivitas dapur dan teknis memiliki paparan kecelakaan kerja yang dapat menimbulkan cedera, klaim, dan gangguan operasional.',1,2,3,2,'CLOSED',2,4,8,2,1,4,4,1,NULL,'MITIGATE','2026-10-13 04:30:48.802',NULL,'2026-10-28 04:30:48.802',NULL,'2026-09-18 04:30:48.802','2026-11-02 04:30:51.229'),(9,'RK-COM-002','Kenaikan Biaya Akuisisi Pelanggan','Biaya iklan digital meningkat sementara konversi menurun sehingga biaya akuisisi pelanggan baru menekan profitabilitas pemasaran.',4,4,3,2,'IN_REVIEW',3,3,9,2,2,3,6,2,NULL,'MITIGATE','2027-01-01 04:30:48.802',NULL,NULL,NULL,'2026-09-18 04:30:48.802','2026-11-02 04:30:51.239');
/*!40000 ALTER TABLE `risks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_permissions`
--

DROP TABLE IF EXISTS `role_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permissions` (
  `roleId` int(11) NOT NULL,
  `permissionId` int(11) NOT NULL,
  PRIMARY KEY (`roleId`,`permissionId`),
  KEY `role_permissions_permissionId_fkey` (`permissionId`),
  CONSTRAINT `role_permissions_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permissions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `role_permissions_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_permissions`
--

LOCK TABLES `role_permissions` WRITE;
/*!40000 ALTER TABLE `role_permissions` DISABLE KEYS */;
INSERT INTO `role_permissions` VALUES (1,1),(1,2),(1,3),(1,4),(1,5),(1,6),(1,7),(1,8),(1,9),(1,10),(1,11),(1,12),(1,13),(1,14),(2,1),(2,2),(2,4),(2,5),(2,6),(2,7),(2,8),(2,9),(2,10),(2,11),(2,14),(3,1),(3,3),(3,4),(3,5),(3,6),(3,9),(3,10),(3,11);
/*!40000 ALTER TABLE `role_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `isSystem` tinyint(1) NOT NULL DEFAULT 0,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roles_code_key` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'MR','Manajemen Risiko','Pemilik kebijakan dan persetujuan akhir risiko.',1,'2026-11-02 04:30:49.352','2026-11-02 04:30:49.352'),(2,'RISK_OFFICER','Risk Officer','Peninjau register, alur kerja, dan mitigasi.',1,'2026-11-02 04:30:49.398','2026-11-02 04:30:49.398'),(3,'RISK_OWNER','Risk Owner','Pemilik risiko pada unit operasional.',1,'2026-11-02 04:30:49.440','2026-11-02 04:30:49.440');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tokenHash` varchar(191) NOT NULL,
  `userId` int(11) NOT NULL,
  `expiresAt` datetime(3) NOT NULL,
  `ipAddress` varchar(64) DEFAULT NULL,
  `userAgent` varchar(500) DEFAULT NULL,
  `lastSeenAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `sessions_tokenHash_key` (`tokenHash`),
  KEY `sessions_userId_idx` (`userId`),
  KEY `sessions_expiresAt_idx` (`expiresAt`),
  CONSTRAINT `sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
INSERT INTO `sessions` VALUES (1,'a25908e184c7b753eec86e4587ca568ad7312c78db0065d52a8f4eae6f07e64a',2,'2026-11-09 04:47:34.679','::ffff:192.168.10.167','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36','2026-11-02 04:47:34.690','2026-11-02 04:47:34.690'),(3,'166e53af2d4a4919247ae6e824ba374013307c787cfbbaea5be8cfd37a5176eb',1,'2026-11-09 07:50:24.112','::ffff:192.168.10.167','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36','2026-11-02 07:50:24.120','2026-11-02 07:50:24.120');
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_roles`
--

DROP TABLE IF EXISTS `user_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_roles` (
  `userId` int(11) NOT NULL,
  `roleId` int(11) NOT NULL,
  `assignedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`userId`,`roleId`),
  KEY `user_roles_roleId_fkey` (`roleId`),
  CONSTRAINT `user_roles_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_roles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_roles`
--

LOCK TABLES `user_roles` WRITE;
/*!40000 ALTER TABLE `user_roles` DISABLE KEYS */;
INSERT INTO `user_roles` VALUES (1,1,'2026-11-02 04:30:50.734'),(2,2,'2026-11-02 04:30:50.813'),(3,3,'2026-11-02 04:30:50.863');
/*!40000 ALTER TABLE `user_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_unit_assignments`
--

DROP TABLE IF EXISTS `user_unit_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_unit_assignments` (
  `userId` int(11) NOT NULL,
  `unitId` int(11) NOT NULL,
  `isPrimary` tinyint(1) NOT NULL DEFAULT 0,
  `assignedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`userId`,`unitId`),
  KEY `user_unit_assignments_unitId_fkey` (`unitId`),
  CONSTRAINT `user_unit_assignments_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `organizational_units` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_unit_assignments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_unit_assignments`
--

LOCK TABLES `user_unit_assignments` WRITE;
/*!40000 ALTER TABLE `user_unit_assignments` DISABLE KEYS */;
INSERT INTO `user_unit_assignments` VALUES (1,1,1,'2026-11-02 04:30:50.771'),(2,1,1,'2026-11-02 04:30:50.821'),(3,2,1,'2026-11-02 04:30:50.868');
/*!40000 ALTER TABLE `user_unit_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(191) NOT NULL,
  `username` varchar(80) NOT NULL,
  `name` varchar(150) NOT NULL,
  `passwordHash` varchar(255) NOT NULL,
  `status` enum('ACTIVE','INACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  `phone` varchar(40) DEFAULT NULL,
  `jobTitle` varchar(150) DEFAULT NULL,
  `lastLoginAt` datetime(3) DEFAULT NULL,
  `failedLoginAttempts` int(11) NOT NULL DEFAULT 0,
  `lockedUntil` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_key` (`email`),
  UNIQUE KEY `users_username_key` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin.mr@jxb.co.id','admin.mr','Ayu Prameswari','$2b$12$lGzsP0H7RzBCyfeXahXGu.0BA4V05dsvkZE9otaztQOVl8uwVMJfC','ACTIVE',NULL,'Head of Risk Management','2026-11-02 07:50:25.874',0,NULL,'2026-11-02 04:30:50.725','2026-11-02 07:50:25.878'),(2,'risk.officer@jxb.co.id','risk.officer','Bagas Nurwidya','$2b$12$k7H9PeNtzEcpf.a/CuhcKey6QsFWWJgUyjmrz4xzlIh7cmBSyQd/u','ACTIVE',NULL,'Risk Officer','2026-11-02 04:47:36.467',0,NULL,'2026-11-02 04:30:50.775','2026-11-02 04:47:36.475'),(3,'risk.owner@jxb.co.id','risk.owner','Citra Larasati','$2b$12$bBX7w2/EhCinFXtAZoHJA.akkHfAzv9k/8UGGxAp7hiSZA7IwaIWi','ACTIVE',NULL,'Hotel Operations Manager',NULL,0,NULL,'2026-11-02 04:30:50.856','2026-11-02 04:30:50.856');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `workflow_approvals`
--

DROP TABLE IF EXISTS `workflow_approvals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workflow_approvals` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `riskId` int(11) NOT NULL,
  `step` int(11) NOT NULL DEFAULT 1,
  `roleId` int(11) DEFAULT NULL,
  `approverId` int(11) DEFAULT NULL,
  `decision` enum('PENDING','APPROVED','REJECTED','REVISION_REQUESTED') NOT NULL DEFAULT 'PENDING',
  `note` text DEFAULT NULL,
  `dueDate` datetime(3) DEFAULT NULL,
  `decidedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `workflow_approvals_riskId_idx` (`riskId`),
  KEY `workflow_approvals_approverId_idx` (`approverId`),
  KEY `workflow_approvals_roleId_fkey` (`roleId`),
  CONSTRAINT `workflow_approvals_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `workflow_approvals_riskId_fkey` FOREIGN KEY (`riskId`) REFERENCES `risks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `workflow_approvals_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workflow_approvals`
--

LOCK TABLES `workflow_approvals` WRITE;
/*!40000 ALTER TABLE `workflow_approvals` DISABLE KEYS */;
INSERT INTO `workflow_approvals` VALUES (1,1,1,2,2,'APPROVED','Disetujui untuk masuk tahap pemantauan.','2026-09-13 04:30:48.802','2026-09-13 04:30:48.802','2026-09-08 04:30:48.802'),(2,5,1,2,NULL,'PENDING',NULL,'2026-11-07 04:30:48.802',NULL,'2026-10-03 04:30:48.802'),(3,9,1,2,NULL,'PENDING',NULL,'2026-11-07 04:30:48.802',NULL,'2026-10-03 04:30:48.802');
/*!40000 ALTER TABLE `workflow_approvals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `workflow_histories`
--

DROP TABLE IF EXISTS `workflow_histories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workflow_histories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `riskId` int(11) NOT NULL,
  `action` enum('SUBMIT','APPROVE','REJECT','REQUEST_REVISION','RESUBMIT','CLOSE') NOT NULL,
  `fromStatus` enum('DRAFT','SUBMITTED','IN_REVIEW','APPROVED','REJECTED','MONITORING','CLOSED') DEFAULT NULL,
  `toStatus` enum('DRAFT','SUBMITTED','IN_REVIEW','APPROVED','REJECTED','MONITORING','CLOSED') NOT NULL,
  `note` text DEFAULT NULL,
  `actorId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `workflow_histories_riskId_idx` (`riskId`),
  KEY `workflow_histories_actorId_fkey` (`actorId`),
  CONSTRAINT `workflow_histories_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `users` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `workflow_histories_riskId_fkey` FOREIGN KEY (`riskId`) REFERENCES `risks` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workflow_histories`
--

LOCK TABLES `workflow_histories` WRITE;
/*!40000 ALTER TABLE `workflow_histories` DISABLE KEYS */;
INSERT INTO `workflow_histories` VALUES (1,1,'SUBMIT','DRAFT','SUBMITTED','Risiko diajukan untuk tinjauan awal.',3,'2026-09-08 04:30:48.802'),(2,1,'APPROVE','SUBMITTED','APPROVED','Penilaian inheren dan rencana mitigasi dinilai memadai.',2,'2026-09-13 04:30:48.802'),(3,2,'SUBMIT','DRAFT','SUBMITTED','Pengajuan untuk tinjauan.',3,'2026-10-03 04:30:48.802'),(4,2,'APPROVE','SUBMITTED','APPROVED','Disetujui untuk ditindaklanjuti.',2,'2026-10-05 04:30:48.802'),(5,3,'SUBMIT','DRAFT','SUBMITTED','Pengajuan untuk tinjauan.',3,'2026-10-03 04:30:48.802'),(6,3,'APPROVE','SUBMITTED','APPROVED','Disetujui untuk ditindaklanjuti.',2,'2026-10-05 04:30:48.802'),(7,5,'SUBMIT','DRAFT','SUBMITTED','Pengajuan untuk tinjauan.',3,'2026-10-03 04:30:48.802'),(8,6,'SUBMIT','DRAFT','SUBMITTED','Pengajuan untuk tinjauan.',3,'2026-10-03 04:30:48.802'),(9,6,'APPROVE','SUBMITTED','APPROVED','Disetujui untuk ditindaklanjuti.',2,'2026-10-05 04:30:48.802'),(10,7,'SUBMIT','DRAFT','SUBMITTED','Pengajuan untuk tinjauan.',3,'2026-10-03 04:30:48.802'),(11,7,'APPROVE','SUBMITTED','APPROVED','Disetujui untuk ditindaklanjuti.',2,'2026-10-05 04:30:48.802'),(12,8,'SUBMIT','DRAFT','SUBMITTED','Pengajuan untuk tinjauan.',3,'2026-10-03 04:30:48.802'),(13,8,'APPROVE','SUBMITTED','APPROVED','Disetujui untuk ditindaklanjuti.',2,'2026-10-05 04:30:48.802'),(14,9,'SUBMIT','DRAFT','SUBMITTED','Pengajuan untuk tinjauan.',3,'2026-10-03 04:30:48.802');
/*!40000 ALTER TABLE `workflow_histories` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-12 11:31:56
