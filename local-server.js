require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());
app.use("/admin", express.static(path.join(__dirname, "admin")));

// Restaurant endpoints (consolidated)
const restaurantHandler = require("./api/restaurant");
const vapiWebhook = require("./api/vapi/webhook");

// Clinic endpoints (consolidated)
const clinicHandler = require("./api/clinic");

// Restaurant routes (consolidated)
app.all("/api/admin/:path", (req, res) => {
  req.query.section = "admin";
  req.query.path = req.params.path;
  return restaurantHandler(req, res);
});
app.all("/api/order", (req, res) => {
  req.query.section = "order";
  return restaurantHandler(req, res);
});
app.all("/api/webhook", (req, res) => {
  req.query.section = "webhook";
  return restaurantHandler(req, res);
});
app.all("/api/health", (req, res) => {
  req.query.section = "health";
  return restaurantHandler(req, res);
});
app.post("/api/vapi/webhook", (req, res) => vapiWebhook(req, res));

// Clinic routes (consolidated)
app.all("/api/clinic/:path", (req, res) => {
  req.query.path = req.params.path;
  return clinicHandler(req, res);
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Restaurant WhatsApp Server (Local)",
    endpoints: {
      health: "/api/health",
      webhook: "/api/webhook",
      order: "/api/order",
      admin: "/api/admin/*",
    },
  });
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
