const crypto = require("crypto");

/**
 * OPTIONAL: verify Retell webhook signature (if Retell provides it in headers).
 * If you don't know the exact header name yet, leave verification disabled
 * until you confirm Retell's signature scheme in their docs/dashboard.
 */
function verifySignature(req) {
  const secret = process.env.RETELL_WEBHOOK_SECRET;
  if (!secret) return { ok: true, skipped: true };

  // Common patterns: x-signature / x-retell-signature / x-webhook-signature
  const sig =
    req.headers["x-retell-signature"] ||
    req.headers["x-signature"] ||
    req.headers["x-webhook-signature"];

  if (!sig) return { ok: false, reason: "Missing signature header" };

  // If Retell signs raw body, you MUST use raw body.
  // Vercel typically parses JSON; this is a placeholder verification.
  // Replace with Retell’s exact signing method once confirmed.
  const payload = JSON.stringify(req.body || {});
  const computed = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  const ok = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(computed));

  return { ok, skipped: false, reason: ok ? undefined : "Signature mismatch" };
}

/**
 * Example: Menu search stub
 * Replace this with your real menu DB/search.
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
 * Example: Create order stub
 * Replace with your real order creation/storage.
 */
async function createOrder(order) {
  const orderId = `ord_${Date.now()}`;

  // Minimal validation (add more later)
  if (!order || !Array.isArray(order.items) || order.items.length === 0) {
    return {
      ok: false,
      error: "Order must include at least 1 item",
    };
  }

  return {
    ok: true,
    order_id: orderId,
    summary: `Created order ${orderId} with ${order.items.length} item(s).`,
    order,
  };
}

/**
 * Tool router: map Retell tool name -> your functions
 */
async function handleToolCall(toolName, toolArgs) {
  switch (toolName) {
    case "menu_search": {
      const { query } = toolArgs || {};
      return await menuSearch(query);
    }

    case "create_order": {
      // Expect toolArgs.order to contain your order schema
      const { order } = toolArgs || {};
      return await createOrder(order);
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
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

  // Retell is typically POST-only
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

    /**
     * Retell payload shape differs by configuration.
     * Two common patterns you’ll see:
     * 1) event callbacks: call_started, call_ended, etc.
     * 2) function/tool call requests (the important part for ordering)
     *
     * So we defensively detect tool calls in a few common locations.
     */

    // --- A) Handle tool/function calls (most important) ---
    // Try a few likely keys; adjust once you see real Retell payload logs.
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

      // Return in a generic tool-result response format.
      // Retell may require a specific wrapper field name. Update once confirmed.
      return res.status(200).json({
        ok: true,
        tool_result: result,
      });
    }

    // --- B) Handle general call events ---
    const eventType =
      body.event || body.event_type || body.type || body?.data?.event_type;

    if (eventType) {
      console.log("📞 Retell event detected:", eventType);

      // You can add event-specific handling here (analytics, logging, etc.)
      // Example:
      // if (eventType === "call_ended") { ... }

      return res.status(200).json({ ok: true });
    }

    // --- C) Unknown payload ---
    console.log("⚠️ Unknown Retell webhook payload shape");
    return res.status(200).json({ ok: true, note: "Unhandled payload shape" });
  } catch (error) {
    console.error("RETELL WEBHOOK ERROR:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
