# Test Order Creation
# This will create an order, save it to Supabase, and send a WhatsApp notification

curl -X POST http://localhost:3000/api/order \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Customer",
    "phone": "1234567890",
    "branch": "Al Madina Istanbul",
    "orderType": "delivery",
    "address": "123 Test Street",
    "payment": "cash",
    "items": [
      {
        "name": "Burger",
        "qty": 2,
        "notes": "No onions"
      },
      {
        "name": "Fries",
        "qty": 1
      }
    ]
  }'
