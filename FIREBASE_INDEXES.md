                                                                                                                                                        # Firebase Firestore Indexes Required

This document lists all the composite indexes that need to be created in Firebase Firestore for the application to work properly.

## How to Create Indexes

1. Click on the error link provided in the browser console, OR
2. Go to Firebase Console → Firestore Database → Indexes tab → Create Index

## Required Indexes

### 1. Market Items Index
**Collection:** `marketItems`
**Fields:**
- `status` (Ascending)
- `createdAt` (Descending)

**Query:** `where('status', '==', 'active').orderBy('createdAt', 'desc')`

**Create Link:** https://console.firebase.google.com/v1/r/project/link-my-skills/firestore/indexes?create_composite=ClJwcm9qZWN0cy9saW5rLW15LXNraWxscy9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvbWFya2V0SXRlbXMvaW5kZXhlcy9fEAEaCgoGc3RhdHVzEAEaDQoJY3JlYXRlZEF0EAIaDAoIX19uYW1lX18QAg

---

### 2a. Engagements Index (for SDP Recent Activities)
**Collection:** `engagements`
**Fields:**
- `sdpId` (Ascending)
- `updatedAt` (Descending)

**Query:** `where('sdpId', '==', userId).orderBy('updatedAt', 'desc')`

**Create Link:** https://console.firebase.google.com/v1/r/project/link-my-skills/firestore/indexes?create_composite=ClJwcm9qZWN0cy9saW5rLW15LXNraWxscy9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvZW5nYWdlbWVudHMvaW5kZXhlcy9fEAEaCQoFc2RwSWQQARoNCgl1cGRhdGVkQXQQAhoMCghfX25hbWVfXxAC

---

### 2b. Engagements Index (for SME Recent Activities)
**Collection:** `engagements`
**Fields:**
- `smeId` (Ascending)
- `updatedAt` (Descending)

**Query:** `where('smeId', '==', userId).orderBy('updatedAt', 'desc')`

**Create Link:** https://console.firebase.google.com/v1/r/project/link-my-skills/firestore/indexes?create_composite=ClJwcm9qZWN0cy9saW5rLW15LXNraWxscy9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvZW5nYWdlbWVudHMvaW5kZXhlcy9fEAEaCQoFc21lSWQQARoNCgl1cGRhdGVkQXQQAhoMCghfX25hbWVfXxAC

---

### 3. Projects Index (CRITICAL - Required for Market)
**Collection:** `projects`
**Fields:**
- `status` (Ascending)
- `createdAt` (Descending)

**Query:** `where('status', '==', 'open').orderBy('createdAt', 'desc')`

**Used by:** 
- SDP Dashboard Market tab (shows all open projects)
- SME Dashboard Market tab (shows all open projects for applications)

**Note:** This index is REQUIRED for projects to appear in the market. If missing, projects won't show up even if they're created successfully.

---

### 3b. Projects Index (SDP's Own Projects)
**Collection:** `projects`
**Fields:**
- `sdpId` (Ascending)
- `createdAt` (Descending)

**Query:** `where('sdpId', '==', userId).orderBy('createdAt', 'desc')`

**Used by:** SDP Dashboard Projects tab (shows SDP's own projects)

---

### 4. Want Items Index
**Collection:** `wantItems`
**Fields:**
- `status` (Ascending)
- `createdAt` (Descending)

**Query:** `where('status', '==', 'active').orderBy('createdAt', 'desc')`

---

### 5. Project Applications Index
**Collection:** `projectApplications`
**Fields:**
- `smeId` (Ascending)
- `appliedAt` (Descending)

**Query:** `where('smeId', '==', userId).orderBy('appliedAt', 'desc')`

**Create Link:** https://console.firebase.google.com/v1/r/project/link-my-skills/firestore/indexes?create_composite=Clpwcm9qZWN0cy9saW5rLW15LXNraWxscy9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvcHJvamVjdEFwcGxpY2F0aW9ucy9pbmRleGVzL18QARoJCgVzbWVJZBABGg0KCWFwcGxpZWRBdBACGgwKCF9fbmFtZV9fEAI

---

### 6. Notifications Index
**Collection:** `notifications`
**Fields:**
- `userId` (Ascending)
- `createdAt` (Descending)

**Query:** `where('userId', '==', userId).orderBy('createdAt', 'desc')`

**Create Link:** https://console.firebase.google.com/v1/r/project/link-my-skills/firestore/indexes?create_composite=ClRwcm9qZWN0cy9saW5rLW15LXNraWxscy9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvbm90aWZpY2F0aW9ucy9pbmRleGVzL18QARoKCgZ1c2VySWQQARoNCgljcmVhdGVkQXQQAhoMCghfX25hbWVfXxAC

---

### 7. Want Ads Index
**Collection:** `wantAds`
**Fields:**
- `status` (Ascending)
- `createdAt` (Descending)

**Query:** `where('status', '==', 'active').orderBy('createdAt', 'desc')`

**Create Link:** https://console.firebase.google.com/v1/r/project/link-my-skills/firestore/indexes?create_composite=Ck5wcm9qZWN0cy9saW5rLW15LXNraWxscy9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvd2FudEFkcy9pbmRleGVzL18QARoKCgZzdGF0dXMQARoNCgljcmVhdGVkQXQQAhoMCghfX25hbWVfXxAC

---

## Quick Fix

If you see an index error in the browser console, click on the provided link - it will automatically create the required index in Firebase Console.

## Status

After creating indexes, they may take a few minutes to build. You can check the status in Firebase Console → Firestore → Indexes tab.

