# Clinic System Architecture

## System Overview

```
                         CLINIC APPOINTMENT SYSTEM
                    (Separate from Restaurant)

┌─────────────────────────────────────────────────────────┐
│                    PATIENT / STAFF                       │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  1. Patient calls Vapi              2. Clinic staff     │
│     "I want appointment"             access dashboard    │
│     ↓                                 ↓                   │
│  📱 VAPI VOICE AI           →        🏥 ADMIN PANEL      │
│  (check_availability)                /admin/clinic.html │
│  (book_appointment)                  Login: clinic_admin │
│                                                           │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ↓
        ┌──────────────────────────────────┐
        │   LOCAL SERVER / VERCEL          │
        │   (Node.js Express)              │
        ├──────────────────────────────────┤
        │                                  │
        │  Routes:                         │
        │  POST /api/clinic/login          │
        │  GET  /api/clinic/appointments   │
        │  POST /api/clinic/appointments   │
        │  PATCH /api/clinic/appointments  │
        │  GET  /api/clinic/services       │
        │  POST /api/clinic/services       │
        │  GET  /api/clinic/blocked-times  │
        │  POST /api/clinic/blocked-times  │
        │  GET  /api/clinic/settings       │
        │  POST /api/clinic/settings       │
        │  POST /api/clinic/vapi-webhook   │
        │                                  │
        └──────────┬───────────────────────┘
                   │
        ┌──────────┴────────────────┬────────────────┐
        ↓                           ↓                ↓
    ┌────────────┐          ┌──────────────┐   ┌──────────┐
    │  SUPABASE  │          │   SERVICES   │   │ WHATSAPP │
    │ PostgreSQL │          │   MODULES    │   │   API    │
    ├────────────┤          ├──────────────┤   └──────────┘
    │            │          │              │        ↑
    │ Tables:    │          │ Validate     │        │
    │            │          │ Generate     │   Send SMS to
    │ services   │ ←────────→ slots        │   clinic phone
    │ appts      │          │ Check        │   + patient
    │ blocked    │          │ availability │
    │ settings   │          │ Book appt    │
    │ admin_users│          │              │
    │            │          └──────────────┘
    └────────────┘

```

## Data Flow: Vapi Appointment Booking

```
VAPI WEBHOOK CALL
│
├─ Receives toolCalls array with:
│  ├─ Function: check_availability
│  │   Arguments: {date, service_id}
│  │
│  └─ Function: book_appointment
│     Arguments: {patient_name, patient_phone, service_id, slot_start_at}
│
└─ Processes each toolCall:

   check_availability:
   ├─ Get service duration
   ├─ Get clinic settings (working hours, slots)
   ├─ Get blocked times for that date
   ├─ Get existing appointments
   ├─ Generate available slots
   └─ Return: {ok: true, available_slots: [...]}

   book_appointment:
   ├─ Check for conflicts
   ├─ Create appointment record
   ├─ Send WhatsApp confirmation
   └─ Return: {ok: true, appointment_id: "..."}

RESPONSE TO VAPI:
└─ {
    "results": [
      {"toolCallId": "...", "result": "{...}"},
      {"toolCallId": "...", "result": "{...}"}
    ]
   }
```

## Admin Panel Structure

```
┌─────────────────────────────────────┐
│   CLINIC MANAGEMENT DASHBOARD       │
├─────────────────────────────────────┤
│ Header: 🏥 Clinic Management        │
│ [Logout]                            │
├────────────┬──────────────────────┤
│ SIDEBAR    │ MAIN CONTENT          │
├────────────┤                       │
│ 📅 Appts   │ [Appointments View]   │
│            │ • Patient Name        │
│ 💉 Services│ • Phone               │
│            │ • Service             │
│ 🚫 Blocked │ • Date/Time           │
│            │ • Status (booked/...)│
│ ⚙️ Settings│ • Actions (Complete) │
│            │                       │
│            │ [Status Filter Drop]  │
│            │ [Refresh Button]      │
│            │                       │
│            │ [Services View]       │
│            │ • Name, Duration      │
│            │ • Price, Active       │
│            │ [Add Service Form]    │
│            │                       │
│            │ [Blocked Times View]  │
│            │ • Start, End, Reason  │
│            │ [Add Blocked Time]    │
│            │                       │
│            │ [Settings View]       │
│            │ • Timezone            │
│            │ • Working Hours (JSON)│
│            │ • Slot Step           │
│            │ [Save Button]         │
│            │                       │
└────────────┴──────────────────────┘
```

## Database Schema Diagram

```
┌──────────────────────┐
│   clinic_admin_users │
├──────────────────────┤
│ id (PK)              │ ← Used for JWT
│ username (unique)    │
│ password_plain       │
│ is_super             │
│ created_at           │
└──────────────────────┘

┌──────────────────────┐
│     services         │
├──────────────────────┤
│ id (PK)              │
│ name                 │ ← "Root Canal"
│ duration_minutes     │ ← 60
│ price                │ ← 5000
│ currency             │ ← "PKR"
│ is_active            │
│ created_at           │
└──────────────────────┘
          │
          │ references
          │
          ↓
┌──────────────────────────────────┐
│      appointments                │
├──────────────────────────────────┤
│ id (PK)                          │
│ patient_name                     │ ← "Ali Ahmed"
│ patient_phone                    │ ← "+923001234567"
│ service_id (FK) ─────────────────┼─→ services.id
│ start_at                         │ ← Unique + indexed
│ end_at                           │
│ status                           │ ← booked/completed/cancelled
│ notes                            │
│ source                           │ ← vapi/admin/api
│ created_at                       │
│                                  │
│ ⭐ Unique Index on start_at     │
│    (prevents double booking)     │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│    clinic_settings (single row)  │
├──────────────────────────────────┤
│ id (PK)                          │
│ timezone                         │ ← "Asia/Karachi"
│ working_hours (JSON)             │ ← {"mon": "09-17", ...}
│ slot_step_minutes                │ ← 15
│ buffer_minutes                   │ ← 5
│ created_at                       │
│                                  │
│ ⭐ Unique Constraint: only 1 row│
└──────────────────────────────────┘

┌──────────────────────────────────┐
│      blocked_times               │
├──────────────────────────────────┤
│ id (PK)                          │
│ start_at                         │ ← Indexed
│ end_at                           │ ← Indexed
│ reason                           │ ← "Lunch break"
│ created_at                       │
│                                  │
│ ⭐ Prevents booking during time │
└──────────────────────────────────┘
```

## API Request/Response Examples

### 1. Clinic Login

```
REQUEST:
POST /api/clinic/login
{
  "username": "clinic_admin",
  "password": "clinic_admin"
}

RESPONSE:
{
  "ok": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin_id": "uuid",
  "username": "clinic_admin",
  "type": "clinic"
}
```

### 2. Check Availability (from Vapi)

```
REQUEST (Vapi sends):
POST /api/clinic/vapi-webhook
{
  "message": {
    "toolCalls": [
      {
        "id": "call_123",
        "function": {
          "name": "check_availability",
          "arguments": {
            "date": "2024-02-25",
            "service_id": "service-uuid"
          }
        }
      }
    ]
  }
}

RESPONSE (we send):
{
  "results": [
    {
      "toolCallId": "call_123",
      "result": "{
        \"ok\": true,
        \"service_name\": \"Root Canal\",
        \"available_slots\": [
          \"2024-02-25T09:00:00Z\",
          \"2024-02-25T09:30:00Z\",
          \"2024-02-25T14:00:00Z\"
        ],
        \"slot_count\": 3
      }"
    }
  ]
}
```

### 3. Book Appointment (from Vapi)

```
REQUEST (Vapi sends):
POST /api/clinic/vapi-webhook
{
  "message": {
    "toolCalls": [
      {
        "id": "call_456",
        "function": {
          "name": "book_appointment",
          "arguments": {
            "patient_name": "Ahmed Khan",
            "patient_phone": "+923001234567",
            "service_id": "service-uuid",
            "slot_start_at": "2024-02-25T14:00:00Z",
            "notes": "First time patient"
          }
        }
      }
    ]
  }
}

RESPONSE (we send):
{
  "results": [
    {
      "toolCallId": "call_456",
      "result": "{
        \"ok\": true,
        \"appointment_id\": \"appt-uuid\",
        \"patient_name\": \"Ahmed Khan\",
        \"patient_phone\": \"+923001234567\",
        \"service\": \"Root Canal\",
        \"scheduled_at\": \"2024-02-25T14:00:00Z\",
        \"message\": \"Appointment confirmed for Root Canal\"
      }"
    }
  ]
}

SIDE EFFECT:
→ WhatsApp sent to patient:
  "✅ Appointment Confirmed!
   Service: Root Canal
   Date/Time: Feb 25, 2:00 PM
   Duration: 60 minutes
   Price: 5000 PKR"
```

## Authentication Flow

```
1. ADMIN TRIES TO LOGIN
   │
   └─→ POST /api/clinic/login
       {username, password}
       │
       ├─ Query: SELECT * FROM clinic_admin_users WHERE username = ?
       │
       ├─ Compare: password_plain === input_password
       │
       └─ If match:
           └─→ Sign JWT
               {admin_id, username, is_super, type: "clinic"}
               Expires: 7 days
               Secret: ADMIN_JWT_SECRET
               │
               └─→ Return token to client
                   localStorage.setItem("clinic_token", token)
                   localStorage.setItem("clinic_admin_id", id)

2. ADMIN MAKES REQUESTS
   │
   └─→ GET /api/clinic/appointments
       │
       ├─ Query Supabase (RLS handles permission)
       │
       └─→ Return appointments list

3. LOGOUT
   │
   └─→ localStorage.removeItem("clinic_token")
       localStorage.removeItem("clinic_admin_id")
```

## Conflict Prevention (Double Booking)

```
SCENARIO: Patient tries to book 2 PM slot

1. Create appointment with:
   start_at: 2024-02-25T14:00:00Z
   end_at:   2024-02-25T14:30:00Z
   status:   'booked'

2. Database has UNIQUE INDEX:
   CREATE UNIQUE INDEX uniq_active_appointment_start
   ON appointments(start_at)
   WHERE status = 'booked'

3. Result:
   ✅ First booking: succeeds
   ❌ Second booking same time: UNIQUE violation error
      → Appointment already booked (rejected)

4. If appointment is:
   • cancelled → Index ignores (not 'booked')
   • completed → Index ignores (not 'booked')
   • no_show  → Index ignores (not 'booked')
   → Slot becomes available again
```

## Restaurant vs Clinic Comparison

```
RESTAURANT SYSTEM          │  CLINIC SYSTEM
──────────────────────────┼──────────────────────────
Login: /api/admin/login   │  Login: /api/clinic/login
DB: restaurants table     │  DB: clinic_admin_users
DB: menu_items            │  DB: services
DB: orders                │  DB: appointments
DB: orders.items (array)  │  DB: appointments.service_id
Vapi: menu_search()       │  Vapi: check_availability()
Vapi: create_order()      │  Vapi: book_appointment()
Admin: /admin/index.html  │  Admin: /admin/clinic.html
Phone: RESTAURANT_WA_TO   │  Phone: CLINIC_WA_TO
Source: "vapi"/"api"      │  Source: "vapi"/"admin"/"api"
──────────────────────────┼──────────────────────────
SAME:
• JWT authentication
• Supabase RLS security
• WhatsApp notifications
• Vapi toolCalls pattern
```

## Deployment Architecture

```
┌─────────────────────────────────────┐
│         VERCEL (Production)         │
├─────────────────────────────────────┤
│                                     │
│  Serverless Functions (10 total):  │
│  ├─ /api/admin/* (restaurant)      │
│  ├─ /api/order (restaurant)        │
│  ├─ /api/vapi/webhook (restaurant) │
│  ├─ /api/clinic/login              │
│  ├─ /api/clinic/appointments       │
│  ├─ /api/clinic/services           │
│  ├─ /api/clinic/blocked-times      │
│  ├─ /api/clinic/settings           │
│  └─ /api/clinic/vapi-webhook       │
│                                     │
│  Static Files:                      │
│  ├─ /admin/index.html (restaurant) │
│  └─ /admin/clinic.html (clinic)    │
│                                     │
├─────────────────────────────────────┤
│    Environment Variables:            │
│  • SUPABASE_URL                     │
│  • SUPABASE_KEY                     │
│  • WA_ACCESS_TOKEN                  │
│  • WA_PHONE_NUMBER_ID               │
│  • RESTAURANT_WA_TO                 │
│  • CLINIC_WA_TO                     │
│  • ADMIN_JWT_SECRET                 │
│  • VAPI_WEBHOOK_TOKEN (optional)    │
│                                     │
└─────────────────────────────────────┘
          │
          │ Uses
          ↓
    ┌────────────────┐
    │    SUPABASE    │
    │  PostgreSQL    │
    │    (Cloud)     │
    └────────────────┘
```
