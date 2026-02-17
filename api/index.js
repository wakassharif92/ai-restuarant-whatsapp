module.exports = (req, res) => {
  res.json({
    status: "ok",
    message: "Restaurant WhatsApp Webhook Server",
    endpoints: {
      health: "/api/health",
      webhook: "/api/webhook",
      order: "/api/order",
    },
  });
};
