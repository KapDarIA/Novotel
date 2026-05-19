-- Выполните в MySQL Workbench или командной строке mysql
CREATE DATABASE IF NOT EXISTS novotel_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE novotel_db;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  login VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') NOT NULL DEFAULT 'user'
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rooms (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  image_url VARCHAR(500) NULL,
  description TEXT NULL,
  INDEX idx_rooms_type (type),
  INDEX idx_rooms_price (price)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bookings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  room_id INT UNSIGNED NOT NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_booking_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  CONSTRAINT chk_dates CHECK (check_out > check_in),
  INDEX idx_bookings_room_dates (room_id, check_in, check_out)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS services (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  description TEXT NULL,
  image_url VARCHAR(500) NULL,
  INDEX idx_services_category (category)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS service_bookings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  booking_id INT UNSIGNED NOT NULL,
  service_id INT UNSIGNED NOT NULL,
  service_date DATE NOT NULL,
  service_time TIME NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sb_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_sb_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_sb_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  INDEX idx_sb_booking (booking_id, service_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS hotel_reviews (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL UNIQUE,
  rating TINYINT UNSIGNED NOT NULL,
  comment TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_review_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_rating CHECK (rating >= 1 AND rating <= 5),
  INDEX idx_reviews_rating (rating),
  INDEX idx_reviews_created (created_at)
) ENGINE=InnoDB;
