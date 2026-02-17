require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

function formatOrder(o) {
  // Prefer structured items array (ideal case)
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
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WA_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post("/webhook", (req, res) => {
  console.log("WEBHOOK EVENT:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

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

app.post("/order", async (req, res) => {
  try {
    const order = req.body || {};

    // Accept either structured items OR fallback strings
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
    await sendWhatsAppMessage(message);

    return res.json({ success: true });
  } catch (err) {
    console.error("STATUS:", err.response?.status);
    console.error("DATA:", JSON.stringify(err.response?.data, null, 2));
    console.error("MSG:", err.message);

    return res.status(500).json({
      error: "WhatsApp send failed",
      meta: err.response?.data,
    });
  }
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Export for Vercel serverless
module.exports = app;

// Local development
if (require.main === module) {
  app.listen(process.env.PORT || 3000, () => {
    console.log(`Server running on port ${process.env.PORT || 3000}`);
  });
}
