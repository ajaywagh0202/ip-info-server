import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";

export const requireAdminAuth = async (req, res, next) => {
  try {
    const authHeader = req.get("Authorization") || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "Unauthorized." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id)
      .select("username name dept_code dept_name user_type")
      .lean();

    if (!admin) {
      return res.status(401).json({ error: "Unauthorized." });
    }

    // Authorize with the current database role/dept, not stale token claims.
    // This also makes tokens issued before user_type/dept_code was added safe.
    req.admin = {
      id: admin._id.toString(),
      username: admin.username,
      name: admin.name,
      dept_code: String(admin.dept_code || "").trim(),
      dept_name: String(admin.dept_name || "").trim(),
      user_type: Number(admin.user_type)
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized." });
  }
};

export const requireSuperAdmin = (req, res, next) => {
  if (!req.admin || Number(req.admin.user_type) !== 0) {
    return res.status(403).json({ error: "Access denied. Super user only." });
  }

  return next();
};
