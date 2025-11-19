# VPS Setup Guide for infi-tools.com

**VPS IP:** 110.4.47.197  
**Domain:** infi-tools.com  
**OS:** Ubuntu 24.04.3 LTS (Noble)

This guide will help you deploy the Direct Sales Tree Visualization application on your VPS.

---

## Table of Contents

1. [Initial Server Setup](#1-initial-server-setup)
2. [Install Required Software](#2-install-required-software)
3. [Configure MySQL Database](#3-configure-mysql-database)
4. [Install phpMyAdmin (Optional)](#4-install-phpmyadmin-optional)
5. [Deploy Application](#5-deploy-application)
6. [Build and Configure Application](#6-build-and-configure-application)
7. [Setup Process Manager (PM2)](#7-setup-process-manager-pm2)
8. [Configure Nginx Reverse Proxy](#8-configure-nginx-reverse-proxy)
9. [Setup SSL Certificate](#9-setup-ssl-certificate)
10. [Configure Domain DNS](#10-configure-domain-dns)
11. [Testing and Verification](#11-testing-and-verification)
12. [Maintenance Commands](#12-maintenance-commands)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Initial Server Setup

### 1.1 Connect to Your VPS

```bash
ssh root@110.4.47.197
# or if you have a non-root user:
ssh your_username@110.4.47.197
```

### 1.2 Update System Packages

```bash
sudo apt update
sudo apt upgrade -y
```

### 1.3 Create Non-Root User (if not exists)

```bash
# Create a new user (skip if you already have one)
adduser deploy
usermod -aG sudo deploy

# Switch to the new user
su - deploy
```

### 1.4 Setup Firewall

```bash
# Install UFW if not already installed
sudo apt install ufw -y

# Allow SSH (important - do this first!)
sudo ufw allow OpenSSH

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## 2. Install Required Software

### 2.1 Install Node.js 20.x (LTS)

```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x
```

### 2.2 Install MySQL 8.0

```bash
# Install MySQL
sudo apt install mysql-server -y

# Secure MySQL installation
sudo mysql_secure_installation

# During setup, you'll be asked:
# - Set root password? (Yes, set a strong password)
# - Remove anonymous users? (Yes)
# - Disallow root login remotely? (Yes)
# - Remove test database? (Yes)
# - Reload privilege tables? (Yes)
```

### 2.3 Install Nginx

```bash
sudo apt install nginx -y

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
```

### 2.4 Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

### 2.5 Install Git (if not already installed)

```bash
sudo apt install git -y
```

---

## 3. Configure MySQL Database

### 3.1 Create Database and User

```bash
# Login to MySQL
sudo mysql -u root -p

# In MySQL prompt, run:
```

```sql
-- Create database
CREATE DATABASE direct_sales_tree CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create application user (replace 'your_strong_password' with a secure password)
CREATE USER 'tree_app'@'localhost' IDENTIFIED BY '920214@Ang';

-- Grant privileges
GRANT ALL PRIVILEGES ON direct_sales_tree.* TO 'tree_app'@'localhost';

-- Flush privileges
FLUSH PRIVILEGES;

-- Exit MySQL
EXIT;
```

### 3.2 Test Database Connection

```bash
# Test connection with new user
mysql -u tree_app -p direct_sales_tree
# Enter password when prompted
# Type EXIT to leave
```

---

## 4. Install phpMyAdmin (Optional)

phpMyAdmin is a web-based tool for managing MySQL databases. This section will guide you through installing and securing it.

### 4.1 Install PHP and Required Extensions

phpMyAdmin requires PHP. Install PHP and necessary extensions:

```bash
# Update package list
sudo apt update

# Install PHP and required extensions
sudo apt install php-fpm php-mysql php-mbstring php-xml php-curl php-zip php-gd -y

# Verify PHP installation
php -v
```

### 4.2 Install phpMyAdmin

```bash
# Install phpMyAdmin
sudo apt install phpmyadmin
```

**Note:** Don't use `-y` flag so you can interact with the installation prompts.

During installation, you'll be prompted with several configuration screens:

#### Prompt 1: Web Server Selection

```
┌─────────────────────────────────────┐
│ Configuring phpmyadmin              │
├─────────────────────────────────────┘
│                                     │
│ Please choose the web server that   │
│ should be automatically configured  │
│ to run phpMyAdmin.                  │
│                                     │
│ Web server to reconfigure           │
│ automatically:                      │
│                                     │
│    [ ] apache2                      │
│    [*] nginx                        │
│                                     │
│            <Ok>                     │
└─────────────────────────────────────┘
```

**What to do:**
- Use **Arrow keys** to navigate
- Press **Space** to select/deselect
- **Select `nginx`** (if available) or leave it unselected
- Press **Tab** to move to `<Ok>`, then press **Enter**

**Note:** If nginx is not listed or you can't select it, that's fine. Just press Enter to continue. We'll configure Nginx manually in the next step.

#### Prompt 2: Configure Database with dbconfig-common

```
┌─────────────────────────────────────┐
│ Configuring phpmyadmin              │
├─────────────────────────────────────┘
│                                     │
│ The phpMyAdmin application needs a  │
│ database to store its configuration  │
│ data.                               │
│                                     │
│ Configure database for phpmyadmin   │
│ with dbconfig-common?               │
│                                     │
│            <Yes>      <No>          │
└─────────────────────────────────────┘
```

**What to choose: `Yes` (Recommended)**

**Why choose Yes:**
- ✅ Creates a dedicated database (`phpmyadmin`) for phpMyAdmin's internal configuration
- ✅ Creates a MySQL user (`phpmyadmin`) specifically for phpMyAdmin
- ✅ Automatically sets up the database schema and tables
- ✅ Stores phpMyAdmin settings, bookmarks, and user preferences
- ✅ Makes future phpMyAdmin updates easier
- ✅ Better security isolation (separate user for phpMyAdmin)

**Why you might choose No:**
- ❌ You want to manually configure the database later
- ❌ You prefer to use an existing database
- ❌ You want more control over the database setup

**Recommendation:** Choose **`Yes`** for easier setup and better security.

#### Prompt 3: MySQL Application Password

If you chose "Yes" in the previous step, you'll be asked for a password:

```
┌─────────────────────────────────────┐
│ Configuring phpmyadmin              │
├─────────────────────────────────────┘
│                                     │
│ Please provide a password for       │
│ phpmyadmin to register with         │
│ the database server. If left blank, │
│ a random password will be generated.│
│                                     │
│ MySQL application password for       │
│ phpmyadmin:                         │
│                                     │
│ [_____________________________]     │
│                                     │
│            <Ok>                     │
└─────────────────────────────────────┘
```

**What to do:**
- **Option 1 (Recommended):** Enter a **strong password** (save it securely!)
  - This password is for the `phpmyadmin` MySQL user
  - You'll need this if you want to access phpMyAdmin's internal database
  - **Save this password** - you might need it for troubleshooting

- **Option 2:** Leave it blank and let the system generate a random password
  - The password will be stored in `/etc/phpmyadmin/config-db.php`
  - You can retrieve it later if needed

**Password Requirements:**

**⚠️ IMPORTANT:** MySQL 8.0 has strict password validation policies. Your password must meet these requirements:

- **Minimum length:** 8 characters (MEDIUM policy) or 20 characters (STRONG policy)
- **Must contain:** 
  - At least 1 uppercase letter (A-Z)
  - At least 1 lowercase letter (a-z)
  - At least 1 number (0-9)
  - At least 1 special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
- **Cannot contain:** Common dictionary words or your username

**Good password examples:**
- `MyPhpMyAdmin2025!Secure` ✅ (meets all requirements)
- `P@ssw0rd123!Admin` ✅
- `Secure#2025$PhpMyAdmin` ✅

**Bad password examples:**
- `password123` ❌ (no uppercase, no special char)
- `PASSWORD123` ❌ (no lowercase, no special char)
- `Password` ❌ (too short, no number, no special char)
- `MyPassword123` ❌ (no special character)

**Check your MySQL password policy:**
```bash
sudo mysql -u root -p -e "SHOW VARIABLES LIKE 'validate_password%';"
```

**Important:** This password is **NOT** the same as:
- Your MySQL root password
- Your application database user password (`tree_app`)
- The password you'll use to login to phpMyAdmin web interface

#### Prompt 4: Confirm Password (if you entered one)

If you entered a password, you'll be asked to confirm it:

```
┌─────────────────────────────────────┐
│ Configuring phpmyadmin              │
├─────────────────────────────────────┘
│                                     │
│ Re-enter password to verify:       │
│                                     │
│ [_____________________________]     │
│                                     │
│            <Ok>                     │
└─────────────────────────────────────┘
```

**What to do:**
- Enter the **same password** you entered in the previous step
- Press **Enter** to continue

#### What Happens After Installation

After you complete the prompts, the installer will:

1. Create a MySQL database named `phpmyadmin`
2. Create a MySQL user named `phpmyadmin` (if you chose "Yes")
3. Import the phpMyAdmin schema into the database
4. Store configuration in `/etc/phpmyadmin/config-db.php`
5. Set up phpMyAdmin files in `/usr/share/phpmyadmin/`

#### Verify Installation

After installation completes, verify everything is set up correctly:

```bash
# Check if phpMyAdmin database was created
sudo mysql -u root -p -e "SHOW DATABASES;" | grep phpmyadmin

# Check if phpMyAdmin user was created (if you chose "Yes")
sudo mysql -u root -p -e "SELECT User, Host FROM mysql.user WHERE User='phpmyadmin';"

# Check phpMyAdmin files
ls -la /usr/share/phpmyadmin/

# Check configuration file
sudo cat /etc/phpmyadmin/config-db.php
```

#### If You Chose "No" - Manual Database Setup

If you chose "No" and want to set up the database manually later:

```bash
# Login to MySQL
sudo mysql -u root -p

# In MySQL prompt:
```

```sql
-- Create database
CREATE DATABASE phpmyadmin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user
CREATE USER 'phpmyadmin'@'localhost' IDENTIFIED BY 'your_strong_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON phpmyadmin.* TO 'phpmyadmin'@'localhost';
FLUSH PRIVILEGES;

-- Import schema
USE phpmyadmin;
SOURCE /usr/share/phpmyadmin/sql/create_tables.sql;

-- Exit
EXIT;
```

Then update the configuration:
```bash
sudo nano /etc/phpmyadmin/config-db.php
```

Update these lines:
```php
$dbuser='phpmyadmin';
$dbpass='your_strong_password';
$basepath='';
$dbname='phpmyadmin';
```

### 4.3 Configure phpMyAdmin for Nginx

Since Nginx wasn't automatically configured, we need to set it up manually:

```bash
# Create symbolic link to phpMyAdmin
sudo ln -s /usr/share/phpmyadmin /var/www/phpmyadmin

# Set proper permissions
sudo chown -R www-data:www-data /usr/share/phpmyadmin
sudo chmod -R 755 /usr/share/phpmyadmin
```

### 4.4 Create Nginx Configuration for phpMyAdmin

Create a secure Nginx configuration for phpMyAdmin:

```bash
sudo nano /etc/nginx/sites-available/phpmyadmin
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name phpmyadmin.infi-tools.com;  # Use a subdomain for security
    
    # Security: Restrict access by IP (optional but recommended)
    # Uncomment and add your IP address:
    # allow YOUR_IP_ADDRESS;
    # deny all;

    root /usr/share/phpmyadmin;
    index index.php index.html index.htm;

    # Logging
    access_log /var/log/nginx/phpmyadmin_access.log;
    error_log /var/log/nginx/phpmyadmin_error.log;

    location / {
        try_files $uri $uri/ =404;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.3-fpm.sock;  # Adjust version if needed
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    # Deny access to sensitive files
    location ~ /\. {
        deny all;
    }

    location ~ /(libraries|setup/frames|setup/libs) {
        deny all;
        return 404;
    }
}
```

**Note**: Check your PHP-FPM version:
```bash
ls /var/run/php/
# Look for php*-fpm.sock (e.g., php8.3-fpm.sock)
```

### 4.5 Enable phpMyAdmin Site

```bash
# Create symbolic link to enable site
sudo ln -s /etc/nginx/sites-available/phpmyadmin /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx
```

### 4.6 Secure phpMyAdmin

**IMPORTANT**: phpMyAdmin is a common target for attacks. Follow these security steps:

#### Option 1: Restrict by IP Address (Recommended)

Edit the Nginx config to only allow your IP:

```bash
sudo nano /etc/nginx/sites-available/phpmyadmin
```

Uncomment and modify the allow/deny lines:
```nginx
# Add your IP address (find it with: curl ifconfig.me)
allow YOUR_IP_ADDRESS;
deny all;
```

Reload Nginx:
```bash
sudo systemctl reload nginx
```

#### Option 2: Use HTTP Authentication

Create a password file:

```bash
# Install apache2-utils for htpasswd
sudo apt install apache2-utils -y

# Create password file (replace 'admin' with your desired username)
sudo htpasswd -c /etc/nginx/.htpasswd admin
# Enter a strong password when prompted
```

Update Nginx config:

```bash
sudo nano /etc/nginx/sites-available/phpmyadmin
```

Add inside the `server` block:
```nginx
location / {
    auth_basic "Admin Area";
    auth_basic_user_file /etc/nginx/.htpasswd;
    try_files $uri $uri/ =404;
}
```

Reload Nginx:
```bash
sudo systemctl reload nginx
```

#### Option 3: Use a Subdomain with SSL

1. Create a DNS A record: `phpmyadmin.infi-tools.com` → `110.4.47.197`
2. Get SSL certificate:
```bash
sudo certbot --nginx -d phpmyadmin.infi-tools.com
```

### 4.7 Access phpMyAdmin

1. **If using subdomain**: Visit `http://phpmyadmin.infi-tools.com` (or `https://` if SSL is configured)
2. **If using IP restriction**: Make sure you're accessing from the allowed IP
3. **Login credentials**:
   - **Username**: `tree_app` (or `root` for MySQL root)
   - **Password**: The password you set for the MySQL user

### 4.8 phpMyAdmin Useful Features

Once logged in, you can:

- **Browse databases**: Click on `direct_sales_tree` in the left sidebar
- **View tables**: Click on any table to see its data
- **Run SQL queries**: Click "SQL" tab to run custom queries
- **Export data**: Select database/table → "Export" tab
- **Import data**: Select database → "Import" tab
- **Structure**: View table structure, indexes, and relationships

### 4.9 Troubleshooting phpMyAdmin

#### Issue: "404 Not Found" when accessing phpMyAdmin

```bash
# Check if phpMyAdmin is installed
ls -la /usr/share/phpmyadmin

# Check Nginx configuration
sudo nginx -t

# Check if site is enabled
ls -la /etc/nginx/sites-enabled/ | grep phpmyadmin

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

#### Issue: "502 Bad Gateway"

```bash
# Check PHP-FPM status
sudo systemctl status php8.3-fpm  # Adjust version

# Check PHP-FPM socket
ls -la /var/run/php/

# Restart PHP-FPM
sudo systemctl restart php8.3-fpm
```

#### Issue: "Access Denied" or "Forbidden"

```bash
# Check permissions
sudo chown -R www-data:www-data /usr/share/phpmyadmin
sudo chmod -R 755 /usr/share/phpmyadmin

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

#### Issue: "ERROR 1819: Your password does not satisfy the current policy requirements"

**Error Message:**
```
mysql said: ERROR 1819 (HY000) at line 1: Your password does not satisfy the current policy requirements
```

**Why this happens:**
MySQL 8.0 has a built-in password validation plugin that enforces strict password policies. Your password doesn't meet MySQL's requirements.

**Solution 1: Use a Stronger Password (Recommended)**

When prompted for the phpMyAdmin password, use a password that meets ALL these requirements:
- ✅ At least 8 characters (or 20 if STRONG policy is enabled)
- ✅ Contains uppercase letters (A-Z)
- ✅ Contains lowercase letters (a-z)
- ✅ Contains numbers (0-9)
- ✅ Contains special characters (!@#$%^&*()_+-=[]{}|;:,.<>?)

**Example passwords that work:**
- `MyPhpMyAdmin2025!Secure`
- `P@ssw0rd123!Admin`
- `Secure#2025$PhpMyAdmin`

**Solution 2: Check and Adjust MySQL Password Policy**

First, check your current password policy:

```bash
sudo mysql -u root -p
```

In MySQL prompt:
```sql
-- Check current password policy
SHOW VARIABLES LIKE 'validate_password%';
```

You'll see output like:
```
+--------------------------------------+--------+
| Variable_name                        | Value  |
+--------------------------------------+--------+
| validate_password.check_user_name    | ON     |
| validate_password.dictionary_file    |        |
| validate_password.length             | 8      |
| validate_password.mixed_case_count   | 1      |
| validate_password.number_count       | 1      |
| validate_password.policy             | MEDIUM |
| validate_password.special_char_count | 1      |
+--------------------------------------+--------+
```

**Option A: Temporarily Lower Password Policy (For Installation Only)**

```sql
-- Set policy to LOW (minimum 8 chars, no complexity required)
SET GLOBAL validate_password.policy = LOW;
SET GLOBAL validate_password.length = 6;
SET GLOBAL validate_password.mixed_case_count = 0;
SET GLOBAL validate_password.number_count = 0;
SET GLOBAL validate_password.special_char_count = 0;

-- Exit MySQL
EXIT;
```

**⚠️ Security Warning:** This makes passwords less secure. Only do this temporarily during installation, then set it back.

Now retry the phpMyAdmin installation:
```bash
# Choose option 2 (retry) when prompted
# Enter a simpler password (minimum 8 characters)
```

After installation, restore the policy:
```bash
sudo mysql -u root -p
```

```sql
-- Restore MEDIUM policy
SET GLOBAL validate_password.policy = MEDIUM;
SET GLOBAL validate_password.mixed_case_count = 1;
SET GLOBAL validate_password.number_count = 1;
SET GLOBAL validate_password.special_char_count = 1;
EXIT;
```

**Option B: Disable Password Validation (NOT Recommended for Production)**

```sql
-- Uninstall password validation plugin
UNINSTALL PLUGIN validate_password;

-- Exit
EXIT;
```

**⚠️ Security Warning:** This completely disables password validation. Only use for development/testing.

**Solution 3: Configure Password Policy Before Installation**

Set up the password policy before installing phpMyAdmin:

```bash
sudo mysql -u root -p
```

```sql
-- Set a reasonable policy
SET GLOBAL validate_password.policy = MEDIUM;
SET GLOBAL validate_password.length = 8;
SET GLOBAL validate_password.mixed_case_count = 1;
SET GLOBAL validate_password.number_count = 1;
SET GLOBAL validate_password.special_char_count = 1;

-- Exit
EXIT;
```

Then install phpMyAdmin with a password that meets these requirements.

**Solution 4: Let System Generate Password**

If you're having trouble creating a valid password, let the system generate one:

1. When prompted for password, **leave it blank** and press Enter
2. The system will generate a random password that meets all requirements
3. Retrieve it later from the config file:

```bash
sudo cat /etc/phpmyadmin/config-db.php | grep dbpass
```

**What to do when you see the error prompt:**

```
Your options are:
 * abort - Causes the operation to fail
 * retry - Prompts once more with all the configuration questions
 * retry (skip questions) - Immediately attempts the operation again
 * ignore - Continues the operation ignoring dbconfig-common errors

  1. abort  2. retry  3. retry (skip questions)  4. ignore
```

**Recommended action:**
1. Choose **`2` (retry)** - This lets you enter a new password
2. Enter a password that meets all requirements (see Solution 1)
3. If it still fails, use **Solution 2** to temporarily lower the policy

**Solution 5: Completely Bypass Password Validation (Temporary)**

If you've tried all the above and still getting errors, you can completely disable password validation temporarily:

**First, check if the plugin exists:**

```bash
sudo mysql -u root -p
```

```sql
-- Check if validate_password plugin exists
SHOW PLUGINS LIKE 'validate_password%';

-- Or check all plugins
SHOW PLUGINS;

-- Check variables (if plugin is active)
SHOW VARIABLES LIKE 'validate_password%';
```

**If the plugin doesn't exist or is not installed:**

The password validation might be built into MySQL 8.0 differently. Try these approaches:

**Option A: Check if it's a component instead of plugin (MySQL 8.0.4+)**

```sql
-- Check installed components
SELECT * FROM mysql.component WHERE component_id LIKE '%validate%';

-- Uninstall component (if exists)
UNINSTALL COMPONENT 'file://component_validate_password';

-- Exit
EXIT;
```

**Option B: If plugin doesn't exist, password validation might be disabled already**

If you get **"ERROR 1305: PLUGIN validate_password does not exist"**, this means:

✅ **Good news:** Password validation is NOT active on your system  
✅ You can use ANY password (even simple ones)  
✅ You can proceed with phpMyAdmin installation immediately  

**What to do:**
1. Simply retry the phpMyAdmin installation
2. When prompted for password, enter ANY password (e.g., `password123`)
3. The installation should proceed without password validation errors

**Why this happens:**
- In MySQL 8.0.4+, password validation changed from plugin to component
- Your MySQL installation might not have the validation component installed
- Or it might be disabled by default

**Option C: Disable via configuration file**

```bash
# Edit MySQL configuration
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf
```

Add this line under `[mysqld]` section:
```ini
validate_password = OFF
```

Then restart MySQL:
```bash
sudo systemctl restart mysql
```

**Option D: If plugin exists, uninstall it**

```sql
-- Try uninstalling plugin
UNINSTALL PLUGIN validate_password;

-- If that doesn't work, try:
UNINSTALL PLUGIN IF EXISTS validate_password;

-- Verify it's disabled
SHOW VARIABLES LIKE 'validate_password%';

-- Exit MySQL
EXIT;
```

Now install phpMyAdmin:
```bash
# Retry phpMyAdmin installation
sudo dpkg-reconfigure phpmyadmin
# OR
sudo apt install --reinstall phpmyadmin
```

When prompted for password, you can use ANY password now (even simple ones like `password123`).

**After installation, re-enable password validation (if needed):**

**If you disabled it via component:**
```bash
sudo mysql -u root -p
```

```sql
-- Reinstall component
INSTALL COMPONENT 'file://component_validate_password';

-- Set policy
SET GLOBAL validate_password.policy = MEDIUM;
EXIT;
```

**If you disabled it via config file:**
```bash
# Remove the validate_password = OFF line
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf

# Restart MySQL
sudo systemctl restart mysql
```

**If plugin was uninstalled:**
```bash
sudo mysql -u root -p
```

```sql
-- Try to install plugin (may not work if it's a component)
INSTALL PLUGIN validate_password SONAME 'validate_password.so';

-- Or install as component
INSTALL COMPONENT 'file://component_validate_password';

-- Set policy
SET GLOBAL validate_password.policy = MEDIUM;
SET GLOBAL validate_password.length = 8;
SET GLOBAL validate_password.mixed_case_count = 1;
SET GLOBAL validate_password.number_count = 1;
SET GLOBAL validate_password.special_char_count = 1;

-- Exit
EXIT;
```

**Note:** If the plugin doesn't exist, password validation might not be enabled on your system, which means you can use any password without restrictions.

**Solution 6: Skip Database Configuration Entirely (Manual Setup)**

If you want to completely bypass dbconfig-common, install phpMyAdmin without database configuration:

```bash
# 1. Install phpMyAdmin but skip database setup
sudo DEBIAN_FRONTEND=noninteractive apt install phpmyadmin -y

# 2. When you see the error prompt, choose option 4 (ignore)
# This will install phpMyAdmin files but skip database configuration
```

Then manually set up the database:

```bash
# Login to MySQL
sudo mysql -u root -p
```

```sql
-- Create database (no password validation needed for root user)
CREATE DATABASE phpmyadmin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user with a simple password (since validation is disabled temporarily)
CREATE USER 'phpmyadmin'@'localhost' IDENTIFIED BY 'phpmyadmin123';

-- Grant privileges
GRANT ALL PRIVILEGES ON phpmyadmin.* TO 'phpmyadmin'@'localhost';
FLUSH PRIVILEGES;

-- Import phpMyAdmin tables
USE phpmyadmin;
SOURCE /usr/share/phpmyadmin/sql/create_tables.sql;

-- Exit
EXIT;
```

Update phpMyAdmin configuration:
```bash
sudo nano /etc/phpmyadmin/config-db.php
```

Update these lines:
```php
$dbuser='phpmyadmin';
$dbpass='phpmyadmin123';
$basepath='';
$dbname='phpmyadmin';
```

**Solution 7: One-Command Bypass (Easiest)**

Run this single command to disable validation, install, then re-enable:

```bash
# Disable validation, install phpMyAdmin, then re-enable validation
sudo mysql -u root -p -e "UNINSTALL PLUGIN validate_password;" && \
sudo DEBIAN_FRONTEND=noninteractive apt install phpmyadmin -y && \
sudo mysql -u root -p -e "INSTALL PLUGIN validate_password SONAME 'validate_password.so'; SET GLOBAL validate_password.policy = MEDIUM;"
```

When you see the error prompt during installation, choose **`4` (ignore)** to skip database configuration, then manually set it up as shown in Solution 6.

**Quick Fix Summary (Choose One):**

**Option A - Check and Disable Validation:**

```bash
# 1. Check if password validation is active
sudo mysql -u root -p -e "SHOW VARIABLES LIKE 'validate_password%';"

# 2a. If plugin exists, uninstall it
sudo mysql -u root -p -e "UNINSTALL PLUGIN IF EXISTS validate_password;"

# 2b. If it's a component, uninstall component
sudo mysql -u root -p -e "UNINSTALL COMPONENT 'file://component_validate_password';"

# 2c. If neither works, disable via config file
sudo sed -i '/\[mysqld\]/a validate_password = OFF' /etc/mysql/mysql.conf.d/mysqld.cnf
sudo systemctl restart mysql

# 3. Retry phpMyAdmin installation
sudo dpkg-reconfigure phpmyadmin
# Choose option 2 (retry) and enter ANY password

# 4. Re-enable password validation (optional, after installation)
# sudo mysql -u root -p -e "INSTALL COMPONENT 'file://component_validate_password'; SET GLOBAL validate_password.policy = MEDIUM;"
```

**Option B - Skip Database Config:**
```bash
# 1. Install and ignore database errors
sudo DEBIAN_FRONTEND=noninteractive apt install phpmyadmin -y
# When error appears, choose option 4 (ignore)

# 2. Manually create database (see Solution 6 above)
```

#### Issue: Can't login to phpMyAdmin

- Verify MySQL user exists and has correct password
- Try logging in as MySQL root user first
- Check MySQL user privileges:
```bash
sudo mysql -u root -p
```
```sql
SHOW GRANTS FOR 'tree_app'@'localhost';
```

### 4.10 Security Best Practices

1. **Change default URL**: Consider renaming the phpMyAdmin directory
2. **Use HTTPS**: Always use SSL certificate for phpMyAdmin
3. **Restrict IP access**: Only allow your IP addresses
4. **Strong passwords**: Use complex passwords for MySQL users
5. **Regular updates**: Keep phpMyAdmin updated
   ```bash
   sudo apt update && sudo apt upgrade phpmyadmin -y
   ```
6. **Disable when not needed**: Consider disabling phpMyAdmin when not in use
7. **Monitor access logs**: Regularly check access logs for suspicious activity

---

## 5. Deploy Application

### 5.1 Clone Repository

```bash
# Navigate to projects directory
mkdir -p /root/projects
cd /root/projects

# Clone your repository (replace with your actual repo URL)
git clone <your-repository-url> tree_system

# Or if you need to upload files manually:
# Create directory
mkdir -p /root/projects/tree_system
# Then upload files via SCP or SFTP
```

### 5.2 Navigate to Project Directory

```bash
cd /root/projects/tree_system
```

### 5.3 Create Environment File

```bash
# Copy example env file
cp env.example .env

# Edit the .env file
nano .env
```

**Update `.env` with your production settings:**

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=tree_app
DB_PASSWORD=your_strong_password
DB_NAME=direct_sales_tree

# Server Configuration
PORT=3000
NODE_ENV=production
```

**Save and exit:** `Ctrl+X`, then `Y`, then `Enter`

---

## 6. Build and Configure Application

### 6.1 Install Dependencies

```bash
# Install root dependencies
npm install

# Fix permissions on node_modules binaries (if needed)
chmod +x node_modules/.bin/*

# Install frontend dependencies
cd frontend
npm install
chmod +x node_modules/.bin/*
cd ..
```

**Note:** If you encounter "Permission denied" errors with `tsc` or other binaries, see [Troubleshooting Section 12.7](#127-permission-denied-errors).

### 6.2 Setup Database Schema

```bash
# Import database schema
mysql -u tree_app -p direct_sales_tree < src/database/schema.sql

# If you also need the beehive schema:
mysql -u tree_app -p direct_sales_tree < src/database/beehive-schema.sql
```

### 6.3 Import Sample Data (Optional)

```bash
# Import CSV data (if you have sample data)
npm run import-csv
```

### 6.4 Build Application

```bash
# Build both backend and frontend
npm run build

# This will:
# - Compile TypeScript backend to dist/
# - Build React frontend to frontend/dist/
```

### 6.5 Update CORS Settings for Production

```bash
# Edit server.ts to update CORS for your domain
nano src/server.ts
```

**Find the CORS configuration (around line 49-64) and update:**

```typescript
const allowedOrigins = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /^https:\/\/infi-tools\.com$/,
  /^https:\/\/www\.infi-tools\.com$/,
  /^http:\/\/infi-tools\.com$/,
  /^http:\/\/www\.infi-tools\.com$/
];
```

**Save and rebuild:**

```bash
npm run build:backend
```

---

## 7. Setup Process Manager (PM2)

### 7.1 Start Application with PM2

```bash
# Start the application
pm2 start dist/server.js --name tree-api

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Follow the instructions shown (usually run a sudo command)
```

### 7.2 PM2 Useful Commands

```bash
# Check status
pm2 status

# View logs
pm2 logs tree-api

# Restart application
pm2 restart tree-api

# Stop application
pm2 stop tree-api

# Monitor (real-time)
pm2 monit
```

---

## 8. Configure Nginx Reverse Proxy

### 8.1 Create Nginx Configuration

```bash
# Create configuration file
sudo nano /etc/nginx/sites-available/infi-tools
```

**Add the following configuration:**

```nginx
server {
    listen 80;
    server_name infi-tools.com www.infi-tools.com;

    # Increase body size limit for file uploads
    client_max_body_size 10M;

    # Serve static files from frontend build
    location / {
        root /root/projects/tree_system/frontend/dist;
        try_files $uri $uri/ /index.html;
        index index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Serve public files (widget, embed, etc.)
    location /public {
        alias /root/projects/tree_system/public;
        try_files $uri =404;
    }

    # Serve widget.js and embed.html from root
    location ~ ^/(widget\.js|embed\.html|example-integration\.html)$ {
        root /root/projects/tree_system/public;
        try_files $uri =404;
    }
}
```

**Note:** The paths are configured for `/root/projects/tree_system`. If your project is in a different location, update the paths accordingly.

**Save and exit:** `Ctrl+X`, then `Y`, then `Enter`

### 8.2 Enable Site and Test Configuration

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/infi-tools /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx
```

---

## 9. Setup SSL Certificate

### 9.1 Install Certbot

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y
```

### 9.2 Obtain SSL Certificate for infi-tools.com

```bash
# Get SSL certificate for infi-tools.com (this will automatically configure Nginx)
sudo certbot --nginx -d infi-tools.com -d www.infi-tools.com

# During setup:
# - Enter your email address
# - Agree to terms of service
# - Choose whether to redirect HTTP to HTTPS (recommended: Yes)
```

### 9.3 Auto-Renewal Setup

```bash
# Test auto-renewal
sudo certbot renew --dry-run

# Certbot automatically sets up a cron job, but verify:
sudo systemctl status certbot.timer
```

---

## 10. Configure Domain DNS

### 10.1 DNS Records for infi-tools.com

In your domain registrar's DNS settings for `infi-tools.com`, add the following records:

**A Record:**
```
Type: A
Name: @ (or infi-tools.com)
Value: 110.4.47.197
TTL: 3600 (or default)
```

**A Record for www:**
```
Type: A
Name: www
Value: 110.4.47.197
TTL: 3600 (or default)
```

### 10.2 Verify DNS Propagation

**Option 1: Using `dig` (usually pre-installed)**
```bash
# Check DNS resolution for infi-tools.com
dig infi-tools.com
dig www.infi-tools.com

# Get just the IP address
dig +short infi-tools.com
```

**Option 2: Using `host` (usually pre-installed)**
```bash
# Check DNS resolution
host infi-tools.com
host www.infi-tools.com
```

**Option 3: Install and use `nslookup` (if not available)**
```bash
# Install dnsutils package (includes nslookup)
sudo apt install dnsutils -y

# Then use nslookup
nslookup infi-tools.com
nslookup www.infi-tools.com
```

**Option 4: Quick check with `curl` (if site is already responding)**
```bash
# This will show if DNS is resolving and site is accessible
curl -I http://infi-tools.com
```

**Expected Output:**
All commands should show the IP address `110.4.47.197`.

**Wait 5-30 minutes for DNS propagation before proceeding with SSL setup.**

---

## 11. Testing and Verification

### 11.1 Test Backend API

```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Test from your local machine (after DNS propagates)
curl https://infi-tools.com/api/health
```

### 11.2 Test Frontend

**infi-tools.com:**
- `https://infi-tools.com` - Main application
- `https://infi-tools.com/api/health` - API health check
- `https://infi-tools.com/embed.html?memberId=1&maxDepth=3` - Embed page
- `https://infi-tools.com/example-integration.html` - Integration examples

### 11.3 Test Database Connection

```bash
# Check if application can connect to database
pm2 logs tree-api | grep -i "database\|error\|connected"
```

### 11.4 Verify All Services

```bash
# Check PM2
pm2 status

# Check Nginx
sudo systemctl status nginx

# Check MySQL
sudo systemctl status mysql

# Check firewall
sudo ufw status
```

---

## 12. Maintenance Commands

### 12.1 Update Application

```bash
cd /root/projects/tree_system

# Pull latest changes (if using git)
git pull

# Install/update dependencies
npm install
cd frontend && npm install && cd ..

# Rebuild
npm run build

# Restart application
pm2 restart tree-api
```

### 12.2 View Logs

```bash
# Application logs
pm2 logs tree-api

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# MySQL logs
sudo tail -f /var/log/mysql/error.log
```

### 12.3 Database Backup

```bash
# Create backup
mysqldump -u tree_app -p direct_sales_tree > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
mysql -u tree_app -p direct_sales_tree < backup_file.sql
```

### 12.4 Import New CSV Data

```bash
cd /root/projects/tree_system

# Make sure .env is configured correctly
# Then run import
npm run import-csv
```

---

## 13. Troubleshooting

### 13.1 Application Won't Start

```bash
# Check PM2 logs
pm2 logs tree-api --lines 50

# Check if port is in use
sudo netstat -tulpn | grep 3000

# Verify .env file exists and is correct
cat .env

# Test database connection manually
mysql -u tree_app -p direct_sales_tree
```

### 13.2 Connection Refused (DNS resolves but can't connect)

If DNS resolves correctly but you get "connection refused" or "site can't be reached":

**Step 1: Check if Nginx is running**
```bash
# Check Nginx status
sudo systemctl status nginx

# If not running, start it
sudo systemctl start nginx
sudo systemctl enable nginx
```

**Step 2: Check if Nginx is listening on port 80/443**
```bash
# Check what's listening on ports
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443

# Or use ss command
sudo ss -tulpn | grep :80
sudo ss -tulpn | grep :443
```

**Step 3: Check firewall settings**
```bash
# Check firewall status
sudo ufw status verbose

# Make sure HTTP and HTTPS are allowed
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# If firewall was just enabled, you might need to reload
sudo ufw reload
```

**Step 4: Check Nginx configuration**
```bash
# Test Nginx configuration
sudo nginx -t

# If there are errors, check the configuration files
sudo nano /etc/nginx/sites-available/infi-tools

# Make sure sites are enabled
ls -la /etc/nginx/sites-enabled/
```

**Step 5: Check Nginx error logs**
```bash
# Check recent errors
sudo tail -20 /var/log/nginx/error.log

# Monitor errors in real-time
sudo tail -f /var/log/nginx/error.log
```

**Step 6: Test locally on the server**
```bash
# Test from the server itself
curl -I http://localhost
curl -I http://127.0.0.1

# Test with domain name (if DNS is configured on server)
curl -I http://infi-tools.com
```

**Step 7: Verify Nginx is binding to all interfaces**
```bash
# Check Nginx configuration
sudo grep -r "listen" /etc/nginx/sites-enabled/

# Should show "listen 80;" not "listen 127.0.0.1:80;"
```

### 13.3 Nginx 502 Bad Gateway

```bash
# Check if application is running
pm2 status

# Check application logs
pm2 logs tree-api

# Verify backend is listening on port 3000
curl http://localhost:3000/api/health

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### 13.4 Database Connection Errors

```bash
# Verify MySQL is running
sudo systemctl status mysql

# Test database connection
mysql -u tree_app -p direct_sales_tree

# Check MySQL error logs
sudo tail -f /var/log/mysql/error.log

# Verify .env database credentials
cat .env | grep DB_
```

### 13.5 SSL Certificate Issues

**Symptoms:** HTTP works but HTTPS doesn't work

**Step 1: Check if Nginx is listening on port 443**
```bash
# Check if port 443 is open and listening
sudo ss -tulpn | grep :443

# Should show nginx listening on *:443 or 0.0.0.0:443
# If nothing shows, SSL is not configured
```

**Step 2: Check certificate status**
```bash
# List all certificates
sudo certbot certificates

# Should show certificates for your domains
```

**Step 3: Check Nginx configuration**
```bash
# View the Nginx config for your site
sudo cat /etc/nginx/sites-available/infi-tools

# Should have a server block with:
# listen 443 ssl;
# ssl_certificate /etc/letsencrypt/live/infi-tools.com/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/infi-tools.com/privkey.pem;
```

**Step 4: Verify certificate files exist**
```bash
# Check if certificate files exist
sudo ls -la /etc/letsencrypt/live/infi-tools.com/

# Should show:
# - fullchain.pem
# - privkey.pem
# - cert.pem
# - chain.pem
```

**Step 5: Check firewall for port 443**
```bash
# Check if port 443 is allowed
sudo ufw status verbose

# If not, allow it:
sudo ufw allow 443/tcp
sudo ufw reload
```

**Step 6: Test Nginx configuration**
```bash
# Test Nginx config for errors
sudo nginx -t

# If there are errors, fix them
# Common issues:
# - Missing SSL certificate paths
# - Syntax errors in server block
```

**Step 7: Re-run certbot if needed**
```bash
# If certificate exists but Nginx isn't configured:
sudo certbot --nginx -d infi-tools.com -d www.infi-tools.com

# This will reconfigure Nginx with SSL
```

**Step 8: Check Nginx error logs**
```bash
# Check for SSL-related errors
sudo tail -50 /var/log/nginx/error.log | grep -i ssl

# Common errors:
# - "SSL_CTX_use_certificate_file" - certificate file path wrong
# - "could not build server_names_hash" - server_name issue
```

**Step 9: Verify SSL certificate is valid**
```bash
# Test SSL connection
openssl s_client -connect infi-tools.com:443 -servername infi-tools.com

# Should show certificate details
```

**Step 10: Common Fix - Reconfigure SSL**
```bash
# If certbot didn't configure Nginx properly, manually check:
sudo nano /etc/nginx/sites-available/infi-tools

# Make sure you have BOTH server blocks:
# 1. HTTP server (port 80) that redirects to HTTPS
# 2. HTTPS server (port 443) with SSL certificates

# After editing, test and reload:
sudo nginx -t
sudo systemctl reload nginx
```

**Quick Diagnostic Commands:**
```bash
# 1. Check port 443
sudo ss -tulpn | grep :443

# 2. Check certificates
sudo certbot certificates

# 3. Check Nginx config
sudo nginx -t

# 4. Check firewall
sudo ufw status | grep 443

# 5. Test HTTPS
curl -I https://infi-tools.com
```

### 13.6 Permission Issues

**Error: "Permission denied" when Nginx tries to access files**

This happens because Nginx runs as `www-data` user but files are owned by `root` in `/root/` directory.

**Solution 1: Fix ownership for Nginx (Recommended)**
```bash
# Make www-data the owner of the frontend dist directory
sudo chown -R www-data:www-data /root/projects/tree_system/frontend/dist

# Also fix public directory if needed
sudo chown -R www-data:www-data /root/projects/tree_system/public

```

**Solution 2: Fix directory permissions (Alternative)**
```bash
# Give www-data read access to the directories
sudo chmod -R 755 /root/projects/tree_system/frontend/dist
sudo chmod -R 755 /root/projects/tree_system/public

# Make sure parent directories are accessible
sudo chmod 755 /root
sudo chmod 755 /root/projects
sudo chmod 755 /root/projects/tree_system
sudo chmod 755 /root/projects/tree_system/frontend
```

**Solution 3: Move project out of /root (Best for production)**
```bash
# Move to a more appropriate location
sudo mkdir -p /var/www
sudo mv /root/projects/tree_system /var/www/
sudo chown -R www-data:www-data /var/www/tree_system

# Update Nginx configuration
sudo nano /etc/nginx/sites-available/infi-tools
# Change root path from /root/projects/tree_system to /var/www/tree_system

# Reload Nginx
sudo nginx -t && sudo systemctl reload nginx
```

**Quick Fix (Run this now):**
```bash
# Fix ownership immediately
sudo chown -R www-data:www-data /root/projects/tree_system/frontend/dist
sudo chown -R www-data:www-data /root/projects/tree_system/public

# Fix directory permissions
sudo chmod 755 /root
sudo chmod 755 /root/projects
sudo chmod 755 /root/projects/tree_system
sudo chmod 755 /root/projects/tree_system/frontend

# Reload Nginx
sudo systemctl reload nginx
```

### 13.7 Firewall Blocking Connections

**Symptoms:** Works with `curl` from server but "connection refused" from browser

This means Nginx is working but external connections are blocked.

**Step 1: Check UFW Firewall**
```bash
# Check firewall status
sudo ufw status verbose

# Make sure HTTP and HTTPS are allowed
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# If firewall was just configured, reload it
sudo ufw reload

# Check detailed status
sudo ufw status numbered
```

**Step 2: Check if Nginx is listening on all interfaces**
```bash
# Check what Nginx is listening on
sudo ss -tulpn | grep nginx

# Should show:
# *:80 (listening on all interfaces)
# NOT: 127.0.0.1:80 (only localhost)

# If it shows 127.0.0.1, check Nginx config
sudo grep -r "listen" /etc/nginx/sites-enabled/
# Should show "listen 80;" not "listen 127.0.0.1:80;"
```

**Step 3: Check VPS Provider's Firewall/Security Group**

Many VPS providers (like Exabytes, DigitalOcean, AWS, etc.) have their own firewall that blocks ports by default.

**For Exabytes/Cloud VPS:**
- Log into your VPS control panel
- Look for "Firewall", "Security Groups", or "Network Settings"
- Make sure ports 80 (HTTP) and 443 (HTTPS) are open
- Allow traffic from 0.0.0.0/0 (all IPs) or your specific IP

**Step 4: Test from external network**
```bash
# Test if port 80 is accessible from outside
# Run this from your local computer (not the server):
telnet 110.4.47.197 80

# Or use:
nc -zv 110.4.47.197 80

# If connection times out, it's a firewall issue
```

**Step 5: Check iptables (if UFW is not managing it)**
```bash
# Check iptables rules
sudo iptables -L -n -v

# If you see DROP rules blocking ports, you may need to:
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

**Step 6: Verify with netstat/ss**
```bash
# Check if Nginx is listening on all interfaces (0.0.0.0)
sudo netstat -tulpn | grep :80
# Should show: 0.0.0.0:80 or :::80
# NOT: 127.0.0.1:80

# Or with ss:
sudo ss -tulpn | grep :80
```

**Quick Diagnostic Commands:**
```bash
# 1. Check UFW
sudo ufw status

# 2. Check listening ports
sudo ss -tulpn | grep -E ':(80|443)'

# 3. Test locally
curl -I http://localhost

# 4. Check Nginx config
sudo nginx -t
```

### 13.8 Permission Denied Errors (tsc, npm scripts)

If you get "Permission denied" errors when running `tsc` or other npm scripts:

**Solution 1: Fix permissions on node_modules binaries**
```bash
# Fix permissions in root directory
chmod +x node_modules/.bin/*

# Fix permissions in frontend directory
cd frontend
chmod +x node_modules/.bin/*
cd ..
```

**Solution 2: Use npx instead (recommended)**
```bash
# Instead of: npm run build:backend
# Use: npx tsc

# Or update package.json to use npx:
# "build:backend": "npx tsc"
```

**Solution 3: Reinstall node_modules**
```bash
# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Same for frontend
cd frontend
rm -rf node_modules package-lock.json
npm install
cd ..
```

**Solution 4: Check file ownership**
```bash
# Ensure you own the files
sudo chown -R $USER:$USER /root/projects/tree_system

# Then reinstall
npm install
```

**Quick fix for immediate build:**
```bash
# Use npx to run tsc directly
npx tsc

# Or update package.json temporarily:
# Change "build:backend": "tsc" to "build:backend": "npx tsc"
```

---

## 14. Security Checklist

- [ ] Firewall (UFW) is enabled and configured
- [ ] SSH key authentication is set up (disable password auth)
- [ ] MySQL root user has strong password
- [ ] Application database user has limited privileges
- [ ] `.env` file has secure permissions (`chmod 600 .env`)
- [ ] SSL certificate is installed and auto-renewal is working
- [ ] Nginx is configured to redirect HTTP to HTTPS
- [ ] PM2 is configured to restart on system boot
- [ ] Regular database backups are scheduled
- [ ] System packages are kept up to date

---

## 15. Quick Reference

**Tree System Project Location:** `/root/projects/tree_system`  
**Backend Port:** `3000`  
**Database:** `direct_sales_tree`  
**Domain:** `infi-tools.com`  
**VPS IP:** `110.4.47.197`

**Key Commands:**
```bash
# Restart application
pm2 restart tree-api

# View logs
pm2 logs tree-api

# Reload Nginx
sudo systemctl reload nginx

# Check all services
pm2 status && sudo systemctl status nginx && sudo systemctl status mysql
```

---

## Support

If you encounter issues:

1. Check application logs: `pm2 logs tree-api`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Verify all services are running
4. Check firewall and DNS settings
5. Review this guide's troubleshooting section

---

**Last Updated:** 2024  
**For:** infi-tools.com deployment on Ubuntu 24.04.3 LTS

