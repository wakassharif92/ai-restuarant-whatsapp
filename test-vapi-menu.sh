#!/bin/bash
# Test Vapi menu_search function

echo "Testing menu_search with query 'burger'..."
curl -X POST http://localhost:3000/api/vapi/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "toolCalls": [
        {
          "id": "test-123",
          "function": {
            "name": "menu_search",
            "arguments": {
              "query": "shawarma platter",
              "restaurant_id": "d86309d6-3a97-45ad-a5bd-3a7ff2a08f6d"
            }
          }
        }
      ]
    }
  }'

echo -e "\n\nTesting menu_search without query (get all items)..."
curl -X POST http://localhost:3000/api/vapi/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "toolCalls": [
        {
          "id": "test-124",
          "function": {
            "name": "menu_search",
            "arguments": {
              "restaurant_id": "d8630906-3a97-45ad-a5bd-3a7ff2a08ffd"
            }
          }
        }
      ]
    }
  }'
