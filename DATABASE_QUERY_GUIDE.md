# How to Query Department Members - Database Guide

## 🔍 View Exact Department Members from Supabase

I can't directly access your Supabase database from this environment, but I can give you **exact SQL queries** to run that will show you all department members.

---

## 📊 **Query 1: Simple Department Members List**

**Best for**: Quick overview of all departments and who's in them

### Run this in Supabase SQL Editor:

```sql
-- All departments with their members
SELECT 
  jr.id as department_id,
  jr.name as department,
  jr.shift_start || ' - ' || jr.shift_end as shift_time,
  jr.is_hidden as hidden,
  u.display_name as member_name,
  u.username as username,
  CASE WHEN sra.is_primary = true THEN 'PRIMARY' ELSE 'SECONDARY' END as role_type,
  u.role as staff_role
FROM job_roles jr
LEFT JOIN staff_role_assignments sra ON jr.id = sra.job_role_id
LEFT JOIN users u ON sra.user_id = u.id
WHERE jr.is_hidden = false
ORDER BY jr.name, u.display_name;
```

**Output looks like:**
```
department_id | department  | shift_time      | member_name      | username       | role_type  | staff_role
──────────────────────────────────────────────────────────────────────────────────────────────────────
guide_001     | Guides      | 08:00 - 16:00  | Ahmed Hassan     | ahmed.hassan   | PRIMARY    | staff
guide_001     | Guides      | 08:00 - 16:00  | Maria Garcia     | maria.garcia   | PRIMARY    | staff
guide_001     | Guides      | 08:00 - 16:00  | John Smith       | john.smith     | SECONDARY  | staff
reception_01  | Reception   | 09:00 - 17:00  | Lisa Chen        | lisa.chen      | PRIMARY    | staff
```

---

## 📈 **Query 2: Department Summary (Member Counts)**

**Best for**: Understanding capacity and identifying empty/understaffed departments

### Run this in Supabase SQL Editor:

```sql
-- Department summary with member counts
SELECT 
  jr.id as department_id,
  jr.name as department,
  jr.shift_start || ' - ' || jr.shift_end as shift_time,
  COUNT(DISTINCT sra.user_id) as total_members,
  COUNT(DISTINCT CASE WHEN sra.is_primary = true THEN sra.user_id END) as primary_members,
  COUNT(DISTINCT CASE WHEN sra.is_primary = false THEN sra.user_id END) as secondary_members,
  CASE 
    WHEN COUNT(DISTINCT sra.user_id) = 0 THEN 'EMPTY'
    WHEN COUNT(DISTINCT sra.user_id) = 1 THEN 'UNDERSTAFFED'
    ELSE 'ACTIVE'
  END as status
FROM job_roles jr
LEFT JOIN staff_role_assignments sra ON jr.id = sra.job_role_id
WHERE jr.is_hidden = false
GROUP BY jr.id, jr.name, jr.shift_start, jr.shift_end
ORDER BY total_members DESC, jr.name;
```

**Output looks like:**
```
department    | total_members | primary_members | secondary_members | status
──────────────────────────────────────────────────────────────────────────
Guides        | 3             | 2               | 1                 | ACTIVE
Reception     | 2             | 1               | 1                 | ACTIVE
Drivers       | 1             | 1               | 0                 | UNDERSTAFFED
Admin         | 0             | 0               | 0                 | EMPTY
Support       | 0             | 0               | 0                 | EMPTY
```

---

## 👥 **Query 3: Detailed Member Report**

**Best for**: Complete audit with JSON member lists

### Run this in Supabase SQL Editor:

```sql
-- Detailed report with member aggregation
SELECT 
  jr.name as department,
  jr.shift_start || ' - ' || jr.shift_end as shift_time,
  COUNT(DISTINCT sra.user_id) as total_members,
  STRING_AGG(
    DISTINCT u.display_name || ' (' || u.username || ')' 
    || CASE WHEN sra.is_primary THEN ' [P]' ELSE ' [S]' END,
    ', '
  ) as member_list,
  CASE 
    WHEN COUNT(DISTINCT sra.user_id) = 0 THEN '⚠️ EMPTY'
    WHEN COUNT(DISTINCT sra.user_id) = 1 THEN '⚠️ 1 MEMBER'
    ELSE '✓ ACTIVE'
  END as status
FROM job_roles jr
LEFT JOIN staff_role_assignments sra ON jr.id = sra.job_role_id
LEFT JOIN users u ON sra.user_id = u.id
WHERE jr.is_hidden = false
GROUP BY jr.id, jr.name, jr.shift_start, jr.shift_end
ORDER BY COUNT(DISTINCT sra.user_id) DESC, jr.name;
```

**Output looks like:**
```
department  | shift_time     | total_members | member_list                                              | status
──────────────────────────────────────────────────────────────────────────────────────────────────────
Guides      | 08:00 - 16:00 | 3             | Ahmed Hassan (ahmed.hassan) [P], Maria Garcia... [P]... | ✓ ACTIVE
Reception   | 09:00 - 17:00 | 2             | Lisa Chen (lisa.chen) [P], Tom Wilson (tom.wilson) [S] | ✓ ACTIVE
Drivers     | 06:00 - 14:00 | 1             | Carlos Rodriguez (carlos.rodriguez) [P]                 | ⚠️ 1 MEMBER
Admin       | 09:00 - 17:00 | 0             | (no members)                                             | ⚠️ EMPTY
```

---

## 🔗 **Query 4: User-Centric View**

**Best for**: See which departments each person belongs to

### Run this in Supabase SQL Editor:

```sql
-- Show each user and all their department assignments
SELECT 
  u.display_name,
  u.username,
  u.role as staff_role,
  STRING_AGG(
    jr.name || CASE WHEN sra.is_primary THEN ' [PRIMARY]' ELSE ' [SECONDARY]' END,
    ', '
  ) as departments,
  COUNT(DISTINCT sra.job_role_id) as department_count
FROM users u
LEFT JOIN staff_role_assignments sra ON u.id = sra.user_id
LEFT JOIN job_roles jr ON sra.job_role_id = jr.id
WHERE u.is_active = true
GROUP BY u.id, u.display_name, u.username, u.role
ORDER BY COUNT(DISTINCT sra.job_role_id) DESC, u.display_name;
```

**Output looks like:**
```
display_name     | username       | staff_role | departments                    | department_count
──────────────────────────────────────────────────────────────────────────────────────────
Ahmed Hassan     | ahmed.hassan   | staff      | Guides [PRIMARY]               | 1
Maria Garcia     | maria.garcia   | staff      | Guides [PRIMARY], Admin [SEC]  | 2
Lisa Chen        | lisa.chen      | staff      | Reception [PRIMARY]            | 1
```

---

## 🎯 **How to Get the Results**

### Step 1: Open Supabase Console
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in the left sidebar

### Step 2: Create a New Query
1. Click **New Query**
2. Copy one of the SQL queries above
3. Click **Run** (or press Ctrl+Enter)

### Step 3: View Results
- Results appear in the table below
- Click **Copy** to copy results
- Click **Download** (if available) to export as CSV

---

## 📥 **Export the Results**

### Option A: Copy to Clipboard
1. Run the query
2. Click the copy icon in the results table
3. Paste into Excel, Word, or Notes

### Option B: Download as CSV
1. Run the query
2. Look for download icon in the results table
3. Save as `.csv` file

### Option C: Screenshot
1. Run the query
2. Take a screenshot of the results table
3. Share or save for reference

---

## 🔄 **Run All Queries Together**

To see a complete overview, run them in this order:

```sql
-- Query 2: Summary (gives you the high-level view)
SELECT 
  jr.name as department,
  COUNT(DISTINCT sra.user_id) as total_members,
  COUNT(DISTINCT CASE WHEN sra.is_primary = true THEN sra.user_id END) as primary,
  COUNT(DISTINCT CASE WHEN sra.is_primary = false THEN sra.user_id END) as secondary
FROM job_roles jr
LEFT JOIN staff_role_assignments sra ON jr.id = sra.job_role_id
WHERE jr.is_hidden = false
GROUP BY jr.id, jr.name
ORDER BY total_members DESC;

-- Query 1: Details (shows each person)
SELECT 
  jr.name,
  u.display_name,
  u.username,
  CASE WHEN sra.is_primary THEN '✓ PRIMARY' ELSE '○ SECONDARY' END as role_type
FROM job_roles jr
LEFT JOIN staff_role_assignments sra ON jr.id = sra.job_role_id
LEFT JOIN users u ON sra.user_id = u.id
WHERE jr.is_hidden = false AND u.id IS NOT NULL
ORDER BY jr.name, u.display_name;
```

---

## 📊 **What These Queries Tell You**

| Query | Purpose | Best Used For |
|-------|---------|--------------|
| Query 1 | Full list with roles | Detailed audit, documentation |
| Query 2 | Summary counts | Quick overview, capacity planning |
| Query 3 | Department-centric | Team-level analysis |
| Query 4 | User-centric | Individual assignments |

---

## 💡 **For Leave Restriction Setup**

Once you run Query 2, you'll see:
- How many people in each department
- Which departments are empty (⚠️)
- Which departments have only 1 person (risky)
- Which departments have good staffing

**Use this info to set leave limits:**
```
Guides (3 people)        → max 2 concurrent leaves
Reception (2 people)     → max 1 concurrent leave
Drivers (1 person)       → max 0 concurrent leaves (disable)
Admin (0 people)         → not applicable
```

---

## 🚀 **Quick Copy-Paste (All in One)**

Here's a single query that shows everything:

```sql
-- Complete Department & Members Overview
WITH dept_stats AS (
  SELECT 
    jr.id,
    jr.name,
    jr.shift_start,
    jr.shift_end,
    COUNT(DISTINCT sra.user_id) as member_count,
    STRING_AGG(u.display_name, ', ') as members
  FROM job_roles jr
  LEFT JOIN staff_role_assignments sra ON jr.id = sra.job_role_id
  LEFT JOIN users u ON sra.user_id = u.id
  WHERE jr.is_hidden = false
  GROUP BY jr.id, jr.name, jr.shift_start, jr.shift_end
)
SELECT 
  name as "Department",
  member_count as "Total Members",
  CASE 
    WHEN member_count = 0 THEN '⚠️ EMPTY'
    WHEN member_count = 1 THEN '⚠️ 1 MEMBER'
    ELSE '✓ ACTIVE'
  END as "Status",
  members as "Member List",
  shift_start || ' - ' || shift_end as "Shift"
FROM dept_stats
ORDER BY member_count DESC, name;
```

Run this once and you get everything in one view!

---

## ✅ **Next Steps**

1. **Open Supabase SQL Editor**
2. **Run Query 2 or the "Quick Copy-Paste" query**
3. **Review the results** - you'll see all departments and member counts
4. **Use this data** for setting leave restriction limits
5. **Share with team** - copy results to document or spreadsheet

---

**Ready? Go to Supabase → SQL Editor → Copy-Paste one of these queries!** 🚀
