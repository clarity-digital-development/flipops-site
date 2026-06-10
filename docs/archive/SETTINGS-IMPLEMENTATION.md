# Settings Implementation Guide

This document outlines the Settings page implementation and future expansion plans.

---

## Current Implementation (January 2026)

**File:** `app/app/settings/page.tsx`
**API:** `app/api/settings/route.ts`

### Tabs

| Tab | Status | Description |
|-----|--------|-------------|
| General | Functional | Timezone, currency |
| Notifications | Functional | Email alerts, daily digest, digest time |
| Email Signature | Functional | Signature settings for outbound emails |
| Account | Functional | Clerk security link, delete account (disabled) |
| Integrations | Placeholder | Coming Q2 2025 - shows planned features |

### Database Fields (User Model)

These fields are actively used by the Settings page:

```prisma
model User {
  // Regional settings
  timezone        String    @default("America/New_York")
  currency        String    @default("USD")

  // Notification preferences
  emailAlerts     Boolean   @default(true)
  dailyDigest     Boolean   @default(true)
  digestTime      String?   // Time for daily digest (e.g., "08:00")

  // Email signature settings
  emailSignatureEnabled Boolean @default(false)
  emailSenderName       String?
  emailCompanyName      String?
  emailSignature        String?
}
```

### API Routes

**`GET /api/settings`** - Fetch user settings
**`PUT /api/settings`** - Update user settings

Both routes require authentication via Clerk.

---

## Migration Required

If deploying to a new environment, run:

```bash
npx prisma migrate dev --name add_email_signature_fields
```

Or if migrating production:

```bash
npx prisma migrate deploy
```

---

## What Was Removed

The original Settings page had extensive mock UI that wasn't functional:

- **Security tab** - Now redirects to Clerk user portal
- **Integrations tab** - Replaced with "Coming Soon" placeholder
- **Data & Privacy tab** - Removed entirely
- **Active sessions display** - Clerk handles this
- **Connected services grid** - Fake service icons removed
- **API keys management** - Not implemented
- **Webhook configuration** - Not implemented
- **Lead scoring rules** - Not implemented
- **Email templates** - Not implemented

---

## Future Integrations (Q2 2025+)

When ready to build integrations, add these to the schema:

### Phase 1: Email Templates

```prisma
model EmailTemplate {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  name            String
  subject         String
  body            String   // HTML with {{variables}}

  trigger         String   // "manual", "lead_created", "status_changed"
  triggerConfig   String?  // JSON config

  isActive        Boolean  @default(true)
  sentCount       Int      @default(0)
  lastSentAt      DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([userId])
}
```

### Phase 2: Webhooks (Zapier)

```prisma
model Webhook {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  name            String
  url             String
  secret          String   // HMAC signature

  events          String[] // ["lead.created", "deal.updated"]
  isActive        Boolean  @default(true)

  lastTriggeredAt DateTime?
  failureCount    Int      @default(0)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([userId])
}
```

### Phase 3: API Keys

```prisma
model ApiKey {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  name            String
  prefix          String   // "fo_live_"
  keyHash         String   // SHA-256 hash

  scopes          String[] // ["read:leads", "write:leads"]
  lastUsedAt      DateTime?
  expiresAt       DateTime?

  createdAt       DateTime @default(now())

  @@index([userId])
  @@index([prefix])
}
```

### Phase 4: Integration Tokens (OAuth)

```prisma
model IntegrationToken {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  provider        String   // "slack", "twilio"
  accessToken     String   // Encrypted
  refreshToken    String?  // Encrypted
  expiresAt       DateTime?
  metadata        String?  // JSON

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([userId, provider])
}
```

---

## Environment Variables

Current requirements:
- Standard Clerk/Next.js auth setup
- `DATABASE_URL` for Prisma

Future requirements for integrations:
```env
# Encryption for tokens
ENCRYPTION_KEY=<64-char-hex>

# Twilio (SMS campaigns)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Slack (optional, for OAuth instead of webhooks)
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
```

---

## Testing

- [ ] Settings load correctly from API
- [ ] Changes save and persist
- [ ] Timezone affects date displays
- [ ] Email signature appears in vendor emails
- [ ] Clerk link opens user portal
- [ ] Delete account shows confirmation

---

*Created: January 2026*
*Last Updated: January 2026*
