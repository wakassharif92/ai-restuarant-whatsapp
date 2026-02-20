const axios = require("axios");

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

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const order = req.body || {};

    if (!order.name || !order.phone) {
      return res.status(400).json({
        error: "Invalid order",
        details: "Required: name and phone",
      });
    }

    const missing = [
      !process.env.WA_PHONE_NUMBER_ID && "WA_PHONE_NUMBER_ID",
      !process.env.WA_ACCESS_TOKEN && "WA_ACCESS_TOKEN",
      !process.env.RESTAURANT_WA_TO && "RESTAURANT_WA_TO",
    ].filter(Boolean);

    if (missing.length) {
      return res.status(500).json({
        error: "Missing WhatsApp environment variables",
        missing,
      });
    }

    const message = formatOrder(order);
    const waResponse = await sendWhatsAppMessage(message);

    return res.json({ success: true, whatsapp: waResponse });
  } catch (err) {
    console.error("STATUS:", err.response?.status);
    console.error("DATA:", JSON.stringify(err.response?.data, null, 2));
    console.error("MSG:", err.message);

    return res.status(500).json({
      error: "WhatsApp send failed",
      status: err.response?.status,
      meta: err.response?.data,
    });
  }
};
