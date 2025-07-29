# User Session Storage System

This system provides cached user information to reduce API calls and improve performance throughout the application.

## Features

- **Session Storage**: Caches user data in browser session storage
- **Automatic Refresh**: Refreshes data every 5 minutes or when stale
- **Helper Functions**: Easy-to-use functions for common user data checks
- **React Hook**: `useUserSession` hook for React components

## Usage Examples

### Using Helper Functions (Recommended)

```typescript
import { 
  isUserAdmin, 
  isUserTeacher, 
  getUserRole, 
  getUserFamilyId,
  hasAnnualFeePaid,
  isMainContact 
} from '@/lib/user-session'

// Check if user is admin
if (isUserAdmin()) {
  // Show admin features
}

// Check if user is a teacher
if (isUserTeacher()) {
  // Show teacher features
}

// Get user's family ID
const familyId = getUserFamilyId()
if (familyId) {
  // Use family ID for API calls
}

// Check fee payment status
if (hasAnnualFeePaid()) {
  // Allow registration
}
```

### Using React Hook

```typescript
import { useUserSession } from '@/lib/user-session'

function MyComponent() {
  const { 
    userData, 
    loading, 
    refreshData, 
    isAdmin, 
    isTeacher, 
    hasAnnualFeePaid 
  } = useUserSession()

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <h1>Welcome, {userData?.name}</h1>
      {isAdmin && <AdminPanel />}
      {isTeacher && <TeacherPanel />}
      {!hasAnnualFeePaid && <FeePaymentReminder />}
      
      <button onClick={refreshData}>
        Refresh User Data
      </button>
    </div>
  )
}
```

### Direct Session Manager Usage

```typescript
import { userSession } from '@/lib/user-session'

// Get cached data
const userData = userSession.getUserData()

// Force refresh
const freshData = await userSession.refreshUserData()

// Clear cache (on logout)
userSession.clearUserData()
```

## Migration from Current System

### Before (Multiple API Calls)
```typescript
// Old way - multiple server calls
const session = await getServerSession()
const isAdmin = await checkAdminRole(session.user.id)
const familyData = await fetchFamilyData(session.user.id)
```

### After (Cached Data)
```typescript
// New way - single cached lookup
const isAdmin = isUserAdmin()
const familyId = getUserFamilyId()
const hasTeacher = isUserTeacher()
```

## Data Structure

The cached user session data includes:

```typescript
interface UserSessionData {
  userId: string
  email: string
  name: string
  role: string                // 'admin', 'moderator', 'user'
  familyId: string | null
  isMainContact: boolean
  hasTeacherRole: boolean     // Any guardian in family has teaching requests for the current active session
  familyName: string | null
  annualFeePaid: boolean
  lastUpdated: number         // Timestamp for cache invalidation
}
```

## Cache Behavior

- **Duration**: 5 minutes
- **Storage**: Browser session storage (cleared on tab close)
- **Auto-refresh**: Fetches fresh data when cache expires
- **Initialization**: Automatically populated on login via UserSessionProvider

## API Endpoint

The system uses `/api/user/session-data` to fetch user information. This endpoint:

- Requires authentication
- Fetches user role, family data, and teacher status in parallel
- Returns structured data for caching

## Integration

The `UserSessionProvider` component is already integrated into the app providers and will automatically:

1. Initialize user session data on login
2. Clear data on logout  
3. Handle cache refresh as needed

No additional setup is required - just start using the helper functions!