#!/bin/bash
# Test and shadow databases for Prisma Migrate, owned by the application user.
set -euo pipefail
mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" <<SQL
CREATE DATABASE IF NOT EXISTS access_manager_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS access_manager_shadow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON access_manager_test.* TO '${MYSQL_USER}'@'%';
GRANT ALL PRIVILEGES ON access_manager_shadow.* TO '${MYSQL_USER}'@'%';
FLUSH PRIVILEGES;
SQL
