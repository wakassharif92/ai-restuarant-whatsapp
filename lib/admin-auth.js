const jwt = require("jsonwebtoken");

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token.trim();
}

function verifyJwt(token) {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    return { ok: false, error: "ADMIN_JWT_SECRET is not set" };
  }

  try {
    const payload = jwt.verify(token, secret);
    return { ok: true, payload };
  } catch (error) {
    return { ok: false, error: "Invalid token" };
  }
}

function requireAdmin(req, res) {
  const bearer = getBearerToken(req);
  if (bearer) {
    const result = verifyJwt(bearer);
    if (!result.ok) {
      res.status(401).json({ error: result.error });
      return null;
    }
    return result.payload;
  }

  const adminToken = process.env.ADMIN_TOKEN;
  const legacy = req.headers["x-admin-token"];
  if (adminToken && legacy && legacy === adminToken) {
    return { is_super: true, restaurant_id: null, legacy: true };
  }

  res.status(401).json({ error: "Unauthorized" });
  return null;
}

module.exports = { requireAdmin, verifyJwt };
