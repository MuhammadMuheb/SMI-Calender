# Calendar Engine — Manual Test Cases

## Test 1: Month starting on Wednesday (April 2026)

April 2026 starts on a Wednesday (day of week = 2, Mon-indexed).

**Expected grid:**
- Row 1: Mon 30 Mar (grayed), Tue 31 Mar (grayed), **Wed 1**, Thu 2, Fri 3, Sat 4, Sun 5
- Row 2: Mon 6, ..., Sun 12
- ...
- Last row: Mon 27, Tue 28, Wed 29, Thu 30, Fri 1 May (grayed), Sat 2 May (grayed), Sun 3 May (grayed)

**Verify:**
- Leading days from March are shown and grayed out
- Trailing days from May complete the last week
- All 7 columns filled in every row
- Total tiles = 35 (5 weeks × 7)
- April 25 shows holiday marker (Liberation Day)

## Test 2: Month starting on Sunday (March 2026)

March 2026 starts on a Sunday (day of week = 6, Mon-indexed).

**Expected grid:**
- Row 1: Mon 23 Feb (grayed), Tue 24, Wed 25, Thu 26, Fri 27, Sat 28 (grayed), **Sun 1**
- Row 2: Mon 2, ..., Sun 8
- ...
- Last row includes trailing days from April

**Verify:**
- 6 leading days from February are shown
- Sunday March 1 appears in the last column of row 1
- Sun column is always rightmost
- Weekends (Sat/Sun) have muted date color
- Total tiles = 42 (6 weeks × 7)

## Test 3: February in a leap year (February 2028)

February 2028 has 29 days (2028 is a leap year). Feb 1 is a Tuesday.

**Expected grid:**
- Row 1: Mon 31 Jan (grayed), **Tue 1**, Wed 2, Thu 3, Fri 4, Sat 5, Sun 6
- ...
- Row 5: Mon 28, Tue 29, Wed 1 Mar (grayed), Thu 2 Mar, Fri 3 Mar, Sat 4 Mar, Sun 5 Mar

**Verify:**
- Feb 29 exists and is clickable
- No date duplication
- Trailing March days fill the last row
- Total tiles = 35 (5 weeks × 7)
- Grid does NOT show 6 rows (only 5 needed)

## How to test

1. Run the app: `npm run dev`
2. Login as admin (admin / 1111) — to see rich view
3. Navigate to Calendar tab
4. Use the prev/next arrows to reach the test months
5. Check each grid against the expectations above
6. Resize browser to 390px width to test mobile layout
