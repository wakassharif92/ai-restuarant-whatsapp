const axios = require("axios");

async function sendWhatsAppMessage(
  text,
  phoneNumberId,
  accessToken,
  recipientPhone,
) {
  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

  const resp = await axios.post(
    url,
    {
      messaging_product: "whatsapp",
      to: recipientPhone,
      type: "text",
      text: { body: text },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  console.log("WA SEND RESPONSE:", JSON.stringify(resp.data, null, 2));
  return resp.data;
}

module.exports = async (req, res) => {
  const logData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    query: req.query,
    headers: req.headers,
    body: req.body
  };
  
  console.log("=== WEBHOOK REQUEST RECEIVED ===");
  console.log(JSON.stringify(logData, null, 2));

  // Handle GET request for webhook verification
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    console.log("WEBHOOK VERIFY REQUEST:", {
      mode,
      token,
      challenge,
      expected_token: process.env.WA_VERIFY_TOKEN,
      match: token === process.env.WA_VERIFY_TOKEN,
    });

    if (mode === "subscribe" && token === process.env.WA_VERIFY_TOKEN) {
      console.log("✅ WEBHOOK VERIFIED SUCCESSFULLY");
      return res.status(200).send(challenge);
    }

    console.log("❌ WEBHOOK VERIFY FAILED - returning 403");
    return res.status(403).json({ error: "Verification failed" });
  }

  // Handle POST request for webhook events
  if (req.method === "POST") {
    console.log("POST Body:", JSON.stringify(req.body, null, 2));

    const body = req.body;

    if (body.object === "whatsapp_business_account") {
      console.log("✅ WhatsApp Business Account webhook detected");

      body.entry?.forEach((entry) => {
        entry.changes?.forEach((change) => {
          console.log("Change field:", change.field);
          console.log("Change value:", JSON.stringify(change.value, null, 2));

          if (change.field === "messages") {
            const messages = change.value.messages;
            messages?.forEach((message) => {
              console.log("📩 Incoming message:", {
                from: message.from,
                id: message.id,
                type: message.type,
                timestamp: message.timestamp,
                text: message.text?.body,
              });
            });
          }
        });
      });
    } else {
      console.log("⚠️ Webhook object type:", body.object);
    }

    // Return logged data in response for debugging
    return res.status(200).json({ 
      success: true, 
      received: {
        object: body.object,
        entryCount: body.entry?.length || 0
      }
    });
  }

  // Handle other methods
  return res.status(405).json({ error: "Method not allowed" });
};
