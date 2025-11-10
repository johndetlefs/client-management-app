# Deployment Guide

## Prerequisites

1. Firebase CLI installed: `npm install -g firebase-tools`
2. Authenticated with Firebase: `firebase login`
3. Vercel account connected to this repository

## Initial Production Setup

### 1. Deploy Firestore Indexes

**Critical**: Firestore indexes must be deployed before the app can query data properly in production.

```bash
npm run deploy:indexes
```

Or manually:

```bash
firebase deploy --only firestore:indexes
```

**Why this is needed**: The app uses composite queries (filtering + sorting) that require indexes:

- Job items by jobId + createdAt
- Job items by clientId + status + createdAt
- Invoices by clientId + status + issueDate
- And more...

### 2. Deploy Firestore Security Rules

```bash
npm run deploy:rules
```

Or manually:

```bash
firebase deploy --only firestore:rules,storage
```

### 3. Configure Vercel Environment Variables

In your Vercel project settings, add the following environment variables:

**Firebase Client SDK (Public)**:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

**Firebase Admin SDK (Server-side)**:

Option 1: Individual credentials

- `FIREBASE_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY` (ensure newlines are preserved as `\n`)

Option 2: Full service account JSON

- `FIREBASE_SERVICE_ACCOUNT_KEY` (JSON string of the entire service account)

### 4. Deploy to Vercel

```bash
# Via Git push (automatic)
git push origin main

# Or manually
vercel --prod
```

## Common Production Issues

### "Failed to fetch job items" Error

**Cause**: Firestore indexes not deployed to production.

**Solution**: Run `npm run deploy:indexes`

**Verification**: Check Firebase Console → Firestore Database → Indexes tab

### "No tenant found" After Signup

**Cause**: Race condition between user creation and Firestore document propagation.

**Solution**: Already handled in code with retry logic (up to 5 attempts with exponential backoff).

**If persistent**: Check Vercel function logs for errors in the `/api/initialize-user` endpoint.

### Firebase Admin SDK Errors

**Cause**: Missing or incorrect environment variables.

**Solution**:

1. Verify all environment variables are set in Vercel
2. For `FIREBASE_ADMIN_PRIVATE_KEY`, ensure newlines are properly escaped
3. Redeploy after updating environment variables

### "Cannot use undefined as a Firestore value" Error

**Cause**: Firestore doesn't allow `undefined` values in documents. All optional fields must either be omitted entirely or use `null`.

**Solution**: Already fixed in code - optional fields (like `description`) are only included if they have values.

**If you see this error**: Check Vercel function logs for the specific field mentioned and verify the server action properly handles optional/undefined values.

## Monitoring

### Vercel Function Logs

View logs in Vercel Dashboard → Your Project → Deployments → [Latest] → Functions

Look for:

- `[getJobItems]` - Job items fetch logging
- `[createJobItem]` - Job item creation
- `[addItemsToInvoice]` - Invoice item locking
- `[voidInvoice]` - Invoice voiding
- API route logs from `/api/initialize-user`

### Firebase Console

Check:

- **Authentication**: User sign-ups and activity
- **Firestore**: Document creation and updates
- **Indexes**: Status (building/enabled/error)

## Updating Indexes

If you add new queries that require indexes:

1. Update `firestore.indexes.json` locally
2. Test with emulators: `npm run dev`
3. Deploy to production: `npm run deploy:indexes`
4. Wait for index build to complete (Firebase Console shows progress)

## Rollback

If a deployment causes issues:

1. In Vercel Dashboard, go to Deployments
2. Find the last working deployment
3. Click "..." → "Promote to Production"

For Firestore rules/indexes:

```bash
# Restore from git history
git checkout <commit-hash> firestore.indexes.json firestore.rules
firebase deploy --only firestore:indexes,firestore:rules
```

## Performance Optimization

### Edge Runtime vs Node.js Runtime

- Routes using Firestore Admin SDK must use Node.js runtime
- Add `export const runtime = "nodejs"` to route handlers
- API routes are already configured correctly

### Caching Considerations

- User profile and tenant lookups have retry logic
- Invoice queries should be cached on client side where appropriate
- Consider implementing SWR or React Query for better client-side caching

## Security Checklist

- [ ] Firestore security rules deployed
- [ ] Storage security rules deployed
- [ ] Environment variables set in Vercel (not committed to repo)
- [ ] Service account credentials rotated if exposed
- [ ] CORS configured if using custom domain
- [ ] Rate limiting configured in Vercel (if needed)

## Support

For production issues:

1. Check Vercel function logs
2. Check Firebase Console → Firestore Database → Indexes
3. Verify environment variables in Vercel
4. Review this deployment guide
5. Check `.github/copilot-instructions.md` for architecture details
