export default function handler(req, res) {
  res.status(200).json({
    provider: "retell",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
