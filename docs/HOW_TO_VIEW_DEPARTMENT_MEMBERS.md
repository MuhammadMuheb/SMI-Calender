# How to View Department Members - Quick Guide

I've created a component that shows you **exactly which people belong to which field/department** in your system.

---

## 🚀 **Option 1: View in the App (Easiest)**

### Step 1: Add the Component to Your Settings Page

Edit: `src/pages/SettingsPage.tsx` (or wherever your settings are)

```jsx
import { DepartmentMembersExport } from '../components/DepartmentMembersExport';

export function SettingsPage() {
  return (
    <div>
      {/* ... other settings ... */}
      
      <h2>Department Members</h2>
      <DepartmentMembersExport />
    </div>
  );
}
```

### Step 2: Open the Settings Page

- Navigate to Settings in your app
- Scroll to "Department Members" section
- You'll see:
  - ✅ All departments listed
  - ✅ Total members per department
  - ✅ Each person's name and username
  - ✅ Whether they're primary or secondary in that role
  - ✅ Download buttons (CSV, Markdown)

---

## 💻 **Option 2: Query via Database**

### Direct SQL Query

Run this in Supabase SQL editor:

```sql
SELECT 
  jr.id,
  jr.name AS "Department",
  jr.shift_start,
  jr.shift_end,
  COUNT(DISTINCT sra.user_id) AS "Total Members",
  ARRAY_AGG(
    json_build_object(
      'name', u.display_name,
      'username', u.username,
      'primary', sra.is_primary
    ) ORDER BY u.display_name
  ) AS "Members"
FROM job_roles jr
LEFT JOIN staff_role_assignments sra ON jr.id = sra.job_role_id
LEFT JOIN users u ON sra.user_id = u.id
WHERE jr.is_hidden = false
GROUP BY jr.id, jr.name, jr.shift_start, jr.shift_end
ORDER BY COUNT(DISTINCT sra.user_id) DESC, jr.name;
```

This gives you a table like:

```
Department    | Total Members | Members
──────────────────────────────────────
Guides        | 3             | Ahmed, Maria, John
Reception     | 2             | Lisa, Tom
Drivers       | 1             | Carlos
Admin         | 0             | (empty)
```

---

## 📊 **What You'll See**

The component displays a complete report with:

### Summary Statistics
```
┌─────────────────┐
│ Total Depts: 6  │
│ With Members: 4 │
│ Empty: 2        │
│ Total Staff: 9  │
└─────────────────┘
```

### For Each Department
```
📌 Guides
   Status: ✓ ACTIVE
   Total Members: 3
   Shift: 08:00 - 16:00
   Members:
     • Ahmed Hassan (ahmed.hassan) [PRIMARY]
     • Maria Garcia (maria.garcia) [PRIMARY]
     • John Smith (john.smith) [SECONDARY]

📌 Reception
   Status: ✓ ACTIVE
   Total Members: 2
   Shift: 09:00 - 17:00
   Members:
     • Lisa Chen (lisa.chen) [PRIMARY]
     • Tom Wilson (tom.wilson) [SECONDARY]

⚠️ Admin
   Status: ⚠️ EMPTY
   Total Members: 0
```

### Download Options
- 📄 **Download as Markdown** - For documentation
- 📊 **Download as CSV** - For Excel/spreadsheets
- 📋 **Copy to Clipboard** - To paste elsewhere

---

## 🎯 **What's Included in the Report**

For each department you'll see:

| Info | Purpose |
|------|---------|
| Department Name | Which field/department |
| Total Members | How many people |
| Status | ACTIVE (✓) or EMPTY (⚠️) |
| Shift Time | Working hours |
| Member List | Names and usernames |
| Role Type | PRIMARY or SECONDARY assignment |

---

## 📋 **Example Output**

### CSV Format
```
Department,Total Members,Status,Member Names,Member Usernames
"Guides",3,"ACTIVE","Ahmed Hassan; Maria Garcia; John Smith","ahmed.hassan; maria.garcia; john.smith"
"Reception",2,"ACTIVE","Lisa Chen; Tom Wilson","lisa.chen; tom.wilson"
"Drivers",1,"ACTIVE","Carlos Rodriguez","carlos.rodriguez"
"Admin",0,"EMPTY","None","None"
```

### Markdown Format
```markdown
# Department Membership Report

Generated: 9/19/2026, 2:30 PM

**Summary**
- Total Departments: 6
- Departments with Members: 4
- Empty Departments: 2
- Total Unique Members: 9

## Guides
- **Status**: ACTIVE ✓
- **Total Members**: 3
- **Shift**: 08:00 - 16:00
- **Members**:
  - Ahmed Hassan (ahmed.hassan) [PRIMARY]
  - Maria Garcia (maria.garcia) [PRIMARY]
  - John Smith (john.smith) [SECONDARY]
```

---

## ⚡ **Quick Setup**

1. Add this to your Settings page:
   ```jsx
   import { DepartmentMembersExport } from '../components/DepartmentMembersExport';
   
   <DepartmentMembersExport />
   ```

2. That's it! The component automatically:
   - ✅ Fetches all departments from `AppDataContext`
   - ✅ Fetches all members from `AppDataContext`
   - ✅ Fetches all role assignments from `AppDataContext`
   - ✅ Displays formatted results
   - ✅ Allows downloads

---

## 📝 **What This Data Is Used For**

This information is essential for implementing the department leave restrictions:

1. **Set Leave Limits** - Know how many people are in each department to set realistic max limits
   - Small departments (1-2 people): max leave = 0-1
   - Medium departments (3-5 people): max leave = 1-2
   - Large departments (5+ people): max leave = 2-3

2. **Identify Risks** - See which departments have:
   - ⚠️ Zero members (needs attention)
   - ⚠️ Only 1 member (single point of failure)
   - ✓ Good staffing (can handle more leaves)

3. **Configure Restrictions** - Use actual numbers when setting up leave caps

---

## 🔄 **Data Stays Current**

Since the component uses `AppDataContext`, it will:
- ✅ Update automatically when you add/remove members
- ✅ Update automatically when you change primary/secondary assignments
- ✅ Always show real-time data (no manual refresh needed)

---

## ✨ **Features**

✅ Beautiful formatted display
✅ Summary statistics with color coding
✅ Download as CSV (for Excel)
✅ Download as Markdown (for docs)
✅ Copy to clipboard
✅ JSON data preview
✅ Shows PRIMARY vs SECONDARY assignments
✅ Flags empty departments
✅ Responsive design

---

## 🚀 **Next Steps**

1. Add the component to your Settings page
2. Open your app and navigate to Settings
3. See the complete list of departments and members
4. Use this information to:
   - Understand your current staffing
   - Decide on leave restriction limits
   - Identify understaffed departments

---

**The component file is ready to use: `src/components/DepartmentMembersExport.tsx`**
