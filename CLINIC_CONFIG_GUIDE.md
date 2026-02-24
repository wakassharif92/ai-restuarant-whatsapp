# Clinic Configuration Guide

Before launching Vapi, configure these settings in your admin dashboard:

## 1. Working Hours

Set in **Settings** → **Working Hours** (JSON format):

```json
{
  "mon": "09:00-17:00",
  "tue": "09:00-17:00",
  "wed": "09:00-17:00",
  "thu": "09:00-17:00",
  "fri": "10:00-16:00",
  "sat": "09:00-13:00",
  "sun": "closed"
}
```

## 2. Slot Duration

**Settings** → **Slot Step** (minutes): `15` (offers slots every 15 min)

- Options: 15, 30, 45 minutes

## 3. Buffer Time

**Settings** → **Buffer Minutes** (time between patients): `5`

- Default: 5 minutes
- For rush clinic: 0 minutes

## 4. Services

Each service MUST have:

- Name: "Dental Cleaning"
- Duration: 30 (minutes)
- Price: 1500 (PKR)
- Currency: PKR
- Active: ✅

**Critical**: All clinic prices + durations come from this table. Never hardcode.

## 5. Blocked Times

Mark breaks/holidays:

- **Lunch**: 13:00-14:00 daily
- **Friday Prayer**: 12:00-13:30 on Fridays
- **Holidays**: Full day blocks

Format dates as ISO: `2024-02-25T13:00:00Z`

## 6. Admin Access

Login at: `http://localhost:3000/admin/clinic.html`
Default:

- Username: `clinic_admin`
- Password: `clinic_admin`

Change immediately in production.

## 7. Vapi Configuration

In Vapi dashboard:

**System Prompt**: Use [VAPI_CLINIC_SYSTEM_PROMPT.md](VAPI_CLINIC_SYSTEM_PROMPT.md)

**Tools** (5 total):

1. `get_services` (optional - list all services)
2. `check_availability` (REQUIRED - check real slots)
3. `book_appointment` (REQUIRED - create booking)
4. `find_appointment` (OPTIONAL - for cancellations)
5. `send_whatsapp` (OPTIONAL - send confirmation)

**Server URL**:

- Local: `http://localhost:3000/api/clinic/vapi-webhook`
- Production: `https://your-url.vercel.app/api/clinic/vapi-webhook`

**Bearer Token**: Set `VAPI_WEBHOOK_TOKEN` env var for security

## 8. WhatsApp Setup (Optional)

To send confirmations:

```
BUSINESS_WHATSAPP_NUMBER=+923001234567
WA_PHONE_NUMBER_ID=xxx
WA_ACCESS_TOKEN=xxx
```

## 9. Database Check

Verify tables exist:

```sql
SELECT * FROM services;                    -- 5 sample services
SELECT * FROM clinic_settings;             -- 1 config row
SELECT * FROM appointments;                -- Patient bookings
SELECT * FROM blocked_times;               -- Holidays/breaks
SELECT * FROM clinic_admin_users;          -- Staff logins
```

## 10. Test Before Going Live

1. Book an appointment via Vapi
2. Verify it appears in admin panel
3. Try booking same time → should be blocked
4. Cancel booking in admin → check Vapi can rebook
5. Set lunch break in Blocked Times → Vapi shouldn't offer 1pm

---

**Questions?** All logic is in `/api/clinic.js` and `/api/vapi/webhook.js`
