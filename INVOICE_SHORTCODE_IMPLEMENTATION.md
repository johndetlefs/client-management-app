# Invoice Shortcode Implementation

## Overview

This document describes the hybrid invoice numbering system that combines sequential tracking (for internal use and compliance) with custom client shortcode prefixes (for branding and client-facing display).

## Implementation Summary

### What Was Implemented

**Hybrid Approach**:

- **Internal Sequential Number**: `2025-001` (for sorting, reporting, compliance)
- **Display Number**: `QNTS-5TU72` (for branding, client-facing)

### Benefits of This Approach

1. **Compliance**: Sequential numbering preserved for auditing and regulatory requirements
2. **Branding**: Client-facing invoices show custom branded numbers
3. **Sortability**: Internal sequential numbers maintain chronological ordering
4. **Flexibility**: Clients without shortcodes fall back to sequential display
5. **Rollback Safety**: Can easily revert to sequential-only if needed

## Technical Changes

### 1. Type Updates

#### Client Type (`src/types/client.ts`)

```typescript
export interface Client {
  // ...existing fields...
  shortcode?: string; // 4-letter code for invoice prefixes (e.g., "QNTS")
}
```

#### Invoice Type (`src/types/invoice.ts`)

```typescript
export interface Invoice {
  // ...existing fields...
  invoiceNumber?: string; // Sequential per tenant/year (e.g., "2025-001") - internal use
  invoiceDisplayNumber?: string; // Client-facing display number (e.g., "QNTS-5TU72")
}
```

### 2. Utility Functions (`src/lib/invoice-utils.ts`)

Added three new functions:

```typescript
// Validate shortcode format (exactly 4 uppercase letters)
export function validateShortcode(shortcode: string): boolean;

// Generate random 5-character alphanumeric code
export function generateInvoiceCode(): string;

// Format display number with shortcode
export function formatInvoiceDisplayNumber(
  shortcode: string,
  code: string
): string;
```

### 3. Client Actions (`src/app/workspace/clients/actions.ts`)

- **`createClient`**: Validates shortcode format and uniqueness before creating
- **`updateClient`**: Validates shortcode format and uniqueness (excluding current client)
- Both functions automatically convert shortcodes to uppercase

### 4. Invoice Issuing (`src/app/workspace/invoices/actions.ts`)

Updated `issueInvoice` to:

1. Generate sequential invoice number (always)
2. Fetch client to check for shortcode
3. If shortcode exists: generate alphanumeric code + format display number
4. If no shortcode: use sequential number as display number
5. Store both `invoiceNumber` and `invoiceDisplayNumber`

### 5. Client Forms (`src/app/workspace/clients/[id]/edit/page.tsx`)

Added shortcode input field:

- Automatically converts to uppercase
- Limited to 4 characters
- Pattern validation for letters only
- Helpful description text

### 6. Invoice Displays

Updated all invoice views to show `invoiceDisplayNumber` with fallback to `invoiceNumber`:

- **Invoice List** (`src/app/workspace/invoices/page.tsx`)
- **Invoice Detail** (`src/app/workspace/invoices/[id]/page.tsx`)
- **Invoice Print** (`src/app/workspace/invoices/[id]/print/page.tsx`)
- Search functionality includes both display and internal numbers

## Usage Guide

### Setting Up Client Shortcodes

1. Navigate to Clients section
2. Create or edit a client
3. Enter a 4-letter shortcode (e.g., "QNTS" for Qantas)
4. System validates uniqueness within your tenant
5. Save the client

### Invoice Numbering Behavior

#### With Shortcode

- **Client**: Qantas (shortcode: "QNTS")
- **Internal Number**: `2025-001`
- **Display Number**: `QNTS-5TU72`
- **Shown to Client**: `QNTS-5TU72`

#### Without Shortcode

- **Client**: ABC Company (no shortcode)
- **Internal Number**: `2025-002`
- **Display Number**: `2025-002`
- **Shown to Client**: `2025-002`

### Draft Invoices

- Draft invoices show "DRAFT" until issued
- Both numbers are generated when the invoice is issued/sent

## Validation Rules

### Shortcode Format

- Exactly 4 characters
- Uppercase letters only (A-Z)
- No numbers, spaces, or special characters
- Examples: `QNTS`, `LEVO`, `ACME`

### Uniqueness

- Shortcodes must be unique within a tenant
- Validation happens on both client creation and update
- Clear error messages if shortcode is already in use

### Display Code Generation

- 5 random alphanumeric characters (uppercase)
- Character set: A-Z, 0-9 (36 possible characters)
- Possible combinations: 36^5 = 60,466,176
- Collision risk is extremely low

## Database Structure

### Firestore Collections

No new collections added. New fields on existing documents:

```
tenants/{tenantId}/
  ├── clients/{clientId}
  │   └── shortcode: "QNTS" (optional)
  │
  └── invoices/{invoiceId}
      ├── invoiceNumber: "2025-001" (internal, always present after issuing)
      └── invoiceDisplayNumber: "QNTS-5TU72" (client-facing, always present after issuing)
```

### Counter Document (unchanged)

```
tenants/{tenantId}/counters/invoices-{year}
  ├── year: 2025
  └── lastNumber: 123
```

Sequential counter still maintains invoice number continuity.

## Migration Notes

### Existing Invoices

- No migration needed for existing invoices
- Old invoices will display `invoiceNumber` since `invoiceDisplayNumber` is undefined
- New invoices will show `invoiceDisplayNumber` (or fall back to `invoiceNumber`)

### Existing Clients

- Existing clients without shortcodes continue to work normally
- Their future invoices will use sequential numbers for display
- Shortcodes can be added at any time

## Future Enhancements (Optional)

### Potential Improvements

1. **Collision Detection**: Add retry logic if alphanumeric code collision occurs (currently unlikely)
2. **Shortcode Suggestions**: Auto-generate suggested shortcodes from client name
3. **Bulk Assignment**: Tool to assign shortcodes to multiple existing clients
4. **Custom Format**: Allow per-tenant configuration of display number format
5. **Analytics**: Track usage statistics for shortcode-based invoices

### Reporting Considerations

- Use `invoiceNumber` for internal reports and sorting
- Use `invoiceDisplayNumber` for client-facing documents
- Search functionality covers both fields

## Testing Recommendations

### Manual Test Cases

1. **Create client with shortcode**

   - Verify shortcode is uppercased
   - Verify uniqueness validation works
   - Try invalid formats (numbers, special chars, wrong length)

2. **Create client without shortcode**

   - Verify invoice uses sequential number

3. **Issue invoice with shortcode client**

   - Verify display number format: `XXXX-XXXXX`
   - Verify internal number is sequential
   - Check print view shows display number

4. **Issue invoice without shortcode client**

   - Verify display number equals sequential number
   - Check backward compatibility

5. **Search invoices**

   - Search by display number
   - Search by internal number
   - Search by client name

6. **Update client shortcode**
   - Change existing shortcode
   - Verify existing invoices unchanged
   - Verify new invoices use new shortcode

## Rollback Plan

If needed, to rollback:

1. Stop using shortcode field in client forms
2. Modify `issueInvoice` to only set `invoiceDisplayNumber = invoiceNumber`
3. No data loss - both numbers are preserved
4. Display will revert to sequential numbers

## Support & Troubleshooting

### Common Issues

**Problem**: Shortcode validation error

- **Solution**: Ensure exactly 4 uppercase letters

**Problem**: "Shortcode already in use"

- **Solution**: Choose a different shortcode or check existing clients

**Problem**: Old invoices show different format

- **Solution**: This is expected - only new invoices use the new format

**Problem**: Search not finding invoice by display number

- **Solution**: Search now includes both display and internal numbers

## Summary

The hybrid approach successfully provides:

- ✅ Custom branded invoice numbers (QNTS-5TU72)
- ✅ Sequential internal tracking (2025-001)
- ✅ Compliance with audit requirements
- ✅ Backward compatibility with existing invoices
- ✅ Optional shortcodes (clients can work without them)
- ✅ Proper validation and uniqueness checks
