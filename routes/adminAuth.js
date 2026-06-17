const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const admin = await Admin.findOne({ username });

    if (!admin) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const passwordMatches = await bcrypt.compare(password, admin.password);

    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const payload = {
      id: admin._id.toString(),
      username: admin.username,
      name: admin.name,
      dept_code: admin.dept_code,
      dept_name: admin.dept_name,
      user_type: admin.user_type
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "8h" });

    return res.status(200).json({
      token,
      user_type: admin.user_type,
      dept_code: admin.dept_code,
      dept_name: admin.dept_name,
      name: admin.name
    });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;
