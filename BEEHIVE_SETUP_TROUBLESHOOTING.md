# BeeHive Setup Troubleshooting

## Error: `ETIMEDOUT` - Connection Timeout

This error means the application cannot connect to your MySQL database.

### Quick Checks

1. **Is MySQL Running?**
   ```bash
   # Windows
   # Check Services: Services.msc → MySQL
   
   # Or check if port is listening
   netstat -an | findstr 3306
   ```

2. **Check Database Configuration**
   
   Create a `.env` file in the project root if it doesn't exist:
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=direct_sales_tree
   ```

3. **Does the Database Exist?**
   
   Connect to MySQL and create the database:
   ```sql
   CREATE DATABASE IF NOT EXISTS direct_sales_tree;
   ```

### Step-by-Step Fix

#### Step 1: Verify MySQL is Running

**Windows:**
- Open Services (Win + R → `services.msc`)
- Find "MySQL" service
- Make sure it's "Running"
- If not, right-click → Start

**Or use Command Line:**
```bash
# Check if MySQL service is running
sc query MySQL80
# or
net start MySQL80
```

#### Step 2: Check Database Credentials

Create or update `.env` file in project root:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password_here
DB_NAME=direct_sales_tree
```

#### Step 3: Create Database

Connect to MySQL:
```bash
mysql -u root -p
```

Then run:
```sql
CREATE DATABASE IF NOT EXISTS direct_sales_tree;
USE direct_sales_tree;
SHOW TABLES;
```

#### Step 4: Test Connection

Try connecting manually:
```bash
mysql -u root -p -h localhost -P 3306 direct_sales_tree
```

If this works, the credentials are correct.

#### Step 5: Run Setup Again

```bash
npm run setup-beehive
```

### Common Issues

#### Issue: "Access Denied"
- **Solution**: Check `DB_USER` and `DB_PASSWORD` in `.env`
- Make sure MySQL user has permissions

#### Issue: "Database doesn't exist"
- **Solution**: Create database first (see Step 3)

#### Issue: "Can't connect to MySQL server"
- **Solution**: 
  - Check MySQL service is running
  - Check firewall isn't blocking port 3306
  - Verify `DB_HOST` is correct (use `127.0.0.1` instead of `localhost` if needed)

#### Issue: "Connection timeout"
- **Solution**:
  - Increase timeout in connection config
  - Check MySQL is accepting connections: `netstat -an | findstr 3306`
  - Try `127.0.0.1` instead of `localhost`

### Alternative: Use XAMPP/WAMP/MySQL Workbench

If you're using XAMPP/WAMP:
1. Make sure MySQL is running in XAMPP Control Panel
2. Default credentials are usually:
   - User: `root`
   - Password: (empty/blank)
   - Port: `3306`

Update `.env`:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=direct_sales_tree
```

### Still Having Issues?

1. **Check MySQL Error Log**
   - Windows: Usually in `C:\ProgramData\MySQL\MySQL Server X.X\Data\`
   - Look for `.err` files

2. **Test with MySQL Workbench**
   - Connect using the same credentials
   - If it works there, the issue is with the Node.js connection

3. **Check Node.js MySQL2 Package**
   ```bash
   npm list mysql2
   # Should show version 3.x.x
   ```

4. **Restart Everything**
   - Stop MySQL service
   - Start MySQL service
   - Restart your Node.js server

### Need More Help?

Check the actual error message - it will tell you:
- `ETIMEDOUT` - Connection timeout (server not responding)
- `ECONNREFUSED` - Connection refused (server not running or wrong port)
- `ER_ACCESS_DENIED` - Wrong username/password
- `ER_BAD_DB_ERROR` - Database doesn't exist

Each error now provides detailed guidance on what to check.

