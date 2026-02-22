// api/vapi/webhook.js
const { getSupabase, getTableNames } = require("../../lib/supabase");

/**
 * Vapi Tool Webhook Handler
 *
 * Supported tools:
 * - menu_search: Search menu items
 * - create_order: Create and save order
 */

async function menuSearch(query, restaurantId) {
  const { ok, supabase, error } = getSupabase();
  if (!ok) return { ok: false, error };

  const { menu } = getTableNames();
  const q = (query || "").trim();

  let dbQuery = supabase
    .from(menu)
    .select("name, description, price, currency")
    .eq("is_available", true);

  if (restaurantId) {
    dbQuery = dbQuery.eq("restaurant_id", restaurantId);
  }

  if (q) {
    dbQuery = dbQuery.ilike("name", `%${q}%`);
  }

  const { data, error: menuError } = await dbQuery;

  if (menuError) {
    return { ok: false, error: menuError.message || menuError };
  }

  return { ok: true, results: data || [] };
}

async function createOrder(orderData) {
  const orderId = `ord_${Date.now()}`;

  if (!orderData.name || !orderData.phone) {
    return { ok: false, error: "Name and phone are required" };
  }

  if (orderData.orderType === "delivery" && !orderData.address) {
    return { ok: false, error: "Address required for delivery" };
  }

  const { ok, supabase, error } = getSupabase();
  if (!ok) return { ok: false, error };

  const { orders } = getTableNames();

  const orderPayload = {
    order_id: orderId,
    restaurant_id: orderData.restaurant_id || null,
    customer_name: orderData.name,
    customer_phone: orderData.phone,
    order_type: orderData.orderType || "pickup",
    address: orderData.address || null,
    payment: orderData.payment || "cash",
    notes: orderData.notes || null,
    items: orderData.items || [],
    raw: orderData,
    source: "vapi",
    status: "new",
  };

  const { data: orderRow, error: orderError } = await supabase
    .from(orders)
    .insert([orderPayload])
    .select("*")
    .single();

  if (orderError) {
    return { ok: false, error: orderError.message || orderError };
  }

  // Send WhatsApp notification
  const businessNumber = process.env.BUSINESS_WHATSAPP_NUMBER;
  if (businessNumber) {
    try {
      const axios = require("axios");
      const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
      const accessToken = process.env.WA_ACCESS_TOKEN;

      if (phoneNumberId && accessToken) {
        const message = formatOrderMessage(orderId, orderData);
        await axios.post(
          `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
          {
            messaging_product: "whatsapp",
            to: businessNumber,
            type: "text",
            text: { body: message },
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          },
        );
      }
    } catch (waError) {
      console.error("WhatsApp send failed:", waError.message);
    }
  }

  return { ok: true, orderId, order: orderRow };
}

function formatOrderMessage(orderId, order) {
  const lines = [
    `🧾 New Order: ${orderId}`,
    `Name: ${order.name}`,
    `Phone: ${order.phone}`,
    `Type: ${order.orderType || "pickup"}`,
  ];

  if (order.orderType === "delivery") {
    lines.push(`Address: ${order.address}`);
  }

  lines.push(`Payment: ${order.payment || "cash"}`);
  lines.push("");
  lines.push("🍔 Items:");

  (order.items || []).forEach((item, idx) => {
    lines.push(
      `${idx + 1}) ${item.quantity || 1}x ${item.name}${
        item.notes ? ` (${item.notes})` : ""
      }`,
    );
  });

  if (order.notes) {
    lines.push("");
    lines.push(`📝 Notes: ${order.notes}`);
  }

  return lines.join("\n");
}

function parseToolArguments(maybeArgs) {
  // Some platforms send arguments as a JSON string
  if (typeof maybeArgs === "string") {
    try {
      return JSON.parse(maybeArgs);
    } catch (e) {
      return null;
    }
  }
  // Otherwise assume it's already an object
  return maybeArgs;
}

module.exports = async (req, res) => {
  // CORS headers (allow Authorization for Bearer tokens)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  // ✅ OPTIONAL but strongly recommended: verify Vapi secret token
  // Set VAPI_WEBHOOK_TOKEN in Vercel env, and add the same token as Bearer credential in Vapi Tool.
  const requiredToken = process.env.VAPI_WEBHOOK_TOKEN;
  if (requiredToken) {
    const auth = req.headers.authorization || "";
    const expected = `Bearer ${requiredToken}`;
    if (auth !== expected) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    const { message } = req.body;

    if (!message?.toolCalls || message.toolCalls.length === 0) {
      return res.status(200).json({
        results: [{ toolCallId: "none", result: "No function called" }],
      });
    }

    const results = [];

    for (const toolCall of message.toolCalls) {
      const { id, function: fn } = toolCall;
      const functionName = fn?.name;

      const args = parseToolArguments(fn?.arguments);
      if (!args || typeof args !== "object") {
        results.push({
          toolCallId: id,
          result: JSON.stringify({ error: "Invalid tool arguments" }),
        });
        continue;
      }

      console.log(`[Vapi] Function call: ${functionName}`, args);

      let result;

      if (functionName === "menu_search") {
        const searchResult = await menuSearch(args.query, args.restaurant_id);
        result = searchResult.ok
          ? { items: searchResult.results }
          : { error: searchResult.error };
      } else if (functionName === "create_order") {
        const orderResult = await createOrder(args);
        result = orderResult.ok
          ? { orderId: orderResult.orderId, success: true }
          : { error: orderResult.error };
      } else {
        result = { error: `Unknown function: ${functionName}` };
      }

      results.push({
        toolCallId: id,
        result: JSON.stringify(result),
      });
    }

    return res.status(200).json({ results });
  } catch (err) {
    console.error("[Vapi] Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
