const axios = require("axios");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getSupabase, getTableNames } = require("../lib/supabase");
const { requireAdmin, verifyJwt } = require("../lib/admin-auth");

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-admin-token",
  );
}

function normalizeQueryValue(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function formatOrder(o) {
  const hasStructuredItems = Array.isArray(o.items) && o.items.length > 0;

  const itemsText = hasStructuredItems
    ? o.items
        .map((i) => {
          const name = i?.name ?? i?.item_name ?? "";
          const qty = i?.quantity ?? i?.qty ?? 1;
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

async function handleAdminLogin(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: "ADMIN_JWT_SECRET is not set" });
  }

  const { ok, supabase, error } = getSupabase();
  if (!ok) return res.status(500).json({ error });

  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    const { data: user, error: userError } = await supabase
      .from("admin_users")
      .select("id, username, password_plain, restaurant_name, is_super")
      .eq("username", username)
      .single();

    if (userError || !user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!user.password_plain || password !== user.password_plain) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    let restaurant = null;
    if (user.restaurant_name) {
      const { data: restaurantRow } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("name", user.restaurant_name)
        .single();
      restaurant = restaurantRow || null;
    }

    const token = jwt.sign(
      {
        user_id: user.id,
        username: user.username,
        restaurant_id: restaurant?.id || null,
        is_super: !!user.is_super,
      },
      secret,
      { expiresIn: "7d" },
    );

    return res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        is_super: !!user.is_super,
      },
      restaurant,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Unexpected error" });
  }
}

async function handleAdminMenu(req, res) {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const { ok, supabase, error } = getSupabase();
  if (!ok) return res.status(500).json({ error });

  const { menu } = getTableNames();
  const requestRestaurantId =
    req.query.restaurant_id || req.query.restaurantId || null;
  const restaurantId = admin.is_super
    ? requestRestaurantId || admin.restaurant_id
    : admin.restaurant_id;

  if (!restaurantId) {
    return res.status(400).json({ error: "restaurant_id is required" });
  }

  try {
    if (req.method === "GET") {
      let query = supabase
        .from(menu)
        .select("*")
        .order("name", { ascending: true });
      query = query.eq("restaurant_id", restaurantId);
      const { data, error: queryError } = await query;
      if (queryError) {
        return res
          .status(500)
          .json({ error: queryError.message || queryError });
      }
      return res.json({ ok: true, items: data || [] });
    }

    if (req.method === "POST") {
      const payload = { ...(req.body || {}), restaurant_id: restaurantId };
      if (!payload.name) {
        return res.status(400).json({ error: "Name is required" });
      }
      const { data, error: insertError } = await supabase
        .from(menu)
        .insert([payload])
        .select("*")
        .single();
      if (insertError) {
        return res
          .status(500)
          .json({ error: insertError.message || insertError });
      }
      return res.json({ ok: true, item: data });
    }

    if (req.method === "PUT") {
      const payload = { ...(req.body || {}), restaurant_id: restaurantId };
      if (!payload.id) {
        return res.status(400).json({ error: "id is required" });
      }
      const { id, ...updates } = payload;
      const { data, error: updateError } = await supabase
        .from(menu)
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();
      if (updateError) {
        return res
          .status(500)
          .json({ error: updateError.message || updateError });
      }
      return res.json({ ok: true, item: data });
    }

    if (req.method === "DELETE") {
      const id = req.body?.id || req.query.id;
      if (!id) {
        return res.status(400).json({ error: "id is required" });
      }
      const { error: deleteError } = await supabase
        .from(menu)
        .delete()
        .eq("id", id);
      if (deleteError) {
        return res
          .status(500)
          .json({ error: deleteError.message || deleteError });
      }
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Unexpected error" });
  }
}

async function handleAdminOrders(req, res) {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { ok, supabase, error } = getSupabase();
  if (!ok) return res.status(500).json({ error });

  const { orders } = getTableNames();
  const requestRestaurantId =
    req.query.restaurant_id || req.query.restaurantId || null;
  const restaurantId = admin.is_super
    ? requestRestaurantId || admin.restaurant_id
    : admin.restaurant_id;

  if (!restaurantId) {
    return res.status(400).json({ error: "restaurant_id is required" });
  }
  const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);

  try {
    let query = supabase
      .from(orders)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    query = query.eq("restaurant_id", restaurantId);

    const { data, error: queryError } = await query;
    if (queryError) {
      return res.status(500).json({ error: queryError.message || queryError });
    }

    return res.json({ ok: true, orders: data || [] });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Unexpected error" });
  }
}

async function handleAdminSession(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  const verified = verifyJwt(token);
  if (!verified.ok) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const { ok, supabase, error } = getSupabase();
  if (!ok) return res.status(500).json({ error });

  const payload = verified.payload || {};
  let restaurant = null;

  if (payload.restaurant_id) {
    const { data: restaurantRow } = await supabase
      .from("restaurants")
      .select("id, name")
      .eq("id", payload.restaurant_id)
      .single();
    restaurant = restaurantRow || null;
  }

  return res.json({
    ok: true,
    user: {
      id: payload.user_id,
      username: payload.username,
      is_super: !!payload.is_super,
    },
    restaurant,
  });
}

async function handleAdminSettings(req, res) {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const { ok, supabase, error } = getSupabase();
  if (!ok) return res.status(500).json({ error });

  const { settings } = getTableNames();
  const requestRestaurantId =
    req.query.restaurant_id || req.query.restaurantId || null;
  const restaurantId = admin.is_super
    ? requestRestaurantId || admin.restaurant_id
    : admin.restaurant_id;

  if (!restaurantId) {
    return res.status(400).json({ error: "restaurant_id is required" });
  }

  try {
    if (req.method === "GET") {
      let query = supabase.from(settings).select("*").limit(1);
      query = query.eq("restaurant_id", restaurantId);
      const { data, error: queryError } = await query;
      if (queryError) {
        return res
          .status(500)
          .json({ error: queryError.message || queryError });
      }
      return res.json({ ok: true, settings: data?.[0] || null });
    }

    if (req.method === "POST" || req.method === "PUT") {
      const payload = { ...(req.body || {}), restaurant_id: restaurantId };

      const { data, error: upsertError } = await supabase
        .from(settings)
        .upsert(payload, { onConflict: "restaurant_id" })
        .select("*")
        .single();

      if (upsertError) {
        return res
          .status(500)
          .json({ error: upsertError.message || upsertError });
      }

      return res.json({ ok: true, settings: data });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Unexpected error" });
  }
}

async function handleAdminUsers(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const admin = requireAdmin(req, res);
  if (!admin) return;
  if (!admin.is_super) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { ok, supabase, error } = getSupabase();
  if (!ok) return res.status(500).json({ error });

  try {
    const { username, password, restaurant_name, restaurant_id, is_super } =
      req.body || {};

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    let restaurantId = restaurant_id || null;

    if (!restaurantId) {
      if (!restaurant_name) {
        return res.status(400).json({
          error:
            "restaurant_name is required when restaurant_id is not provided",
        });
      }

      const { data: restaurantRow, error: restaurantError } = await supabase
        .from("restaurants")
        .insert([{ name: restaurant_name }])
        .select("*")
        .single();

      if (restaurantError) {
        return res.status(500).json({
          error: restaurantError.message || restaurantError,
        });
      }

      restaurantId = restaurantRow.id;
    }

    const password_hash = await bcrypt.hash(password, 10);

    const { data: user, error: userError } = await supabase
      .from("admin_users")
      .insert([
        {
          username,
          password_hash,
          restaurant_id: restaurantId,
          is_super: !!is_super,
        },
      ])
      .select("id, username, restaurant_id, is_super")
      .single();

    if (userError) {
      return res.status(500).json({ error: userError.message || userError });
    }

    return res.json({ ok: true, user });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Unexpected error" });
  }
}

async function handleOrder(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const requiredToken = process.env.VAPI_WEBHOOK_TOKEN;
  if (requiredToken) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${requiredToken}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
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

    const { ok, supabase, error } = getSupabase();
    if (!ok) {
      return res.status(500).json({ error });
    }

    const { orders } = getTableNames();
    const orderId = order.order_id || `ord_${Date.now()}`;
    const restaurantId =
      order.restaurant_id || req.query.restaurant_id || req.query.restaurantId;

    const orderPayload = {
      order_id: orderId,
      restaurant_id: restaurantId || null,
      customer_name: order.name || null,
      customer_phone: order.phone || null,
      order_type: order.orderType || null,
      address: order.address || null,
      payment: order.payment || null,
      notes: order.notes || order.specialInstructions || null,
      items: order.items || null,
      raw: order,
      source: "api",
      status: "new",
    };

    const { data: orderRow, error: orderError } = await supabase
      .from(orders)
      .insert([orderPayload])
      .select("*")
      .single();

    if (orderError) {
      return res.status(500).json({
        error: "Failed to save order",
        details: orderError.message || orderError,
      });
    }

    const message = formatOrder(order);
    const waResponse = await sendWhatsAppMessage(message);

    return res.json({ success: true, order: orderRow, whatsapp: waResponse });
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
}

async function handleWebhook(req, res) {
  const logData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    query: req.query,
    headers: req.headers,
    body: req.body,
  };

  console.log("=== WEBHOOK REQUEST RECEIVED ===");
  console.log(JSON.stringify(logData, null, 2));

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

    return res.status(200).json({
      success: true,
      received: {
        object: body.object,
        entryCount: body.entry?.length || 0,
      },
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

function handleHealth(req, res) {
  return res.json({ ok: true, timestamp: new Date().toISOString() });
}

module.exports = async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const section = normalizeQueryValue(req.query.section);

  if (section === "admin") {
    const adminPath = normalizeQueryValue(req.query.path) || "";
    if (adminPath === "login") return handleAdminLogin(req, res);
    if (adminPath === "menu") return handleAdminMenu(req, res);
    if (adminPath === "orders") return handleAdminOrders(req, res);
    if (adminPath === "settings") return handleAdminSettings(req, res);
    if (adminPath === "users") return handleAdminUsers(req, res);
    if (adminPath === "session") return handleAdminSession(req, res);

    return res.status(404).json({ error: "Unknown admin endpoint" });
  }

  if (section === "order") return handleOrder(req, res);
  if (section === "webhook") return handleWebhook(req, res);
  if (section === "health") return handleHealth(req, res);

  return res.status(404).json({ error: "Unknown endpoint" });
};
