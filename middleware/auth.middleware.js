const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

const requireAdminAuth = async (req, res, next) => {
  try {
    const authHeader = req.get("Authorization") || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id).select("-password");

    if (!admin) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    req.admin = admin;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid credentials." });
  }
};

module.exports = {
  requireAdminAuth
};
