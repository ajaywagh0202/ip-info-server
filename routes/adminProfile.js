const express = require("express");
const bcrypt = require("bcrypt");
const Admin = require("../models/Admin");
const { requireAdminAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(requireAdminAuth);

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

router.get("/me", async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select("-password");

    if (!admin) {
      return res.status(404).json({ error: "Profile not found." });
    }

    return res.status(200).json({
      success: true,
      data: {
        username: admin.username,
        name: admin.name,
        pf_no: admin.pf_no,
        dept_code: admin.dept_code,
        dept_name: admin.dept_name,
        designation: admin.designation,
        user_type: admin.user_type
      }
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load profile. Please try again." });
  }
});

router.put("/change-password", async (req, res) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;

    if (
      !isNonEmptyString(current_password) ||
      !isNonEmptyString(new_password) ||
      !isNonEmptyString(confirm_password)
    ) {
      return res.status(400).json({ error: "All fields are required." });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({ error: "New password and confirm password do not match." });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters." });
    }

    if (new_password === current_password) {
      return res.status(400).json({ error: "New password must be different from current password." });
    }

    const admin = await Admin.findById(req.admin.id);

    if (!admin) {
      return res.status(404).json({ error: "Profile not found." });
    }

    const passwordMatches = await bcrypt.compare(current_password, admin.password);

    if (!passwordMatches) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    admin.password = await bcrypt.hash(new_password, 10);
    await admin.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully."
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to change password. Please try again." });
  }
});

module.exports = router;
