# Clinic Appointment Booking System - Setup Guide

## Overview

Complete separate clinic appointment booking system integrated with Vapi voice AI. This is independent from the restaurant ordering system.

## 📂 File Structure

```
api/clinic/
├── login.js              # Clinic admin authentication (JWT)
├── appointments.js       # CRUD for appointments
├── services.js          # CRUD for services (treatments)
├── blocked-times.js     # Manage breaks, holidays, lunch
├── settings.js          # Clinic configuration (working hours, slots)
└── vapi-webhook.js      # Vapi voice AI integration

admin/clinic.html        # Clinic admin dashboard (separate from restaurant UI)

supabase/clinic-schema.sql  # Database schema migration
```

## 🗄️ Database Schema

### Tables Created:

1. **services** - Dental treatments (Root Canal, Cleaning, etc.)
2. **clinic_settings** - Single-row config (timezone, working hours, slot duration)
3. **blocked_times** - Breaks, holidays, lunch times
4. **appointments** - Patient bookings with collision prevention
5. **clinic_admin_users** - Clinic staff login accounts

### Key Features:

- **Unique index on appointments.start_at** - Prevents double bookings
- **RLS policies** - anon can book, authenticated can manage
- **Working hours config** - Per-day scheduling (e.g., "09:00-17:00")

## 🔑 Authentication

**Default Credentials:**

```
Username: clinic_admin
Password: clinic_admin
```

**JWT Token:** 7-day expiry, contains admin_id, username, type: "clinic"

## 🚀 Setup Steps

### 1. Add Database Schema

Run this in Supabase SQL Editor:

```bash
# Copy entire contents of supabase/clinic-schema.sql into Supabase SQL editor
```

### 2. Local Development

```bash
# Server already includes clinic routes
npm start

# Or run directly:
node local-server.js

# Server will start on http://localhost:3000
```

### 3. Access Clinic Admin Panel

```
http://localhost:3000/admin/clinic.html
```

Login with:

- Username: `clinic_admin`
- Password: `clinic_admin`

### 4. Configure Vapi

#### a. Create check_availability Function

In Vapi Dashboard → Custom Tools → Create Tool:

```json
{
  "name": "check_availability",
  "description": "Check available appointment slots for a specific date and service",
  "parameters": {
    "type": "object",
    "properties": {
      "date": {
        "type": "string",
        "description": "Date in YYYY-MM-DD format (e.g., 2024-02-25)"
      },
      "service_id": {
        "type": "string",
        "description": "UUID of the service/treatment"
      }
    },
    "required": ["date", "service_id"]
  }
}
```

#### b. Create book_appointment Function

```json
{
  "name": "book_appointment",
  "description": "Book a dental appointment for a patient",
  "parameters": {
    "type": "object",
    "properties": {
      "patient_name": {
        "type": "string",
        "description": "Full name of patient"
      },
      "patient_phone": {
        "type": "string",
        "description": "Phone number with country code (e.g., +92301234567)"
      },
      "service_id": {
        "type": "string",
        "description": "UUID of the service/treatment"
      },
      "slot_start_at": {
        "type": "string",
        "description": "Start time in ISO format (e.g., 2024-02-25T09:00:00Z)"
      },
      "notes": {
        "type": "string",
        "description": "Optional notes from patient"
      }
    },
    "required": ["patient_name", "patient_phone", "service_id", "slot_start_at"]
  }
}
```

#### c. Server Settings

- **Server URL:**
  - Local: `http://localhost:3000/api/clinic/vapi-webhook`
  - Production: `https://your-vercel-url.vercel.app/api/clinic/vapi-webhook`
- **Timeout:** 20 seconds
- **Authorization:** None (optional: add Bearer token)

### 5. Environment Variables (.env)

```bash
# Existing (for WhatsApp)
WA_ACCESS_TOKEN=your_access_token
WA_PHONE_NUMBER_ID=your_phone_id
RESTAURANT_WA_TO=12405647628

# For Clinic (optional but recommended)
CLINIC_WA_TO=+923001234567  # Clinic phone number for notifications
VAPI_WEBHOOK_TOKEN=optional_bearer_token

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key

# JWT
ADMIN_JWT_SECRET=your-secret-key
```

## 📱 Admin Panel Features

### 📅 Appointments

- View all appointments (filter by status: booked, completed, cancelled, no_show)
- Mark appointments as completed
- Cancel appointments
- Auto-refresh button

### 💉 Services

- Add new dental services (Root Canal, Cleaning, etc.)
- Set duration and price
- Edit existing services
- Toggle active/inactive status

### 🚫 Blocked Times

- Create breaks (lunch, doctor breaks, holidays)
- Prevents Vapi from booking during blocked times
- Specify reason (for reference)

### ⚙️ Settings

- Timezone configuration (default: Asia/Karachi)
- Working hours per day (JSON format)
- Slot step duration (default: 15 minutes)
- Buffer time between appointments

**Example Working Hours:**

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

## 🤖 Vapi Integration

### How It Works:

1. **Patient calls Vapi** → "I want to book a dental appointment"
2. **Vapi asks:** Service type, preferred date, name, phone
3. **Vapi calls check_availability** → Gets available slots
4. **Patient chooses slot** → "Yes, 2 PM works"
5. **Vapi calls book_appointment** → Saves to Supabase
6. **Patient receives SMS** → Confirmation via WhatsApp

### Webhook Response Format:

Vapi sends:

```json
{
  "message": {
    "toolCalls": [
      {
        "id": "call_123abc",
        "function": {
          "name": "check_availability",
          "arguments": {
            "date": "2024-02-25",
            "service_id": "uuid-here"
          }
        }
      }
    ]
  }
}
```

We return:

```json
{
  "results": [
    {
      "toolCallId": "call_123abc",
      "result": "{\"ok\": true, \"available_slots\": [...]}"
    }
  ]
}
```

## 🧪 Testing

### Test Clinic Login:

```bash
curl -X POST http://localhost:3000/api/clinic/login \
  -H "Content-Type: application/json" \
  -d '{"username":"clinic_admin","password":"clinic_admin"}'
```

### Test Appointment Creation:

```bash
curl -X POST http://localhost:3000/api/clinic/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "patient_name": "Ali Ahmed",
    "patient_phone": "+923001234567",
    "service_id": "service-uuid-here",
    "start_at": "2024-02-25T14:00:00Z",
    "end_at": "2024-02-25T14:30:00Z",
    "notes": "First time patient"
  }'
```

### Test Vapi Webhook (check_availability):

```bash
curl -X POST http://localhost:3000/api/clinic/vapi-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "toolCalls": [
        {
          "id": "test_1",
          "function": {
            "name": "check_availability",
            "arguments": {
              "date": "2024-02-25",
              "service_id": "service-uuid-here"
            }
          }
        }
      ]
    }
  }'
```

## 🔗 API Endpoints

### Authentication

- `POST /api/clinic/login` - Clinic admin login

### Appointments

- `GET /api/clinic/appointments` - List all (filters: ?status=booked)
- `POST /api/clinic/appointments` - Create appointment
- `PATCH /api/clinic/appointments` - Update status (id, status)

### Services

- `GET /api/clinic/services` - List all
- `POST /api/clinic/services` - Add service
- `PUT /api/clinic/services` - Update service
- `DELETE /api/clinic/services` - Delete service

### Blocked Times

- `GET /api/clinic/blocked-times` - List all
- `POST /api/clinic/blocked-times` - Create blocked time
- `DELETE /api/clinic/blocked-times` - Delete blocked time

### Settings

- `GET /api/clinic/settings` - Get clinic config
- `POST /api/clinic/settings` - Update clinic config

### Vapi Webhook

- `POST /api/clinic/vapi-webhook` - Handle Vapi tool calls

## 📊 Database Queries

### Get all appointments for a patient:

```sql
SELECT * FROM appointments WHERE patient_phone = '+923001234567' ORDER BY start_at DESC;
```

### Get available slots for tomorrow:

```sql
SELECT * FROM appointments WHERE start_at >= NOW() + INTERVAL '1 day' AND status = 'booked' ORDER BY start_at;
```

### Get services:

```sql
SELECT id, name, duration_minutes, price FROM services WHERE is_active = true ORDER BY name;
```

## 🚀 Deployment to Vercel

### 1. Update Environment Variables:

```bash
vercel env add CLINIC_WA_TO
# Enter clinic phone number
```

### 2. Update Vapi Webhook URL:

In Vapi Dashboard → Custom Tools → Server Settings:

```
https://your-vercel-domain.vercel.app/api/clinic/vapi-webhook
```

### 3. Deploy:

```bash
vercel --prod
```

### 4. Verify Deployment:

```bash
curl https://your-domain.vercel.app/api/clinic/settings
```

## 🎨 UI Differences: Restaurant vs Clinic

| Feature           | Restaurant Admin                | Clinic Admin                                           |
| ----------------- | ------------------------------- | ------------------------------------------------------ |
| **Login**         | Restaurant-based                | Clinic-based                                           |
| **Main Function** | Manage orders                   | Manage appointments                                    |
| **Menu**          | Food items                      | Medical services                                       |
| **Orders**        | Customer orders                 | Patient appointments                                   |
| **Calendar**      | N/A                             | Appointment calendar                                   |
| **Payment**       | Cash/Card/Online                | Service pricing                                        |
| **Phone**         | RESTAURANT_WA_TO                | CLINIC_WA_TO                                           |
| **URL**           | /admin/index.html               | /admin/clinic.html                                     |
| **Database**      | restaurants, menu_items, orders | services, appointments, blocked_times, clinic_settings |

## ⚠️ Troubleshooting

### Problem: "Cannot POST /api/clinic/login"

**Solution:** Make sure server is running (`node local-server.js`)

### Problem: "Clinic settings not found"

**Solution:** Run the migration SQL to create clinic_settings table, then refresh

### Problem: "Time slot already booked"

**Solution:** Check if another appointment exists at that time. Use admin panel to view all appointments.

### Problem: "No available slots found"

**Solution:**

- Check clinic working hours in settings
- Verify date is within working hours
- Check for blocked times overlapping with requested slot
- Ensure service duration is reasonable

### Problem: WhatsApp notification not sent

**Solution:**

- Verify CLINIC_WA_TO environment variable is set
- Check WA_ACCESS_TOKEN and WA_PHONE_NUMBER_ID are valid
- Review CloudFlare/WhatsApp API logs

## 📞 Default Test Service IDs

After running the migration, services are created. Get IDs from admin panel or:

```bash
curl http://localhost:3000/api/clinic/services
```

## Next Steps

1. ✅ Run database migration
2. ✅ Update environment variables
3. ✅ Access admin panel at http://localhost:3000/admin/clinic.html
4. ✅ Add your clinic services
5. ✅ Configure working hours
6. ✅ Set up Vapi with functions
7. ✅ Deploy to Vercel
8. ✅ Test voice AI appointment booking
