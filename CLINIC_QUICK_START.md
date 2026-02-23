# Clinic System - Quick Summary

## What Was Created

### 1. **Separate Clinic Backend** (`/api/clinic/`)

- `login.js` - Clinic admin authentication
- `appointments.js` - CRUD for patient bookings
- `services.js` - Manage dental treatments
- `blocked-times.js` - Manage breaks & holidays
- `settings.js` - Configure working hours & slots
- `vapi-webhook.js` - Voice AI integration (check_availability, book_appointment)

### 2. **Clinic Admin Dashboard** (`/admin/clinic.html`)

- **Completely separate UI from restaurant**
- Login with clinic credentials
- Manage appointments with status updates
- Add/edit services (treatments)
- Set working hours and breaks
- Real-time appointment list

### 3. **Database Schema** (`/supabase/clinic-schema.sql`)

- 5 new tables: services, clinic_settings, blocked_times, appointments, clinic_admin_users
- RLS policies for security
- Unique index preventing double bookings
- Sample data included (default admin: clinic_admin/clinic_admin)

### 4. **Routes in Local Server**

All clinic endpoints added to `local-server.js`:

```
/api/clinic/login
/api/clinic/appointments
/api/clinic/services
/api/clinic/blocked-times
/api/clinic/settings
/api/clinic/vapi-webhook
```

## Key Differences: Restaurant vs Clinic

| Aspect             | Restaurant                      | Clinic                                  |
| ------------------ | ------------------------------- | --------------------------------------- |
| **Login**          | `/api/admin/login`              | `/api/clinic/login`                     |
| **Database**       | restaurants, menu_items, orders | services, appointments, clinic_settings |
| **Admin Panel**    | /admin/index.html               | /admin/clinic.html                      |
| **Vapi Functions** | menu_search, create_order       | check_availability, book_appointment    |
| **Core Data**      | Menu items, orders              | Services/treatments, appointments       |

## How Vapi Works with Clinic

1. **Patient calls Vapi:** "I want to book an appointment"
2. **Vapi asks:** "What service? What date?"
3. **Vapi calls check_availability** → Gets free slots from /api/clinic/vapi-webhook
4. **Patient selects time** → "Yes, 2 PM works"
5. **Vapi calls book_appointment** → Saves to Supabase appointments table
6. **Patient gets confirmation** → WhatsApp message with appointment details

## Configuration Needed

### Environment Variables (add to .env):

```bash
CLINIC_WA_TO=+923001234567     # Clinic phone for notifications
VAPI_WEBHOOK_TOKEN=optional_secret  # Bearer token for Vapi (optional)
```

### Database Setup:

1. Open Supabase SQL Editor
2. Copy entire contents of `supabase/clinic-schema.sql`
3. Run migration (creates tables + sample data)

### Vapi Functions:

In Vapi Dashboard, create 2 Custom Tools:

**Function 1: check_availability**

- Parameters: date (YYYY-MM-DD), service_id (UUID)
- Returns: Available time slots for that date

**Function 2: book_appointment**

- Parameters: patient_name, patient_phone, service_id, slot_start_at, notes
- Returns: Confirmation with appointment ID

Both point to webhook: `http://localhost:3000/api/clinic/vapi-webhook` (or Vercel URL)

## Testing

### Access Admin Panel:

```
http://localhost:3000/admin/clinic.html
Login: clinic_admin / clinic_admin
```

### Test API:

```bash
# Get all appointments
curl http://localhost:3000/api/clinic/appointments

# Get services
curl http://localhost:3000/api/clinic/services

# Check availability (Vapi format)
curl -X POST http://localhost:3000/api/clinic/vapi-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "toolCalls": [{
        "id": "test_1",
        "function": {
          "name": "check_availability",
          "arguments": {"date": "2024-02-25", "service_id": "service-uuid"}
        }
      }]
    }
  }'
```

## File Locations

```
restaurants/
├── api/clinic/
│   ├── login.js
│   ├── appointments.js
│   ├── services.js
│   ├── blocked-times.js
│   ├── settings.js
│   └── vapi-webhook.js
├── admin/
│   ├── index.html (Restaurant)
│   └── clinic.html (Clinic) ← NEW
├── supabase/
│   ├── schema.sql (Restaurant)
│   └── clinic-schema.sql (Clinic) ← NEW
├── local-server.js (Updated with clinic routes)
└── CLINIC_SETUP.md (Detailed documentation)
```

## What's Same as Restaurant System

- JWT authentication pattern (7-day tokens)
- Supabase RLS security model
- WhatsApp notifications
- Vapi webhook handler pattern
- Local server + Vercel deployment

## What's Different

- Separate database tables (no shared data between restaurant & clinic)
- Separate admin UI (completely different interface)
- Different Vapi functions (appointments vs orders)
- Time-slot based system vs item-based ordering
- Double-booking prevention (unique index on appointment time)

## Next Steps

1. ✅ Run `supabase/clinic-schema.sql` migration
2. ✅ Visit http://localhost:3000/admin/clinic.html
3. ✅ Add your clinic services
4. ✅ Configure working hours
5. ✅ Set up Vapi functions in dashboard
6. ✅ Test with curl commands
7. ✅ Deploy to Vercel when ready

## Support

For detailed setup, see: [CLINIC_SETUP.md](./CLINIC_SETUP.md)
For API details, check each endpoint in `/api/clinic/*.js`
