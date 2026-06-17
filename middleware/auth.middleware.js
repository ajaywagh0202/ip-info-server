const jwt = require("jsonwebtoken");

export const requireAdminAuth = async (req, res, next) => {
  try {
    const authHeader = req.get("Authorization") || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "Unauthorized." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized." });
  }
};

const requireSuperAdmin = (req, res, next) => {
  if (!req.admin || Number(req.admin.user_type) !== 0) {
    return res.status(403).json({ error: "Access denied. Super user only." });
  }

  return next();
};

module.exports = {
  requireAdminAuth,
  requireSuperAdmin
};
