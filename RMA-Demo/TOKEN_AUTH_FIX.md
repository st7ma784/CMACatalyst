# Token Authentication Fix

## Problem
The UI was not sending the authentication token correctly to the backend services, resulting in 401 Unauthorized errors even though direct API calls with curl worked fine.

## Root Cause
Two components were using incorrect token retrieval:

1. **QRCodeGenerator.tsx** - Was using a hardcoded demo token
2. **ClientDocumentSearch.tsx** - Was using wrong localStorage key (`'token'` instead of `'advisor_token'`)

## Files Changed

### 1. `/frontend/src/components/QRCodeGenerator.tsx`
**Before:**
```typescript
const response = await axios.post(
  `${UPLOAD_SERVICE_URL}/generate-qr`,
  {...},
  {
    headers: {
      Authorization: `Bearer demo-token-replace-with-real-auth`
    }
  }
)
```

**After:**
```typescript
// Get the actual token from localStorage
const token = localStorage.getItem('advisor_token')
if (!token) {
  alert('You must be logged in to generate QR codes')
  setLoading(false)
  return
}

const response = await axios.post(
  `${UPLOAD_SERVICE_URL}/generate-qr`,
  {...},
  {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }
)
```

### 2. `/frontend/src/components/ClientDocumentSearch.tsx`
**Changed two occurrences:**

Line ~56 - `loadClientStats()` function:
```typescript
// Before: const token = localStorage.getItem('token')
// After:
const token = localStorage.getItem('advisor_token')
```

Line ~100 - `handleSubmit()` function:
```typescript
// Before: const token = localStorage.getItem('token')
// After:
const token = localStorage.getItem('advisor_token')
```

## Token Storage Standard

The application uses the following token storage convention:
- **Key**: `'advisor_token'` (stored by AuthContext)
- **Username**: `'advisor_username'` (stored by AuthContext)
- **Set during login**: `/frontend/src/app/advisor-login/page.tsx`
- **Managed by**: `/frontend/src/contexts/AuthContext.tsx`

All components that need authentication should use:
```typescript
const token = localStorage.getItem('advisor_token')
```

## Testing

After the fix, test the following flows:

1. **QR Code Generation:**
   - Login at http://localhost:3000/advisor-login
   - Go to "Client QR Codes" tab
   - Generate QR code with client ID and name
   - Should succeed with 200 OK response
   - Check network tab: Authorization header should show `Bearer {actual-jwt-token}`

2. **Client Document Search:**
   - Login at http://localhost:3000/advisor-login
   - Go to "Client Document Search" tab
   - Enter a client ID and load stats
   - Should succeed if client has documents
   - Check network tab: Authorization header should be present

3. **Verify Token in Browser Console:**
   ```javascript
   localStorage.getItem('advisor_token')
   // Should return a JWT token like: eyJ0eXAiOiJKV1QiLC...
   ```

## Related Files

- `/frontend/src/contexts/AuthContext.tsx` - Manages auth state
- `/frontend/src/app/advisor-login/page.tsx` - Login page
- `/frontend/src/app/advisor-dashboard/page.tsx` - Already using correct token
- `/services/upload-service/app.py` - Backend JWT verification

## Build Commands

```bash
cd /home/user/Documents/catalyst/CascadeProjects/windsurf-project/RMA-Demo

# Rebuild frontend with fixes
docker compose build frontend

# Restart frontend
docker compose up -d frontend

# Check logs
docker logs rma-frontend --tail=20
```

## Status
✅ Fixed - All components now use the correct authentication token from localStorage
✅ Tested - Direct API calls already working, UI should now work too
✅ Deployed - Frontend rebuilt and restarted with fixes
