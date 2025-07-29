# Session Storage Migration Plan

This document outlines the migration from individual auth API calls to the new cached session storage system.

## Overview

**Total Files to Migrate**: 47 files
**Current Status**: 1 file migrated (`app/teacher/page.tsx`)
**Remaining**: 46 files

## Migration Phases

### Phase 1: High-Impact Client Components (Priority: HIGH)
*These provide the biggest performance benefit as they eliminate API calls on every render*

#### 1.1 Main Application Pages (4 files)
- [ ] `app/dashboard/page.tsx` (2 usages) - **Server component, needs different approach**
- [ ] `app/family/profile/page.tsx` (2 usages) - **Server component, needs different approach**  
- [ ] `app/admin/events/page.tsx` (2 usages) - **Server component, needs different approach**
- [x] `app/teacher/page.tsx` - **COMPLETED**

#### 1.2 Interactive Client Components (6 files)
- [ ] `app/registration/page.tsx` - Check for role-based features
- [ ] `app/registration/[sessionId]/page.tsx` - Check for teacher early access
- [ ] `app/registration/[sessionId]/family/page.tsx` - Family data usage
- [ ] `app/calendar/page.tsx` - Potential role-based calendar features
- [ ] `app/components/ReadonlyScheduleView.tsx` - Admin vs user view differences
- [ ] `app/components/PaymentHistory.tsx` - Family-specific payment data

**Estimated Impact**: ⭐⭐⭐⭐⭐ (Eliminates client-side API calls)
**Complexity**: Medium (Need to replace API calls with cached data)

### Phase 2: Server-Side API Routes - Admin Heavy (Priority: HIGH)
*These routes have multiple auth checks and could benefit from request-level caching*

#### 2.1 Admin Routes with Heavy Auth Usage (8+ calls each)
- [ ] `app/api/admin/events/[eventId]/route.ts` (8 usages)
- [ ] `app/api/admin/events/route.ts` (6 usages)

#### 2.2 Admin Routes with Medium Auth Usage (4 calls each)
- [ ] `app/api/admin/sessions/[sessionId]/route.ts` (4 usages)
- [ ] `app/api/admin/schedule/[sessionId]/route.ts` (4 usages)
- [ ] `app/api/admin/schedule/[sessionId]/drafts/[draftId]/route.ts` (4 usages)
- [ ] `app/api/admin/classrooms/[classroomId]/route.ts` (4 usages)

**Estimated Impact**: ⭐⭐⭐⭐ (Reduces server-side auth calls)
**Complexity**: Low-Medium (Server-side optimization)

### Phase 3: Standard API Routes (Priority: MEDIUM)
*Routes with 2-3 auth calls - moderate impact*

#### 3.1 Family/User Management Routes (12 files)
- [ ] `app/api/family/profile/route.ts` (2 usages)
- [ ] `app/api/family/register/route.ts` (2 usages)
- [ ] `app/api/family/join/route.ts` (2 usages)
- [ ] `app/api/family/toggle-fee/route.ts` (2 usages)
- [ ] `app/api/family/fees/[sessionId]/route.ts` (2 usages)
- [ ] `app/api/user/sync/route.ts` (2 usages)
- [ ] `app/api/user/role/route.ts` (2 usages)
- [ ] `app/api/admin/users/route.ts` (2 usages)
- [ ] `app/api/admin/users/[userId]/route.ts` (2 usages)
- [ ] `app/api/admin/users/[userId]/role/route.ts` (3 usages)
- [ ] `app/api/registration/family-status/route.ts` (2 usages)
- [ ] `app/api/registration/status/route.ts` (2 usages)

#### 3.2 Class/Teaching Management Routes (8 files)
- [ ] `app/api/class-teaching-requests/route.ts` (3 usages)
- [ ] `app/api/class-teaching-registration/status/route.ts` (2 usages)
- [ ] `app/api/teacher/schedule/[sessionId]/comments/route.ts` (3 usages)
- [ ] `app/api/admin/class-teaching-requests/route.ts` (2 usages)
- [ ] `app/api/admin/class-teaching-requests/[requestId]/route.ts` (3 usages)
- [ ] `app/api/admin/volunteer-jobs/route.ts` (3 usages)
- [ ] `app/api/admin/volunteer-jobs/[jobId]/route.ts` (3 usages)
- [ ] `app/api/sessions/[sessionId]/route.ts` (2 usages)

**Estimated Impact**: ⭐⭐⭐ (Moderate optimization)
**Complexity**: Low (Straightforward replacements)

### Phase 4: Registration & Schedule Routes (Priority: LOW)
*Lower frequency usage routes*

#### 4.1 Registration System Routes (8 files)
- [ ] `app/api/registration/batch-register/route.ts` (2 usages)
- [ ] `app/api/registration/register/route.ts` (2 usages)
- [ ] `app/api/registration/family/route.ts` (3 usages)
- [ ] `app/api/registration/schedules/[sessionId]/route.ts` (2 usages)
- [ ] `app/api/admin/registration-overrides/route.ts` (2 usages)
- [ ] `app/api/admin/registration-overrides/[overrideId]/route.ts` (2 usages)
- [ ] `app/api/admin/sessions/route.ts` (3 usages)
- [ ] `app/api/admin/sessions/[sessionId]/fees/route.ts` (3 usages)

#### 4.2 Schedule Management Routes (6 files)
- [ ] `app/api/admin/schedule/[sessionId]/drafts/route.ts` (3 usages)
- [ ] `app/api/admin/schedule/[sessionId]/publish/route.ts` (2 usages)
- [ ] `app/api/admin/schedule/[sessionId]/submit/route.ts` (2 usages)
- [ ] `app/api/admin/schedule/[sessionId]/save/route.ts` (2 usages)
- [ ] `app/api/admin/schedule/[sessionId]/pullback/route.ts` (2 usages)
- [ ] `app/api/admin/classrooms/route.ts` (3 usages)

#### 4.3 Miscellaneous Routes (2 files)
- [ ] `app/api/events/route.ts` (2 usages)
- [x] `app/api/user/session-data/route.ts` (3 usages) - **COMPLETED** (This is our new endpoint)

**Estimated Impact**: ⭐⭐ (Minor optimization)
**Complexity**: Low (Simple replacements)

## Migration Strategies by File Type

### Client Components (`'use client'`)
**Strategy**: Replace API calls with `useUserSession()` hook or helper functions

**Before**:
```typescript
const [isAdmin, setIsAdmin] = useState(false)
useEffect(() => {
  fetch('/api/user/role').then(/* check admin */)
}, [])
```

**After**:
```typescript
import { useUserSession } from '@/lib/user-session'
const { isAdmin } = useUserSession()
```

### Server Components (Pages)
**Strategy**: These need to stay server-side but could use optimized server functions

**Current Limitation**: Session storage is client-side only
**Potential Solution**: Create server-side request caching or keep as-is

### API Routes
**Strategy**: Replace individual auth calls with cached session data where possible

**Before**:
```typescript
const session = await getServerSession(authOptions)
const isAdmin = await checkAdminRole(session.user.id)
const familyData = await fetchFamilyData(session.user.id)
```

**After**:
```typescript
const session = await getAuthenticatedUser()
// Use existing optimized functions or create request-level caching
```

## Implementation Guidelines

### 1. Testing Strategy
- [ ] Test each migrated component/route individually
- [ ] Verify cached data matches previous API responses
- [ ] Check that cache invalidation works correctly
- [ ] Test edge cases (logout, session expiry, etc.)

### 2. Rollback Plan
- Keep old functions available during migration
- Use feature flags if needed for gradual rollout
- Monitor performance metrics before/after

### 3. Performance Metrics to Track
- Client-side: Reduced API calls, faster component renders
- Server-side: Reduced database queries, faster response times
- User experience: Faster page loads, less loading states

## Estimated Timeline

- **Phase 1**: 2-3 days (High impact, medium complexity)
- **Phase 2**: 1-2 days (Server-side optimizations)
- **Phase 3**: 2-3 days (Many files, but straightforward)
- **Phase 4**: 1-2 days (Simple replacements)

**Total Estimated Time**: 6-10 days

## Success Metrics

- [ ] Eliminate 90%+ of redundant auth API calls
- [ ] Reduce client-side loading states by 80%+
- [ ] Improve page load times by 20-30%
- [ ] Maintain 100% functional compatibility

## Next Steps

1. **Start with Phase 1.2** (Interactive Client Components) for immediate impact
2. **Create component-specific migration tickets** for tracking
3. **Set up performance monitoring** to measure improvements
4. **Begin with highest-traffic components** first

---

*This migration will significantly improve application performance by eliminating redundant auth checks and providing instant access to user data throughout the application.*