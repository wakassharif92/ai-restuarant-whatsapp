// api/retell/webhook.js
const crypto = require("crypto");
const axios = require("axios");

/**
 * OPTIONAL: verify Retell webhook signature (only if you configured one).
 * If RETELL_WEBHOOK_SECRET is not set, verification is skipped.
 *
 * NOTE: True signature verification usually requires the RAW request body.
 * Vercel parses JSON by default, so treat this as a placeholder until you
 * confirm Retell's exact signing method + header name.
 */
function verifySignature(req) {
  const secret = process.env.RETELL_WEBHOOK_SECRET;
  if (!secret) return { ok: true, skipped: true };

  const sig =
    req.headers["x-retell-signature"] ||
    req.headers["x-signature"] ||
    req.headers["x-webhook-signature"];

  if (!sig) return { ok: false, reason: "Missing signature header" };

  const payload = JSON.stringify(req.body || {});
  const computed = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  let ok = false;
  try {
    ok = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(computed));
  } catch {
    ok = false;
  }

  return { ok, skipped: false, reason: ok ? undefined : "Signature mismatch" };
}

async function sendWhatsAppMessage(text, recipientPhone) {
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
  const accessToken = process.env.WA_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.log("⚠️ Missing WA env vars: WA_PHONE_NUMBER_ID / WA_ACCESS_TOKEN");
    return { ok: false, error: "Missing WhatsApp credentials" };
  }

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

  console.log("✅ WA SEND RESPONSE:", JSON.stringify(resp.data, null, 2));
  return { ok: true, data: resp.data };
}

function formatOrderForWhatsApp({ orderId, order }) {
  const lines = [];

  lines.push(`🧾 New Order: ${orderId}`);
  lines.push(`Name: ${order.name || "-"}`);
  lines.push(`Phone: ${order.phone || "-"}`);
  lines.push(`Type: ${order.orderType || "-"}`);
  lines.push(`Branch: ${order.branch || "-"}`);

  if ((order.orderType || "").toLowerCase() === "delivery") {
    lines.push(`Address: ${order.address || "-"}`);
  }

  if (order.payment) lines.push(`Payment: ${order.payment}`);

  lines.push("");
  lines.push("🍔 Items:");
  (order.items || []).forEach((it, idx) => {
    const mods =
      Array.isArray(it.modifiers) && it.modifiers.length
        ? ` [${it.modifiers.join(", ")}]`
        : "";
    const note = it.notes ? ` (Note: ${it.notes})` : "";
    lines.push(`${idx + 1}) ${it.quantity} x ${it.name}${mods}${note}`);
  });

  if (order.specialInstructions) {
    lines.push("");
    lines.push(`📝 Instructions: ${order.specialInstructions}`);
  }

  return lines.join("\n");
}

/**
 * Example: Menu search stub
 * Replace with your real menu DB/search.
 */
async function menuSearch(query) {
  const q = (query || "").toLowerCase();

  const menu = [
    { id: "zinger_burger", name: "Zinger Burger", price: 8.99 },
    { id: "zinger_meal", name: "Zinger Meal", price: 12.49 },
    { id: "fries", name: "Fries", price: 2.99 },
    { id: "pepsi", name: "Pepsi", price: 1.99 },
    { id: "7up", name: "7Up", price: 1.99 },
  ];

  const results = menu.filter((item) => item.name.toLowerCase().includes(q));
  return { results };
}

/**
 * Create order + send to WhatsApp (business number)
 * IMPORTANT: This expects order fields directly (NO wrapper object).
 */
async function createOrder(order) {
  const orderId = `ord_${Date.now()}`;

  // Minimal validation - only require name and phone
  if (!order || !order.name || !order.phone) {
    return { ok: false, error: "Order must include name and phone" };
  }

  // Enforce address for delivery
  if ((order.orderType || "").toLowerCase() === "delivery" && !order.address) {
    return {
      ok: false,
      error: "Delivery address is required for delivery orders",
    };
  }

  // Send order to restaurant WhatsApp
  const businessNumber = process.env.BUSINESS_WHATSAPP_NUMBER; // e.g. 923001234567 (no +)
  if (!businessNumber) {
    console.log("⚠️ BUSINESS_WHATSAPP_NUMBER missing. Skipping WhatsApp send.");
  } else {
    const waText = formatOrderForWhatsApp({ orderId, order });
    try {
      await sendWhatsAppMessage(waText, businessNumber);
    } catch (e) {
      console.error(
        "❌ Failed to send WhatsApp:",
        e?.response?.data || e.message,
      );
      // Don’t fail the order just because WhatsApp failed
    }
  }

  return {
    ok: true,
    order_id: orderId,
    summary: `Created order ${orderId} and sent to WhatsApp (if configured).`,
    order,
  };
}

/**
 * Tool router: map Retell tool name -> functions
 * IMPORTANT: create_order uses toolArgs directly (no { order: ... } wrapper)
 */
async function handleToolCall(toolName, toolArgs) {
  switch (toolName) {
    case "menu_search": {
      const { query } = toolArgs || {};
      return await menuSearch(query);
    }

    case "create_order": {
      return await createOrder(toolArgs || {});
    }

    default:
      return { ok: false, error: `Unknown tool: ${toolName}` };
  }
}

module.exports = async (req, res) => {
  const logData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    query: req.query,
    headers: req.headers,
    body: req.body,
  };

  console.log("=== RETELL WEBHOOK REQUEST RECEIVED ===");
  console.log(JSON.stringify(logData, null, 2));

  // Retell tool calls will be POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // OPTIONAL signature verification
  const sig = verifySignature(req);
  if (!sig.ok) {
    console.log("❌ RETELL SIGNATURE VERIFY FAILED:", sig.reason);
    return res.status(401).json({ error: "Invalid signature" });
  }
  if (sig.skipped) {
    console.log(
      "⚠️ Signature verification skipped (RETELL_WEBHOOK_SECRET not set)",
    );
  }

  try {
    const body = req.body || {};

    // Detect tool/function call (shape can vary)
    const toolCall =
      body.tool_call ||
      body.function_call ||
      body?.data?.tool_call ||
      body?.data?.function_call;

    if (toolCall) {
      const toolName = toolCall.name || toolCall.tool_name;
      const toolArgs = toolCall.arguments || toolCall.args || {};

      console.log("🧩 Tool call detected:", { toolName, toolArgs });

      const result = await handleToolCall(toolName, toolArgs);

      console.log("✅ Tool result:", JSON.stringify(result, null, 2));

      // Return tool result (Retell may require a specific key; adjust after first real payload)
      return res.status(200).json({
        ok: true,
        tool_result: result,
      });
    }

    // Otherwise treat as an event callback
    const eventType =
      body.event || body.event_type || body.type || body?.data?.event_type;

    if (eventType) {
      console.log("📞 Retell event detected:", eventType);
      return res.status(200).json({ ok: true });
    }

    console.log("⚠️ Unknown Retell webhook payload shape");
    return res.status(200).json({ ok: true, note: "Unhandled payload shape" });
  } catch (error) {
    console.error("RETELL WEBHOOK ERROR:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
