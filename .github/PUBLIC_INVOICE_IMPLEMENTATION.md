# Public Invoice Viewing Implementation

## Overview

Public invoice viewing allows clients to view their invoices through a secure, shareable link without requiring authentication. When a client first views the invoice, it's automatically marked as "viewed".

## Implementation Details

### 1. Route Structure

**Public Route**: `/public/invoice/[token]`

- No authentication required
- Accessible to anyone with the token
- Clean, read-only invoice display

### 2. Server Actions

**File**: `src/app/public/invoice/[token]/actions.ts`

#### `getInvoiceByToken(token: string)`

- Queries invoices using the `publicToken` field
- Uses Firebase Admin SDK (server-side) to bypass auth
- Converts Firestore Timestamps to JavaScript Dates for serialization
- Automatically marks invoice as "viewed" if status is "sent"
- Returns full invoice data or error

#### `getTenantSettingsForPublicInvoice(tenantId: string)`

- Fetches company branding information (name, logo, tax ID)
- Read-only access, no authentication required
- Used to display company information on public invoice

### 3. Public Page Component

**File**: `src/app/public/invoice/[token]/page.tsx`

Features:

- **Clean Design**: Professional invoice layout with company branding
- **Status Badge**: Shows current invoice status (sent, viewed, paid, etc.)
- **Print Button**: Allows client to print/save as PDF
- **Company Info**: Displays company name, logo, and tax ID
- **Client Info**: Shows bill-to address and details
- **Line Items**: Full breakdown of services/products
- **Totals**: Subtotal, tax breakdown, total, and balance due
- **Notes & Payment Instructions**: Any special notes or payment details

### 4. Status Transition: Sent → Viewed

When a client opens the public link for the first time:

```typescript
if (invoice.status === "sent" && !invoice.viewedAt) {
  await invoiceDoc.ref.update({
    status: "viewed",
    viewedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}
```

This provides tracking of when clients first view their invoices.

### 5. Sharing Public Links

**Invoice Detail Page**: `src/app/workspace/invoices/[id]/page.tsx`

Added a "Public Invoice Link" section that:

- Shows the full public URL
- Allows one-click copying to clipboard
- Only displayed for issued invoices (not drafts)
- Format: `https://yourdomain.com/public/invoice/{publicToken}`

Example UI:

```
┌─────────────────────────────────────────────────┐
│ Public Invoice Link                             │
│ Share this link with your client...             │
│ https://app.com/public/invoice/abc123... [Copy] │
└─────────────────────────────────────────────────┘
```

### 6. Security

**Public Token Generation**:

- 64-character random hex string (256 bits of entropy)
- Generated when invoice is created
- Stored in `invoice.publicToken` field

**Access Control**:

- Uses server-side Firebase Admin SDK (bypasses Firestore rules)
- Token validation happens in server action
- No tenant data leakage (only returns data for the specific invoice)
- Client-side Firestore rules include fallback public access by token

**Firestore Rules** (fallback for client SDK):

```javascript
match /tenants/{tenantId}/invoices/{invoiceId} {
  allow read: if resource.data.publicToken == request.query.token;
}
```

### 7. Print Functionality

The public page includes print styles:

- Optimized for A4/Letter paper
- Removes navigation and buttons when printing
- Clean, professional PDF output
- Print button in header for easy access

### 8. Error Handling

**Invalid Token**:

- Shows friendly "Invoice Not Found" message
- No information about whether invoice exists (prevents token guessing)

**Loading States**:

- Spinner while fetching invoice
- Prevents flash of empty content

## User Flow

### For Business Users:

1. Create and issue an invoice
2. View invoice detail page
3. Copy the public link from the "Public Invoice Link" section
4. Share link via email, SMS, or other channel

### For Clients:

1. Receive link from business
2. Click link (no login required)
3. View invoice with company branding
4. Print or save as PDF if needed
5. Invoice status automatically updates to "viewed"

## Testing

### Manual Testing Steps:

1. **Create and Issue Invoice**:

   ```
   - Login to workspace
   - Create client
   - Create job with items
   - Create draft invoice
   - Add items to invoice
   - Issue invoice
   ```

2. **Copy Public Link**:

   ```
   - Open invoice detail page
   - Find "Public Invoice Link" section
   - Click "Copy Link" button
   - Verify link copied to clipboard
   ```

3. **Test Public Access**:

   ```
   - Open link in incognito/private browser window
   - Verify invoice displays without login
   - Check all invoice details are visible
   - Verify status badge shows correctly
   - Test print functionality
   ```

4. **Verify Status Update**:

   ```
   - Check invoice status changed from "sent" to "viewed"
   - Verify viewedAt timestamp is set
   - Reload public page - status should stay "viewed"
   ```

5. **Test Invalid Token**:
   ```
   - Visit /public/invoice/invalid-token-123
   - Should show "Invoice Not Found" error
   - No sensitive information displayed
   ```

## Files Modified/Created

### Created:

- `src/app/public/invoice/[token]/page.tsx` - Public invoice page
- `src/app/public/invoice/[token]/actions.ts` - Server actions

### Modified:

- `src/app/workspace/invoices/[id]/page.tsx` - Added public link section
- `src/lib/routes.ts` - Added PUBLIC invoice route helper

## Future Enhancements

1. **Email Integration**: Automatically send public link when issuing invoice
2. **Link Expiry**: Add optional expiration dates for public links
3. **View Tracking**: Log each view with timestamp and IP (privacy considerations)
4. **Download PDF**: Server-side PDF generation for direct download
5. **Payment Integration**: Add "Pay Now" button for online payments
6. **Multi-language**: Support for different locales based on client preference

## Related Documentation

- Implementation Plan: `.github/IMPLEMENTATION_PLAN.md` (Phase 6.1)
- Invoice Utils: `src/lib/invoice-utils.ts`
- Invoice Types: `src/types/invoice.ts`
