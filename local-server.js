require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

function formatOrder(o) {
  const hasStructuredItems = Array.isArray(o.items) && o.items.length > 0;

  const itemsText = hasStructuredItems
    ? o.items
        .map((i) => {
          const name = i?.name ?? "";
          const qty = i?.qty ?? "";
          const notes = i?.notes ? ` (${i.notes})` : "";
          return `- ${name} x${qty}${notes}`.trim();
        })
        .join("\n")
    : `- ${(o.items_name || "").trim()} x${(o.items_qty || "").trim()}${
        o.items_notes ? ` (${o.items_notes})` : ""
      }`.trim();

  return `
🟢 New Order

Name: ${o.name || "N/A"}
Phone: ${o.phone || "N/A"}
Branch: ${o.branch || "N/A"}
Type: ${o.orderType || "N/A"}
Address: ${o.address || "N/A"}

Items:
${itemsText || "-"}

Payment: ${o.payment || "cash"}
`.trim();
}

async function sendWhatsAppMessage(text) {
  const url = `https://graph.facebook.com/v19.0/${process.env.WA_PHONE_NUMBER_ID}/messages`;

  const resp = await axios.post(
    url,
    {
      messaging_product: "whatsapp",
      to: process.env.RESTAURANT_WA_TO,
      type: "text",
      text: { body: text },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    },
  );

  console.log("WA SEND RESPONSE:", JSON.stringify(resp.data, null, 2));
  return resp.data;
}

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Restaurant WhatsApp Server (Local)",
    endpoints: {
      health: "/api/health",
      webhook: "/api/webhook",
      order: "/api/order",
    },
  });
});

// Webhook endpoint
app.get("/api/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("WEBHOOK VERIFY:", { mode, token, challenge });

  if (mode === "subscribe" && token === process.env.WA_VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  }

  console.log("❌ Webhook verification failed");
  return res.status(403).json({ error: "Verification failed" });
});

app.post("/api/webhook", (req, res) => {
  console.log("📨 Webhook POST received:", JSON.stringify(req.body, null, 2));
  res.status(200).json({ success: true });
});

// Order endpoint
app.post("/api/order", async (req, res) => {
  try {
    console.log("📋 Order received:", JSON.stringify(req.body, null, 2));

    const order = req.body || {};

    const hasStructuredItems =
      Array.isArray(order.items) && order.items.length > 0;
    const hasFallbackItems =
      (order.items_name && order.items_name.trim().length > 0) ||
      (order.items_qty && order.items_qty.trim().length > 0);

    if (
      !order.name ||
      !order.phone ||
      (!hasStructuredItems && !hasFallbackItems)
    ) {
      return res.status(400).json({
        error: "Invalid order",
        details:
          "Required: name, phone, and items (array) OR items_name/items_qty",
      });
    }

    const message = formatOrder(order);
    console.log("Sending message:", message);
    await sendWhatsAppMessage(message);

    return res.json({ success: true });
  } catch (err) {
    console.error("Error:", err.message);
    return res.status(500).json({
      error: "WhatsApp send failed",
      message: err.message,
    });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log(`📝 API Endpoints:`);
  console.log(`   GET  http://localhost:${PORT}/api/webhook`);
  console.log(`   POST http://localhost:${PORT}/api/webhook`);
  console.log(`   POST http://localhost:${PORT}/api/order`);
  console.log(`   GET  http://localhost:${PORT}/api/health\n`);
});
