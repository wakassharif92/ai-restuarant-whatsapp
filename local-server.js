require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();
app.use(express.json());
app.use("/admin", express.static(path.join(__dirname, "admin")));

// Restaurant admin endpoints
const adminMenu = require("./api/admin/menu");
const adminSettings = require("./api/admin/settings");
const adminOrders = require("./api/admin/orders");
const adminLogin = require("./api/admin/login");
const adminUsers = require("./api/admin/users");
const adminSession = require("./api/admin/session");
const orderHandler = require("./api/order");
const vapiWebhook = require("./api/vapi/webhook");

// Clinic endpoints
const clinicLogin = require("./api/clinic/login");
const clinicAppointments = require("./api/clinic/appointments");
const clinicServices = require("./api/clinic/services");
const clinicBlockedTimes = require("./api/clinic/blocked-times");
const clinicSettings = require("./api/clinic/settings");
const clinicVapiWebhook = require("./api/clinic/vapi-webhook");

// Restaurant routes
app.all("/api/admin/menu", (req, res) => adminMenu(req, res));
app.all("/api/admin/settings", (req, res) => adminSettings(req, res));
app.all("/api/admin/orders", (req, res) => adminOrders(req, res));
app.all("/api/admin/login", (req, res) => adminLogin(req, res));
app.all("/api/admin/users", (req, res) => adminUsers(req, res));
app.all("/api/admin/session", (req, res) => adminSession(req, res));
app.post("/api/order", (req, res) => orderHandler(req, res));
app.post("/api/vapi/webhook", (req, res) => vapiWebhook(req, res));

// Clinic routes
app.post("/api/clinic/login", (req, res) => clinicLogin(req, res));
app.all("/api/clinic/appointments", (req, res) => clinicAppointments(req, res));
app.all("/api/clinic/services", (req, res) => clinicServices(req, res));
app.all("/api/clinic/blocked-times", (req, res) =>
  clinicBlockedTimes(req, res),
);
app.all("/api/clinic/settings", (req, res) => clinicSettings(req, res));
app.all("/api/clinic/vapi-webhook", (req, res) => clinicVapiWebhook(req, res));

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
