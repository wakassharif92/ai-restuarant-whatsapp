#!/bin/bash
# Test Vapi create_order function

echo "Testing create_order..."
curl -X POST http://localhost:3000/api/vapi/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "toolCalls": [
        {
          "id": "test-125",
          "function": {
            "name": "create_order",
            "arguments": {
              "name": "John Doe",
              "phone": "1234567890",
              "orderType": "delivery",
              "address": "123 Main St",
              "payment": "cash",
              "restaurant_id": "d8630906-3a97-45ad-a5bd-3a7ff2a08ffd",
              "items": [
                {
                  "name": "Burger",
                  "quantity": 2,
                  "notes": "No onions"
                },
                {
                  "name": "Fries",
                  "quantity": 1
                }
              ],
              "notes": "Please ring doorbell"
            }
          }
        }
      ]
    }
  }'
