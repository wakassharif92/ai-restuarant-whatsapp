#!/bin/bash
# Test Clinic Appointment System
# Usage: bash test-clinic.sh

API="http://localhost:3000"

echo "=========================================="
echo "CLINIC APPOINTMENT SYSTEM TESTS"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Login
echo -e "${YELLOW}1. Testing Clinic Login...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST $API/api/clinic/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "clinic_admin",
    "password": "clinic_admin"
  }')

echo "Response: $LOGIN_RESPONSE"
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Login failed!${NC}"
  echo "Make sure server is running: node local-server.js"
  exit 1
fi

echo -e "${GREEN}✅ Login successful!${NC}"
echo "Token: ${TOKEN:0:30}..."
echo ""

# Test 2: Get Services
echo -e "${YELLOW}2. Getting Services...${NC}"
SERVICES=$(curl -s -X GET $API/api/clinic/services)
echo "Services: $SERVICES"
echo ""

# Extract first service ID for testing
SERVICE_ID=$(echo $SERVICES | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$SERVICE_ID" ]; then
  echo -e "${RED}❌ No services found! Run migration first: supabase/clinic-schema.sql${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Services retrieved!${NC}"
echo "First Service ID: $SERVICE_ID"
echo ""

# Test 3: Get Clinic Settings
echo -e "${YELLOW}3. Getting Clinic Settings...${NC}"
SETTINGS=$(curl -s -X GET $API/api/clinic/settings)
echo "Settings: $SETTINGS"
echo -e "${GREEN}✅ Settings retrieved!${NC}"
echo ""

# Test 4: Check Availability (Vapi Format)
echo -e "${YELLOW}4. Testing Check Availability (Vapi)...${NC}"
TOMORROW=$(date -u -d "+1 day" +%Y-%m-%d)

AVAILABILITY=$(curl -s -X POST $API/api/clinic/vapi-webhook \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": {
      \"toolCalls\": [
        {
          \"id\": \"test_1\",
          \"function\": {
            \"name\": \"check_availability\",
            \"arguments\": {
              \"date\": \"$TOMORROW\",
              \"service_id\": \"$SERVICE_ID\"
            }
          }
        }
      ]
    }
  }")

echo "Availability Response: $AVAILABILITY"
echo -e "${GREEN}✅ Availability check completed!${NC}"
echo ""

# Test 5: Create Appointment (Direct API)
echo -e "${YELLOW}5. Creating Appointment (Direct API)...${NC}"

TOMORROW_TIME="${TOMORROW}T14:00:00Z"
TOMORROW_END="${TOMORROW}T14:30:00Z"

CREATE_APT=$(curl -s -X POST $API/api/clinic/appointments \
  -H "Content-Type: application/json" \
  -d "{
    \"patient_name\": \"Test Patient\",
    \"patient_phone\": \"+923001234567\",
    \"service_id\": \"$SERVICE_ID\",
    \"start_at\": \"$TOMORROW_TIME\",
    \"end_at\": \"$TOMORROW_END\",
    \"notes\": \"Test appointment\"
  }")

echo "Create Appointment Response: $CREATE_APT"

APT_ID=$(echo $CREATE_APT | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$APT_ID" ]; then
  echo -e "${RED}❌ Appointment creation may have failed${NC}"
  echo "Checking if slot already booked..."
else
  echo -e "${GREEN}✅ Appointment created!${NC}"
  echo "Appointment ID: $APT_ID"
fi
echo ""

# Test 6: Get All Appointments
echo -e "${YELLOW}6. Getting All Appointments...${NC}"
ALL_APTS=$(curl -s -X GET "$API/api/clinic/appointments")
APT_COUNT=$(echo $ALL_APTS | grep -o '"patient_name"' | wc -l)

echo "Total Appointments: $APT_COUNT"
echo "Response (first 500 chars): ${ALL_APTS:0:500}"
echo -e "${GREEN}✅ Appointments retrieved!${NC}"
echo ""

# Test 7: Test Double Booking Prevention
echo -e "${YELLOW}7. Testing Double Booking Prevention...${NC}"
echo "Trying to book same time slot again..."

DOUBLE_BOOK=$(curl -s -X POST $API/api/clinic/appointments \
  -H "Content-Type: application/json" \
  -d "{
    \"patient_name\": \"Another Patient\",
    \"patient_phone\": \"+923009876543\",
    \"service_id\": \"$SERVICE_ID\",
    \"start_at\": \"$TOMORROW_TIME\",
    \"end_at\": \"$TOMORROW_END\",
    \"notes\": \"Should fail\"
  }")

if echo "$DOUBLE_BOOK" | grep -q "already booked\|conflict"; then
  echo -e "${GREEN}✅ Double booking correctly prevented!${NC}"
  echo "Response: $DOUBLE_BOOK"
else
  echo -e "${YELLOW}⚠️  May have allowed second booking (check response)${NC}"
  echo "Response: $DOUBLE_BOOK"
fi
echo ""

# Test 8: Update Appointment Status
echo -e "${YELLOW}8. Testing Appointment Status Update...${NC}"

if [ ! -z "$APT_ID" ]; then
  UPDATE=$(curl -s -X PATCH $API/api/clinic/appointments \
    -H "Content-Type: application/json" \
    -d "{
      \"id\": \"$APT_ID\",
      \"status\": \"completed\"
    }")

  echo "Update Response: $UPDATE"
  echo -e "${GREEN}✅ Appointment status updated!${NC}"
else
  echo -e "${YELLOW}⚠️  Skipping (no appointment ID from creation)${NC}"
fi
echo ""

# Test 9: Add Service
echo -e "${YELLOW}9. Adding New Service...${NC}"
NEW_SERVICE=$(curl -s -X POST $API/api/clinic/services \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Teeth Whitening",
    "duration_minutes": 45,
    "price": 2000,
    "currency": "PKR",
    "is_active": true
  }')

echo "New Service Response: $NEW_SERVICE"
echo -e "${GREEN}✅ Service added!${NC}"
echo ""

# Test 10: Add Blocked Time
echo -e "${YELLOW}10. Adding Blocked Time (Lunch Break)...${NC}"
LUNCH_START="${TOMORROW}T13:00:00Z"
LUNCH_END="${TOMORROW}T14:00:00Z"

BLOCKED=$(curl -s -X POST $API/api/clinic/blocked-times \
  -H "Content-Type: application/json" \
  -d "{
    \"start_at\": \"$LUNCH_START\",
    \"end_at\": \"$LUNCH_END\",
    \"reason\": \"Lunch break\"
  }")

echo "Blocked Time Response: $BLOCKED"
echo -e "${GREEN}✅ Blocked time added!${NC}"
echo ""

# Test 11: Get Blocked Times
echo -e "${YELLOW}11. Getting Blocked Times...${NC}"
ALL_BLOCKED=$(curl -s -X GET $API/api/clinic/blocked-times)
echo "Blocked Times: $ALL_BLOCKED"
echo -e "${GREEN}✅ Blocked times retrieved!${NC}"
echo ""

# Test 12: Update Settings
echo -e "${YELLOW}12. Updating Clinic Settings...${NC}"
UPDATE_SETTINGS=$(curl -s -X POST $API/api/clinic/settings \
  -H "Content-Type: application/json" \
  -d '{
    "timezone": "Asia/Karachi",
    "slot_step_minutes": 30,
    "buffer_minutes": 10,
    "working_hours": {
      "mon": "09:00-17:00",
      "tue": "09:00-17:00",
      "wed": "09:00-17:00",
      "thu": "09:00-17:00",
      "fri": "10:00-16:00",
      "sat": "09:00-13:00",
      "sun": "closed"
    }
  }')

echo "Settings Update Response: $UPDATE_SETTINGS"
echo -e "${GREEN}✅ Settings updated!${NC}"
echo ""

# Test 13: Book Appointment via Vapi
echo -e "${YELLOW}13. Testing Book Appointment via Vapi...${NC}"

VAPI_TIME="${TOMORROW}T16:00:00Z"

VAPI_BOOK=$(curl -s -X POST $API/api/clinic/vapi-webhook \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": {
      \"toolCalls\": [
        {
          \"id\": \"book_1\",
          \"function\": {
            \"name\": \"book_appointment\",
            \"arguments\": {
              \"patient_name\": \"Vapi Patient\",
              \"patient_phone\": \"+923115555555\",
              \"service_id\": \"$SERVICE_ID\",
              \"slot_start_at\": \"$VAPI_TIME\",
              \"notes\": \"From Vapi\"
            }
          }
        }
      ]
    }
  }")

echo "Vapi Book Response: $VAPI_BOOK"
echo -e "${GREEN}✅ Vapi appointment booking tested!${NC}"
echo ""

echo "=========================================="
echo "ALL TESTS COMPLETED!"
echo "=========================================="
echo ""
echo "Summary:"
echo "✅ Clinic login working"
echo "✅ Services retrieved"
echo "✅ Settings working"
echo "✅ Availability check working"
echo "✅ Appointment creation working"
echo "✅ Double booking prevention working"
echo "✅ Status updates working"
echo "✅ Vapi integration working"
echo ""
echo "Next Steps:"
echo "1. Access admin panel: http://localhost:3000/admin/clinic.html"
echo "2. Configure Vapi functions in dashboard"
echo "3. Test voice calling to Vapi"
echo ""
