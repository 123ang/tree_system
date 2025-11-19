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
4. [Deploy Application](#4-deploy-application)
5. [Build and Configure Application](#5-build-and-configure-application)
6. [Setup Process Manager (PM2)](#6-setup-process-manager-pm2)
7. [Configure Nginx Reverse Proxy](#7-configure-nginx-reverse-proxy)
8. [Setup SSL Certificate](#8-setup-ssl-certificate)
9. [Configure Domain DNS](#9-configure-domain-dns)
10. [Testing and Verification](#10-testing-and-verification)
11. [Maintenance Commands](#11-maintenance-commands)
12. [Troubleshooting](#12-troubleshooting)

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

## 4. Deploy Application

### 4.1 Clone Repository

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

### 4.2 Navigate to Project Directory

```bash
cd /root/projects/tree_system
```

### 4.3 Create Environment File

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

## 5. Build and Configure Application

### 5.1 Install Dependencies

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

### 5.2 Setup Database Schema

```bash
# Import database schema
mysql -u tree_app -p direct_sales_tree < src/database/schema.sql

# If you also need the beehive schema:
mysql -u tree_app -p direct_sales_tree < src/database/beehive-schema.sql
```

### 5.3 Import Sample Data (Optional)

```bash
# Import CSV data (if you have sample data)
npm run import-csv
```

### 5.4 Build Application

```bash
# Build both backend and frontend
npm run build

# This will:
# - Compile TypeScript backend to dist/
# - Build React frontend to frontend/dist/
```

### 5.5 Update CORS Settings for Production

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

## 6. Setup Process Manager (PM2)

### 6.1 Start Application with PM2

```bash
# Start the application
pm2 start dist/server.js --name tree-api

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Follow the instructions shown (usually run a sudo command)
```

### 6.2 PM2 Useful Commands

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

## 7. Configure Nginx Reverse Proxy

### 7.1 Create Nginx Configuration

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

### 7.2 Enable Site and Test Configuration

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

### 7.3 Add Second Domain (Wedding RSVP System)

To add the wedding RSVP domain `jsang-psong-wedding.com`, follow these steps:

**Step 1: Clone or Upload Wedding RSVP Project**

```bash
# Navigate to projects directory
cd /root/projects

# Clone the wedding RSVP repository
git clone https://github.com/123ang/wedding_rsvp.git wedding_rsvp

# Or if you need to upload files manually:
# mkdir -p /root/projects/wedding_rsvp
# Then upload files via SCP or SFTP
```

**Step 2: Build the Wedding RSVP Project (if needed)**

```bash
cd /root/projects/wedding_rsvp

# Install dependencies
npm install

# Build the project (if it's a Vite/React project)
npm run build

# The built files will be in the 'dist' directory
```

**Step 3: Create Nginx Configuration for Wedding Domain**

```bash
# Create configuration file for wedding domain
sudo nano /etc/nginx/sites-available/wedding
```

**Add the following configuration:**

```nginx
server {
    listen 80;
    server_name jsang-psong-wedding.com www.jsang-psong-wedding.com;

    # Increase body size limit for file uploads
    client_max_body_size 10M;

    # Root directory - adjust based on your project structure
    # If using Vite build, serve from 'dist' directory
    root /root/projects/wedding_rsvp/dist;
    
    # Or if it's a static site, serve from root:
    # root /root/projects/wedding_rsvp;

    index index.html;

    # Handle client-side routing (for React/Vue SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Serve static assets with caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API proxy (if the wedding site has a backend API)
    # Uncomment and adjust if needed:
    # location /api {
    #     proxy_pass http://127.0.0.1:PORT;
    #     proxy_http_version 1.1;
    #     proxy_set_header Upgrade $http_upgrade;
    #     proxy_set_header Connection 'upgrade';
    #     proxy_set_header Host $host;
    #     proxy_set_header X-Real-IP $remote_addr;
    #     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    #     proxy_set_header X-Forwarded-Proto $scheme;
    #     proxy_cache_bypass $http_upgrade;
    # }
}
```

**Save and exit:** `Ctrl+X`, then `Y`, then `Enter`

**Step 4: Enable Wedding Site**

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/wedding /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx
```

**Note:** 
- Adjust the `root` path based on your wedding project structure
- If the project uses Firebase Functions or a separate backend, you may need to proxy those routes
- Check the project's build output directory (could be `dist`, `build`, or `public`)

---

## 8. Setup SSL Certificate

### 8.1 Install Certbot

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y
```

### 8.2 Obtain SSL Certificate for infi-tools.com

```bash
# Get SSL certificate for infi-tools.com (this will automatically configure Nginx)
sudo certbot --nginx -d infi-tools.com -d www.infi-tools.com

# During setup:
# - Enter your email address
# - Agree to terms of service
# - Choose whether to redirect HTTP to HTTPS (recommended: Yes)
```

### 8.3 Obtain SSL Certificate for Wedding Domain

```bash
# Get SSL certificate for jsang-psong-wedding.com
sudo certbot --nginx -d jsang-psong-wedding.com -d www.jsang-psong-wedding.com

# During setup:
# - Enter your email address
# - Agree to terms of service
# - Choose whether to redirect HTTP to HTTPS (recommended: Yes)
```

**Note:** You can also get certificates for both domains in one command:
```bash
sudo certbot --nginx -d infi-tools.com -d www.infi-tools.com -d jsang-psong-wedding.com -d www.jsang-psong-wedding.com
```

### 8.4 Auto-Renewal Setup

```bash
# Test auto-renewal
sudo certbot renew --dry-run

# Certbot automatically sets up a cron job, but verify:
sudo systemctl status certbot.timer
```

---

## 9. Configure Domain DNS

### 9.1 DNS Records for infi-tools.com

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

### 9.2 DNS Records for jsang-psong-wedding.com

In your domain registrar's DNS settings for `jsang-psong-wedding.com`, add the following records:

**A Record:**
```
Type: A
Name: @ (or jsang-psong-wedding.com)
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

### 9.3 Verify DNS Propagation

**Option 1: Using `dig` (usually pre-installed)**
```bash
# Check DNS resolution for infi-tools.com
dig infi-tools.com
dig www.infi-tools.com

# Check DNS resolution for wedding domain
dig jsang-psong-wedding.com
dig www.jsang-psong-wedding.com

# Get just the IP address
dig +short infi-tools.com
dig +short jsang-psong-wedding.com
```

**Option 2: Using `host` (usually pre-installed)**
```bash
# Check DNS resolution
host infi-tools.com
host www.infi-tools.com
host jsang-psong-wedding.com
host www.jsang-psong-wedding.com
```

**Option 3: Install and use `nslookup` (if not available)**
```bash
# Install dnsutils package (includes nslookup)
sudo apt install dnsutils -y

# Then use nslookup
nslookup infi-tools.com
nslookup www.infi-tools.com
nslookup jsang-psong-wedding.com
nslookup www.jsang-psong-wedding.com
```

**Option 4: Quick check with `curl` (if site is already responding)**
```bash
# This will show if DNS is resolving and site is accessible
curl -I http://infi-tools.com
curl -I http://jsang-psong-wedding.com
```

**Expected Output:**
All commands should show the IP address `110.4.47.197` for both domains.

**Wait 5-30 minutes for DNS propagation before proceeding with SSL setup.**

---

## 10. Testing and Verification

### 10.1 Test Backend API

```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Test from your local machine (after DNS propagates)
curl https://infi-tools.com/api/health
```

### 10.2 Test Frontend

**infi-tools.com:**
- `https://infi-tools.com` - Main application
- `https://infi-tools.com/api/health` - API health check
- `https://infi-tools.com/embed.html?memberId=1&maxDepth=3` - Embed page
- `https://infi-tools.com/example-integration.html` - Integration examples

**jsang-psong-wedding.com:**
- `https://jsang-psong-wedding.com` - Wedding RSVP site
- `https://www.jsang-psong-wedding.com` - Wedding RSVP site (www)

### 10.3 Test Database Connection

```bash
# Check if application can connect to database
pm2 logs tree-api | grep -i "database\|error\|connected"
```

### 10.4 Verify All Services

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

## 11. Maintenance Commands

### 11.1 Update Application

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

### 11.2 View Logs

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

### 11.3 Database Backup

```bash
# Create backup
mysqldump -u tree_app -p direct_sales_tree > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
mysql -u tree_app -p direct_sales_tree < backup_file.sql
```

### 11.4 Import New CSV Data

```bash
cd /root/projects/tree_system

# Make sure .env is configured correctly
# Then run import
npm run import-csv
```

---

## 12. Troubleshooting

### 12.1 Application Won't Start

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

### 12.2 Connection Refused (DNS resolves but can't connect)

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
sudo nano /etc/nginx/sites-available/wedding

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

### 12.4 Nginx 502 Bad Gateway

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

### 12.5 Database Connection Errors

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

### 12.6 SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Renew certificate manually
sudo certbot renew

# Check Nginx SSL configuration
sudo nginx -t
```

### 12.7 Permission Issues

**Error: "Permission denied" when Nginx tries to access files**

This happens because Nginx runs as `www-data` user but files are owned by `root` in `/root/` directory.

**Solution 1: Fix ownership for Nginx (Recommended)**
```bash
# Make www-data the owner of the frontend dist directory
sudo chown -R www-data:www-data /root/projects/tree_system/frontend/dist

# Also fix public directory if needed
sudo chown -R www-data:www-data /root/projects/tree_system/public

# For wedding site (if applicable)
sudo chown -R www-data:www-data /root/projects/wedding_rsvp/dist
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

### 12.8 Firewall Blocking Connections

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

### 12.9 Permission Denied Errors (tsc, npm scripts)

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

## 13. Security Checklist

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

## 14. Quick Reference

**Tree System Project Location:** `/root/projects/tree_system`  
**Wedding RSVP Project Location:** `/root/projects/wedding_rsvp`  
**Backend Port:** `3000`  
**Database:** `direct_sales_tree`  
**Domains:** 
- `infi-tools.com` (Tree System)
- `jsang-psong-wedding.com` (Wedding RSVP)
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

