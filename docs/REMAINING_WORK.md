# SMI Calendar - Remaining Work & Missing Features

**Last Updated:** September 19, 2026  
**Status:** Implementation Phase - Features Ready for UI Integration

---

## 🎯 CRITICAL BLOCKERS (Must Fix Before Production)

### 1. **Firestore Security Rules** ⚠️ NOT CONFIGURED
**Priority:** 🔴 CRITICAL  
**Impact:** Data access not protected  
**Status:** Missing

Currently using permissive rules. Need to implement:
```
- Users can only read/write their own documents
- Managers can read team members' leave requests
- Super_admin can read/write all documents
- Role-based collection access control
```

**Action:** Update `firestore.rules` with proper RLS
**Estimated Time:** 2-3 hours

---

### 2. **AppDataContext Not Using Firestore** ⚠️ STILL IN-MEMORY
**Priority:** 🔴 CRITICAL  
**Impact:** Users data, staffing rules, role assignments lost on refresh  
**Status:** Partially Done

**What's Missing:**
- [ ] Real-time listeners for users collection
- [ ] Real-time listeners for staffing_rules collection  
- [ ] Real-time listeners for role_assignments collection
- [ ] Real-time listeners for special_days collection
- [ ] Migration of AppDataContext to use firestoreService

**Files Affected:**
- `src/context/AppDataContext.tsx` - Still uses in-memory state
- `src/services/firestoreService.ts` - Needs users/staffing_rules queries

**Estimated Time:** 4-5 hours

---

### 3. **NotificationContext Not Using Firestore** ⚠️ STILL IN-MEMORY
**Priority:** 🔴 CRITICAL  
**Impact:** Notifications lost on refresh  
**Status:** Partially Done

**What's Missing:**
- [ ] Real-time listeners for notifications collection
- [ ] Notification read/unread status sync
- [ ] Migration of NotificationContext to firestoreService

**Files Affected:**
- `src/context/NotificationContext.tsx` - Still uses in-memory state

**Estimated Time:** 2-3 hours

---

### 4. **SwapContext Not Using Firestore** ⚠️ STILL IN-MEMORY
**Priority:** 🔴 CRITICAL  
**Impact:** Swap proposals lost on refresh  
**Status:** Partially Done

**What's Missing:**
- [ ] Real-time listeners for swaps collection
- [ ] Swap status updates
- [ ] Migration of SwapContext to firestoreService

**Files Affected:**
- `src/context/SwapContext.tsx` - Still uses in-memory state

**Estimated Time:** 2-3 hours

---

### 5. **TaskContext Not Using Firestore** ⚠️ STILL IN-MEMORY
**Priority:** 🔴 CRITICAL  
**Impact:** Tasks lost on refresh  
**Status:** Partially Done

**What's Missing:**
- [ ] Real-time listeners for tasks collection
- [ ] Task CRUD operations via Firestore
- [ ] Migration of TaskContext to firestoreService

**Files Affected:**
- `src/context/TaskContext.tsx` - Still uses in-memory state

**Estimated Time:** 2-3 hours

---

## 🟠 HIGH PRIORITY (Block Feature Completeness)

### 6. **UI Component Integrations** - Ready But Not Wired
**Priority:** 🟠 HIGH  
**Status:** Partially Complete

#### 6.1 ErrorBoundary Not Integrated
- [ ] Wrap App.tsx with ErrorBoundary
- [ ] Test error handling in all pages

**Estimated Time:** 1 hour

#### 6.2 Push Notifications Not Wired
- [ ] Initialize `usePushNotifications` in AuthContext
- [ ] Add permission request UI on first login
- [ ] Add push settings toggle in SettingsPage
- [ ] Test subscription flow

**Estimated Time:** 3-4 hours

#### 6.3 Accessibility Features Not Integrated  
- [ ] Use `useAccessibility` in Modal components
- [ ] Add Escape key handling to all modals
- [ ] Add ARIA labels to interactive elements
- [ ] Test keyboard navigation

**Estimated Time:** 4-5 hours

#### 6.4 Multi-day Leave Not in UI
- [ ] Update RequestFormModal with date range picker
- [ ] Add date range input component
- [ ] Connect to `multiDayLeaveService`
- [ ] Show working day count in preview

**Estimated Time:** 3-4 hours

---

### 7. **Swap-Leave Auto-Integration** - Function Ready, UI Not Updated
**Priority:** 🟠 HIGH  
**Status:** Function Deployed, UI Missing

**What's Missing:**
- [ ] Update SwapSection UI to show automatic leave creation
- [ ] Update swap proposal form to mention automatic leave
- [ ] Test complete swap workflow

**Files to Update:**
- `src/pages/SwapSection.tsx`
- Swap proposal modals

**Estimated Time:** 2-3 hours

---

### 8. **Italian Locale Not Applied Throughout UI** 
**Priority:** 🟠 HIGH  
**Status:** Framework Ready, Application Incomplete

**What's Missing:**
- [ ] Use `useLang().t()` in ALL text strings
- [ ] Apply translations to:
  - Dashboard headings and labels
  - Modal titles and buttons
  - Error messages
  - Notification text
  - Admin panel pages
  - Settings labels
  - Calendar UI

**Files to Update:**
- Almost every `.tsx` page file needs i18n keys

**Estimated Time:** 8-10 hours (low-priority task)

---

## 🟡 MEDIUM PRIORITY (Polish & Completeness)

### 9. **Check-In & Attendance Features** - Pages Exist but Maybe Incomplete
**Priority:** 🟡 MEDIUM  
**Status:** Unknown - Need to Verify

**Pages That Exist:**
- `src/components/CheckInBoard.tsx`
- `src/components/AttendanceMonitor.tsx`
- `src/components/AttendanceSummary.tsx`

**Issues:**
- [ ] Verify Firestore integration
- [ ] Check real-time listener setup
- [ ] Test check-in/checkout workflow

**Estimated Time:** 3-4 hours

---

### 10. **Tour Assignments Feature** - Recently Added, Needs Testing
**Priority:** 🟡 MEDIUM  
**Status:** Partially Implemented

**Known Issues from Git History:**
- Tour assignments feature added in recent commits
- Supabase migration scripts exist but may be outdated

**What to Verify:**
- [ ] Tour assignments UI working
- [ ] Firestore collection setup
- [ ] API integration complete
- [ ] Real-time updates working

**Estimated Time:** 2-3 hours

---

### 11. **Notification Delivery Not Fully Wired**
**Priority:** 🟡 MEDIUM  
**Status:** Service Ready, UI Incomplete

**What's Missing:**
- [ ] Connect `pushNotificationService` to notification creation
- [ ] Send push when leave request approved
- [ ] Send push when swap proposed/accepted
- [ ] Send push for tomorrow's summary
- [ ] Handle push notification clicks

**Estimated Time:** 3-4 hours

---

### 12. **Coffee Leaderboard Page** - Admin Feature
**Priority:** 🟡 MEDIUM  
**Status:** Exists but May Be Incomplete

**File:** `src/pages/admin/CoffeeLeaderboard.tsx`

**Issues:**
- [ ] Verify it's accessible from AdminPanel
- [ ] Check if coffee tracking logic exists
- [ ] Test data collection

**Estimated Time:** 1-2 hours

---

## 🔵 LOWER PRIORITY (Feature Enhancements)

### 13. **Date Range Support in Calendar** - Partial Implementation
**Priority:** 🔵 LOW  
**Status:** Utilities Ready, UI Not Updated

**What's Missing:**
- [ ] Calendar UI doesn't support multi-day highlights
- [ ] Day detail modal doesn't support date range selection
- [ ] Leave request form needs date range picker component

**Estimated Time:** 4-5 hours

---

### 14. **Real-time Notifications in UI**
**Priority:** 🔵 LOW  
**Status:** Framework Ready, Not Integrated

**What's Missing:**
- [ ] Toast notifications for leave approvals
- [ ] Toast for swap proposals
- [ ] Toast for admin actions
- [ ] Sound/vibration on notification

**Estimated Time:** 2-3 hours

---

### 15. **Loading States & Spinners**
**Priority:** 🔵 LOW  
**Status:** Not Implemented

**Missing:**
- [ ] Loading spinner component
- [ ] Loading states for async operations
- [ ] Skeleton screens for data loading

**Estimated Time:** 2-3 hours

---

### 16. **Animations & Transitions**
**Priority:** 🔵 LOW  
**Status:** Not Implemented

**Missing:**
- [ ] Page transition animations
- [ ] Modal slide-up animation
- [ ] List animations on add/remove
- [ ] Smooth balance transitions

**Estimated Time:** 3-4 hours

---

### 17. **Dark Mode Refinements**
**Priority:** 🔵 LOW  
**Status:** Dark-only, Light Mode Not Offered

**Note:** Currently dark-only which is fine. Light mode could be added later.

---

### 18. **Offline Mode with Service Worker**
**Priority:** 🔵 LOW  
**Status:** Service Worker Exists, Offline Caching Not Implemented

**Missing:**
- [ ] Cache strategy setup
- [ ] Offline fallback UI
- [ ] Sync queue for offline changes

**Estimated Time:** 4-5 hours

---

## 📋 CONFIGURATION & SETUP

### 19. **Environment Variables** ⚠️ MISSING
**Priority:** 🟠 HIGH  
**Status:** Incomplete

**Missing .env.local entries:**
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_VAPID_PUBLIC_KEY=...
```

**Current Status:** Firebase config is hardcoded in `src/lib/firebase.ts`

**Action:** Move to environment variables for security

**Estimated Time:** 1-2 hours

---

### 20. **Database Indexes** - Firestore Optimization
**Priority:** 🟠 HIGH  
**Status:** Not Fully Configured

**Missing Indexes:**
- [ ] leave_requests: (userId, status, date)
- [ ] leave_requests: (date, status)
- [ ] notifications: (userId, createdAt desc)
- [ ] swaps: (status, createdAt desc)
- [ ] tasks: (assignedTo, dueDate)
- [ ] push_subscriptions: (userId)

**Current File:** `firestore.indexes.json`

**Estimated Time:** 1 hour

---

## 🧪 TESTING & VERIFICATION

### 21. **End-to-End Workflows Not Tested**
**Priority:** 🟠 HIGH  
**Status:** Need Manual Testing

**Critical Workflows to Test:**
- [ ] Complete leave request workflow (submit → approve → appear in calendar)
- [ ] Complete swap workflow (propose → accept → leaves created)
- [ ] Manager approval workflow
- [ ] Vacation adjustment workflow
- [ ] Multi-day leave request (5+ days)
- [ ] Push notification delivery
- [ ] Real-time sync across browser tabs

**Estimated Time:** 4-6 hours

---

### 22. **Accessibility Testing**
**Priority:** 🟡 MEDIUM  
**Status:** Not Done

**Need to Test:**
- [ ] Keyboard navigation on all pages
- [ ] Screen reader compatibility
- [ ] Tab order consistency
- [ ] Color contrast ratios
- [ ] ARIA labels completeness

**Tools Needed:**
- Screen reader (NVDA, JAWS)
- Accessibility checker extension
- Keyboard-only testing

**Estimated Time:** 4-5 hours

---

### 23. **Mobile Responsiveness Verification**
**Priority:** 🟡 MEDIUM  
**Status:** Needs Testing

**Device Testing Needed:**
- [ ] iPhone 12/13/14/15
- [ ] Android phones (various sizes)
- [ ] Tablets (iPad, Android tablets)
- [ ] Landscape orientation
- [ ] Touch interactions
- [ ] Safe area insets

**Estimated Time:** 3-4 hours

---

## 📊 ESTIMATED TOTAL REMAINING WORK

| Category | Hours | Priority |
|----------|-------|----------|
| **Critical Firestore Migrations** | 18-20 | 🔴 CRITICAL |
| **UI Component Integrations** | 15-18 | 🟠 HIGH |
| **Security & Configuration** | 3-4 | 🟠 HIGH |
| **Testing & Verification** | 10-15 | 🟠 HIGH |
| **Localization (i18n)** | 8-10 | 🟡 MEDIUM |
| **Polish & Enhancements** | 15-20 | 🔵 LOW |
| **Offline & Caching** | 4-5 | 🔵 LOW |
| **Animations & UX** | 5-7 | 🔵 LOW |
| **TOTAL** | **78-99 hours** | — |

---

## 🚀 RECOMMENDED COMPLETION ORDER

### Phase 1: Make App Production-Ready (Days 1-3)
1. Firestore Security Rules setup
2. Migrate remaining contexts to Firestore (AppData, Notification, Swap, Task)
3. Integration testing
4. Environment variable setup
5. Database index configuration

**Effort:** ~20-25 hours

### Phase 2: Complete Feature Integrations (Days 4-5)
1. ErrorBoundary integration
2. Push notifications wiring
3. Accessibility implementation
4. Multi-day leave UI
5. Swap-leave auto-integration

**Effort:** ~15-18 hours

### Phase 3: Polish & Launch (Days 6-7)
1. Localization application (i18n)
2. End-to-end testing
3. Mobile responsiveness
4. Accessibility testing
5. Notification delivery

**Effort:** ~18-25 hours

### Phase 4: Post-Launch (Optional)
1. Loading states & animations
2. Offline mode
3. Performance optimization
4. Additional monitoring

**Effort:** ~15-20 hours

---

## 📝 QUICK REFERENCE

### Files That Still Need Firestore Integration
- `src/context/AppDataContext.tsx`
- `src/context/NotificationContext.tsx`
- `src/context/SwapContext.tsx`
- `src/context/TaskContext.tsx`

### Ready-to-Use Services (Just Need UI Connection)
- `src/services/firestoreService.ts` ✅
- `src/services/pushNotificationService.ts` ✅
- `src/services/multiDayLeaveService.ts` ✅
- `src/hooks/useAccessibility.ts` ✅
- `src/hooks/usePushNotifications.ts` ✅

### Missing/Incomplete Pages
- None missing! All pages exist
- But many not using Firestore for real-time sync

### Configuration Files to Update
- `firestore.rules` - Security rules
- `firestore.indexes.json` - Query optimization
- `.env.local` - Environment variables (create from `.env.example`)
- `manifest.json` - Already configured ✅

---

## ⚡ Critical Path to MVP

**Minimum Viable Product** requires:
1. ✅ Authentication (**DONE**)
2. ❌ Firestore persistence (**CRITICAL**)
3. ❌ Leave request workflow (**CRITICAL**)
4. ❌ Real-time sync (**CRITICAL**)
5. ✅ Role-based access (**DONE**)
6. ❌ Security rules (**CRITICAL**)

**Estimated Time to MVP:** ~25-30 hours of focused work

---

## 💡 Pro Tips for Faster Completion

1. **Context Migrations:** They follow the same pattern as LeaveContext - can be done in parallel
2. **UI Integrations:** Many are just adding hook calls to existing components
3. **i18n:** Can use find-replace to convert hardcoded strings to translation keys
4. **Testing:** Focus on critical workflows first (leave request, swap, approval)
5. **Security Rules:** Start with permissive rules, tighten iteratively

---

## 🎯 Success Criteria

✅ App loads without errors  
✅ Data persists across refreshes  
✅ Real-time updates work  
✅ All user workflows tested  
✅ Firestore security rules in place  
✅ All critical contexts using Firestore  
✅ Push notifications working  
✅ Error boundaries catching crashes  

---

**Last Updated:** September 19, 2026  
**Total Estimated Completion:** 6-8 weeks with 1-2 developers full-time
