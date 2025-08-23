# 🔍 DATABASE VISUALIZATION SETUP

## 1. PgAdmin - PostgreSQL Admin Tool (RECOMMENDED)

### Download & Install:
- Download: https://www.pgadmin.org/download/pgadmin-4-windows/
- Install the Windows version

### Connection Setup:
1. Open PgAdmin
2. Right-click "Servers" → Add Server
3. General tab:
   - Name: "Rebly SmartPrice DB"
4. Connection tab:
   - Host: 34.59.89.111
   - Port: 5432
   - Database: rebly_smartprice_stg
   - Username: rebly_smartprice_user
   - Password: [your password]

### Features you'll get:
- Visual table browser
- ER Diagram generator
- Query tool with syntax highlighting
- Data viewer/editor
- Database statistics
- Relationship visualization

---

## 2. DBeaver - Universal Database Tool (FREE)

### Download & Install:
- Download: https://dbeaver.io/download/
- Choose Community Edition (free)

### Connection Setup:
1. New Database Connection
2. Select PostgreSQL
3. Fill connection details (same as above)

### Features:
- ER diagrams
- Visual query builder
- Data export/import
- Schema browser
- Relationship viewer

---

## 3. DataGrip (JetBrains - PAID but excellent)

### If you have JetBrains license:
- Download DataGrip
- Connect to PostgreSQL
- Best-in-class database IDE

---

## 4. Web-based Solutions

### Option A: Adminer (Lightweight web interface)
```bash
# Run via Docker
docker run --rm -p 8080:8080 adminer
# Access: http://localhost:8080
```

### Option B: pgweb (Modern web-based)
```bash
# Install
go install github.com/sosedoff/pgweb@latest

# Run
pgweb --host=34.59.89.111 --user=rebly_smartprice_user --db=rebly_smartprice_stg
```

---

## 5. VS Code Extensions

### PostgreSQL Extension:
1. Install "PostgreSQL" extension by Chris Kolkman
2. Add connection in VS Code
3. Browse tables directly in VS Code

---

## 🎯 RECOMMENDATION FOR YOU:

**Start with PgAdmin** - it's specifically designed for PostgreSQL and gives you:
- Complete visual overview
- ER diagram generation
- Table relationships
- Data browsing
- Query execution
- Schema visualization

**Connection Details for PgAdmin:**
- Host: 34.59.89.111
- Port: 5432  
- Database: rebly_smartprice_stg
- Username: rebly_smartprice_user
- Password: [your database password]

Once connected, you can:
1. Browse all tables visually
2. See table relationships
3. Generate ER diagrams
4. Run the SQL queries we created
5. Export data to various formats
