# Email Deliverability — Subdomain & DNS Setup

## Overview

To protect the root domain `flipops.io` sender reputation, all outbound email should be sent from subdomains. Each subdomain isolates reputation so a marketing campaign issue won't affect transactional email delivery.

---

## Step 1: Verify Domain in Resend

1. Go to [Resend Dashboard](https://resend.com/domains) → **Domains** → **Add Domain**
2. Enter `flipops.io`
3. Resend will provide DNS records to add:
   - **3 CNAME records** for DKIM signing (e.g., `resend._domainkey.flipops.io`)
   - **1 TXT record** for SPF
   - **1 TXT record** for DMARC
4. Add these records in your DNS provider (e.g., Cloudflare, Namecheap, GoDaddy)
5. Click **Verify** in Resend once records propagate (up to 48h, usually <1h)

---

## Step 2: Create Sending Subdomains

Create DNS records for each subdomain. These are **sending-only** subdomains (no MX records needed — they don't receive email).

### Subdomains to Create

| Subdomain | Purpose | Type |
|-----------|---------|------|
| `mail.flipops.io` | Transactional (password resets, confirmations, form receipts) | Transactional |
| `email.flipops.io` | Product notifications, deal alerts, guardrail alerts | Transactional |
| `hello.flipops.io` | Welcome/onboarding sequences | Marketing |
| `notify.flipops.io` | System alerts, cron notifications | Transactional |
| `explore.flipops.io` | Newsletter, content marketing | Marketing |
| `learn.flipops.io` | Educational content, tutorials | Marketing |
| `promo.flipops.io` | Promotional campaigns, product launches | Marketing |

### DNS Records Per Subdomain

For each subdomain (using `mail.flipops.io` as example):

| Type | Host/Name | Value | TTL |
|------|-----------|-------|-----|
| CNAME | `mail.flipops.io` | `send.resend.com` | Auto |
| TXT | `mail.flipops.io` | `v=spf1 include:amazonses.com ~all` | Auto |
| CNAME | `resend._domainkey.mail.flipops.io` | *(provided by Resend when you add the subdomain)* | Auto |
| CNAME | `resend2._domainkey.mail.flipops.io` | *(provided by Resend)* | Auto |
| CNAME | `resend3._domainkey.mail.flipops.io` | *(provided by Resend)* | Auto |
| TXT | `_dmarc.mail.flipops.io` | `v=DMARC1; p=none; rua=mailto:dmarc@flipops.io; pct=100` | Auto |

> **Note:** The exact DKIM CNAME values come from Resend when you add each subdomain in the dashboard. The SPF and DMARC records are standard.

Repeat for each subdomain: `email`, `hello`, `notify`, `explore`, `learn`, `promo`.

---

## Step 3: Add Subdomains in Resend

1. Go to **Resend Dashboard → Domains → Add Domain** for each subdomain
2. Enter the full subdomain (e.g., `mail.flipops.io`)
3. Resend will provide the specific DKIM CNAME values
4. Add the DNS records from Step 2
5. Verify each subdomain

---

## Step 4: Configure `from` Addresses

Once subdomains are verified, use them in your email sending:

```typescript
// Transactional (form confirmations, password resets)
from: 'FlipOps <notifications@mail.flipops.io>'

// Product alerts (guardrails, deal updates)
from: 'FlipOps Alerts <alerts@email.flipops.io>'

// Welcome sequences
from: 'Tanner from FlipOps <tanner@hello.flipops.io>'

// Newsletter
from: 'FlipOps Insights <newsletter@explore.flipops.io>'

// Promotional
from: 'FlipOps <team@promo.flipops.io>'
```

---

## Step 5: Warm-Up Strategy

New subdomains have no sending reputation. Ramp up volume gradually:

| Week | Daily Volume | Notes |
|------|-------------|-------|
| 1 | 10–25 | Send to your most engaged contacts first |
| 2 | 50–100 | Monitor bounce rates and spam reports |
| 3 | 200–500 | Check inbox placement with mail-tester.com |
| 4+ | Scale as needed | Maintain <2% bounce rate, <0.1% spam complaints |

### Tips
- Start with **transactional** subdomains (mail, email, notify) — these naturally have high engagement
- **Marketing** subdomains (explore, learn, promo) should warm up separately
- Send to real, opted-in contacts only
- Include clear unsubscribe links in all marketing emails

---

## Step 6: Testing

1. **mail-tester.com** — Send a test email and check your score (aim for 9+/10)
2. **Resend Dashboard → Logs** — Monitor delivery rates, bounces, complaints
3. **Check SPF/DKIM/DMARC alignment** — Use [MXToolbox](https://mxtoolbox.com/SuperTool.aspx) with the subdomain

---

## DMARC Policy Progression

Start with `p=none` (monitoring only), then tighten:

| Phase | DMARC Policy | When |
|-------|-------------|------|
| Launch | `v=DMARC1; p=none; rua=mailto:dmarc@flipops.io` | First 2–4 weeks |
| Monitor | `v=DMARC1; p=quarantine; pct=25; rua=mailto:dmarc@flipops.io` | After clean reports |
| Enforce | `v=DMARC1; p=reject; rua=mailto:dmarc@flipops.io` | After 30+ days clean |

---

## Current Application Email Usage

| Location | Current `from` | Should become |
|----------|---------------|---------------|
| `/api/reserve-spot` (confirmation) | `notifications@flipops.io` | `notifications@mail.flipops.io` |
| `/api/reserve-spot` (internal) | `notifications@flipops.io` | `notifications@mail.flipops.io` |
| `/api/lead` (notification) | `notifications@flipops.io` | `notifications@mail.flipops.io` |
| Cron job alerts | `notifications@flipops.io` | `alerts@email.flipops.io` |
| Future newsletters | — | `newsletter@explore.flipops.io` |
| Future onboarding | — | `tanner@hello.flipops.io` |

> **Action:** Once subdomains are verified, update the `from` field in `lib/integrations/resend.ts` and individual API routes.

---

## Cost

- Subdomains: **Free** (just DNS records on your existing domain)
- Resend: Existing plan covers sending
- SSL: Handled automatically (Let's Encrypt / Cloudflare)
- No additional hosting needed for sending-only subdomains
