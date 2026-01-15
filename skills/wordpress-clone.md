# WordPress Clone Skill

Clone a WordPress/WooCommerce site from production to local Herd Pro environment with full staging configuration.

## Overview

This skill automates the complete process of cloning a WordPress site from a production server to a local Herd Pro development environment. It handles file synchronization, database migration, URL updates, staging configuration, and verification.

## Prerequisites

- Herd Pro installed and running
- SSH access to production server
- MySQL/MariaDB running locally (via Herd)
- WP-CLI available (`wp` command)

## Process

### Phase 1: Information Gathering

Gather the following information from the user:

1. **Site name** for local development (e.g., "taooftea")
   - This will become `{sitename}.test` locally
2. **SSH connection string** (e.g., `user@host.com` or full ssh command)
3. **Remote site path** (absolute path to WordPress root on production)
4. **Remote database credentials** (name, user, password)
5. **Git repository** (optional - for version-controlled theme)
6. **Theme to track** (optional - which theme folder should be git-controlled)

### Phase 2: Directory Setup

1. Create local directory: `/Users/ray/Sites/{sitename}/`
2. Verify parent directory structure matches other sites

### Phase 3: File Synchronization

**CRITICAL: Verify file counts after each rsync operation**

1. **WordPress Core Files**:
   ```bash
   rsync -avz {ssh}:{remote_path}/wp-admin /Users/ray/Sites/{sitename}/
   rsync -avz {ssh}:{remote_path}/wp-includes /Users/ray/Sites/{sitename}/
   rsync -avz {ssh}:{remote_path}/*.php /Users/ray/Sites/{sitename}/
   ```
   - Verify wp-includes has 200+ PHP files
   - Verify wp-admin exists and has subdirectories

2. **Themes**:
   ```bash
   rsync -avz {ssh}:{remote_path}/wp-content/themes/ /Users/ray/Sites/{sitename}/wp-content/themes/
   ```
   - Verify parent theme exists
   - Verify active theme exists
   - Check file counts match expectations

3. **Plugins**:
   ```bash
   rsync -avz {ssh}:{remote_path}/wp-content/plugins/ /Users/ray/Sites/{sitename}/wp-content/plugins/
   ```
   - Note: This may be large (500MB+), show progress
   - Verify plugin count matches production

4. **Uploads** (optional, ask user):
   ```bash
   rsync -avz {ssh}:{remote_path}/wp-content/uploads/ /Users/ray/Sites/{sitename}/wp-content/uploads/
   ```
   - Warn: Can be very large
   - Offer to skip or limit by date

5. **wp-salt.php**:
   ```bash
   scp {ssh}:{remote_path}/wp-salt.php /Users/ray/Sites/{sitename}/
   ```

### Phase 4: Git Theme Setup (if applicable)

If user provided a git repository:

1. Move existing theme folder to backup:
   ```bash
   mv /Users/ray/Sites/{sitename}/wp-content/themes/{theme_name} \
      /Users/ray/Sites/{sitename}/wp-content/themes/{theme_name}.backup
   ```

2. Clone git repository:
   ```bash
   cd /Users/ray/Sites/{sitename}/wp-content/themes/
   git clone {git_repo} {theme_name}
   ```

3. Verify theme files match backup (compare key files like functions.php, style.css)

### Phase 5: Database Migration

1. **Export from production**:
   ```bash
   ssh {ssh} "mysqldump -u {db_user} -p'{db_pass}' {db_name} | gzip" > /tmp/{sitename}_db.sql.gz
   ```
   - Note the file size
   - Verify it's not empty (should be multiple MB compressed)

2. **Create local database**:
   ```bash
   mysql -h 127.0.0.1 -u root -e "DROP DATABASE IF EXISTS {sitename};"
   mysql -h 127.0.0.1 -u root -e "CREATE DATABASE {sitename} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   ```

3. **Import database**:
   ```bash
   gunzip < /tmp/{sitename}_db.sql.gz | mysql -h 127.0.0.1 -u root {sitename}
   ```

4. **Verify import**:
   ```bash
   mysql -h 127.0.0.1 -u root {sitename} -e "SELECT COUNT(*) FROM wp_posts;"
   mysql -h 127.0.0.1 -u root {sitename} -e "SELECT COUNT(*) FROM wp_options;"
   ```
   - Should have hundreds/thousands of rows

5. **Update URLs** (determine production URL first):
   ```bash
   wp --path=/Users/ray/Sites/{sitename} search-replace 'https://{prod_domain}' 'https://{sitename}.test' --all-tables
   wp --path=/Users/ray/Sites/{sitename} search-replace 'http://{prod_domain}' 'https://{sitename}.test' --all-tables
   ```

### Phase 6: Configuration Files

1. **Create wp-config.php**:
   - Copy from production, then modify:
   - `DB_NAME` → `{sitename}`
   - `DB_USER` → `root`
   - `DB_PASSWORD` → `''` (empty)
   - `DB_HOST` → `127.0.0.1`
   - `WP_CACHE` → `false`
   - `WP_REDIS_DISABLED` → `true`
   - `DOMAIN_CURRENT_SITE` → `{sitename}.test`
   - **Add staging settings**:
     ```php
     // Set environment type to local
     define( 'WP_ENVIRONMENT_TYPE', 'local' );

     // WooCommerce demo mode (optional safety)
     define( 'WOOCOMMERCE_DEMO_MODE', true );
     ```

2. **Fix wp-salt.php path**:
   - Change `require 'wp-salt.php';` to `require __DIR__ . '/wp-salt.php';`

### Phase 7: HTTPS Setup

```bash
herd secure {sitename}
```

Verify certificate installation successful.

### Phase 8: Staging Mode Configuration

**DO NOT modify plugin activation state - use production state**

1. **Install email blocking plugin**:
   ```bash
   wp --path=/Users/ray/Sites/{sitename} plugin install disable-emails --activate
   ```

2. **Enable WooCommerce test modes**:
   ```bash
   # WooCommerce Payments
   wp --path=/Users/ray/Sites/{sitename} option patch update woocommerce_woocommerce_payments_settings test_mode yes

   # PayPal
   wp --path=/Users/ray/Sites/{sitename} option patch update woocommerce_paypal_settings testmode yes

   # PayPal Pro Payflow
   wp --path=/Users/ray/Sites/{sitename} option patch update woocommerce_paypal_pro_payflow_settings testmode yes
   ```

3. **Verify payment gateways are in test mode**:
   ```bash
   wp --path=/Users/ray/Sites/{sitename} option get woocommerce_woocommerce_payments_settings --format=json | jq -r '.test_mode'
   ```

### Phase 9: Verification & Testing

**CRITICAL: Actually test the site, don't just assume it works**

1. **Check site loads**:
   ```bash
   curl -I https://{sitename}.test
   ```
   - Should return HTTP/2 200

2. **Verify homepage title**:
   ```bash
   curl -s https://{sitename}.test | grep -o '<title>.*</title>'
   ```

3. **Check for PHP errors**:
   - Load homepage in browser
   - Check for fatal errors, warnings
   - Verify theme loads correctly
   - Check one product page (for WooCommerce sites)

4. **Verify plugin count**:
   ```bash
   wp --path=/Users/ray/Sites/{sitename} plugin list --status=active --format=count
   ```
   - Compare to production count

5. **Test ACF** (if site uses Advanced Custom Fields):
   - Verify `get_field()` function works
   - No undefined function errors

6. **Check staging configuration**:
   ```bash
   wp --path=/Users/ray/Sites/{sitename} eval 'echo wp_get_environment_type();'
   wp --path=/Users/ray/Sites/{sitename} plugin is-active disable-emails && echo "Emails blocked"
   ```

### Phase 10: Final Report

Provide user with summary:

```
✅ WordPress Clone Complete: {sitename}

📍 Local URL: https://{sitename}.test
📁 Local Path: /Users/ray/Sites/{sitename}/
🗄️  Database: {sitename} (local MySQL)

🔧 Configuration:
   - Environment: local
   - Emails: BLOCKED (disable-emails plugin active)
   - WooCommerce Payments: TEST MODE
   - PayPal: TEST MODE
   - Active Plugins: {count}
   - Active Theme: {theme_name}

✅ Verified:
   - Site loads (HTTP 200)
   - Homepage renders
   - Plugins active
   - Database connected
   - HTTPS configured

{if git repo}
🔄 Git Theme:
   - Repository: {git_repo}
   - Location: wp-content/themes/{theme_name}/
   - Original backed up to: {theme_name}.backup
{endif}

⚠️  Remember:
   - This is a STAGING environment
   - All payments are in TEST mode
   - No emails will be sent
   - Don't commit sensitive data to git
```

## Error Handling

### Common Issues & Solutions

1. **504 Gateway Timeout**:
   - Restart Herd: `herd restart`
   - Check for infinite loops in theme/plugins
   - Verify database connection

2. **Missing files after rsync**:
   - Re-run rsync for specific directory
   - Check SSH permissions
   - Verify source path is correct

3. **get_field() undefined**:
   - Verify ACF Pro plugin is active
   - Check plugin files exist

4. **WP-CLI errors**:
   - Verify wp-config.php paths are correct
   - Check wp-salt.php uses `__DIR__`
   - Ensure database exists

5. **Plugin activation issues**:
   - DO NOT manually activate/deactivate
   - Use production database state
   - Only add staging-specific plugins (disable-emails)

## Best Practices

1. **Never modify production during clone** - Read-only operations only
2. **Verify at each step** - File counts, database rows, HTTP responses
3. **Test before reporting success** - Load site in browser
4. **Preserve production plugin state** - Don't deactivate plugins
5. **Use WP-CLI over direct DB edits** - Safer and more reliable
6. **Document any deviations** - Note any manual steps required
7. **Keep credentials secure** - Don't log passwords

## Maintenance

After initial clone:

- Pull latest from git theme repo regularly
- Periodically refresh database from production
- Update plugins via WP-CLI when needed
- Keep Herd Pro updated

## Notes

- Database size typically 50-200MB compressed
- Plugins directory typically 500MB-1GB
- Uploads can be 1GB-10GB+ (consider excluding)
- Full clone typically takes 5-15 minutes depending on size
- Always verify each step completes successfully before proceeding
