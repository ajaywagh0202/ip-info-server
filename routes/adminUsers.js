const express = require("express");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const Admin = require("../models/Admin");
const Department = require("../models/Department");
const { requireAdminAuth, requireSuperAdmin } = require("../middleware/auth.middleware");
const { applyDeptFilter } = require("../utils/applyDeptFilter");

const router = express.Router();

const normalizeUserBody = (body) => ({
  username: body.username === undefined ? undefined : String(body.username).trim(),
  name: body.name === undefined ? undefined : String(body.name).trim(),
  pf_no: body.pf_no === undefined ? undefined : String(body.pf_no).trim(),
  dept_code: body.dept_code === undefined ? undefined : String(body.dept_code).trim(),
  dept_name: body.dept_name === undefined ? undefined : String(body.dept_name).trim(),
  designation: body.designation === undefined ? undefined : String(body.designation).trim(),
  user_type:
    body.user_type === undefined || body.user_type === null || String(body.user_type).trim() === ""
      ? undefined
      : Number(body.user_type)
});

const hasRequiredCreateFields = (user) =>
  Boolean(
    user.username &&
      user.name &&
      user.pf_no &&
      user.dept_code &&
      user.dept_name &&
      user.designation &&
      user.user_type !== undefined
  );

const validateUserType = (userType) => userType === 0 || userType === 1;

const requiredTextFields = ["username", "name", "pf_no", "dept_code", "dept_name", "designation"];

const findDepartmentByCode = (deptCode) => Department.findOne({ dept_code: deptCode }).select("_id");

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

const hasDuplicateDepartmentUser = async ({ pf_no, dept_name, excludeId }) => {
  const query = { pf_no, dept_name, user_type: 1 };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const admin = await Admin.findOne(query).select("_id");
  return Boolean(admin);
};

router.get("/users/list", requireAdminAuth, async (req, res) => {
  try {
    const query = applyDeptFilter(req, {});
    const users = await Admin.find(query).select("-password").sort({ name: 1 });

    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/users/create", requireAdminAuth, async (req, res) => {
  try {
    const user = normalizeUserBody(req.body);

    if (!hasRequiredCreateFields(user)) {
      return res.status(400).json({ error: "All fields are required." });
    }

    if (!validateUserType(user.user_type)) {
      return res.status(400).json({ error: "Invalid user type." });
    }

    if (Number(req.admin.user_type) === 1 && user.dept_code !== req.admin.dept_code) {
      return res.status(403).json({ error: "You can only create users in your own department." });
    }

    const department = await findDepartmentByCode(user.dept_code);

    if (!department) {
      return res.status(400).json({ error: "Invalid department code." });
    }

    const existingAdmin = await Admin.findOne({ username: user.username }).select("_id");

    if (existingAdmin) {
      return res.status(400).json({ error: "Username already exists." });
    }

    if (
      user.user_type === 1 &&
      (await hasDuplicateDepartmentUser({ pf_no: user.pf_no, dept_name: user.dept_name }))
    ) {
      return res.status(400).json({
        error: "A department user with this PF number already exists in this department."
      });
    }

    const password = await bcrypt.hash("123456", 10);

    await Admin.create({
      username: user.username,
      name: user.name,
      pf_no: user.pf_no,
      dept_code: user.dept_code,
      dept_name: user.dept_name,
      designation: user.designation,
      user_type: user.user_type,
      password
    });

    return res.status(201).json({
      success: true,
      message: "Admin user created successfully."
    });
  } catch (error) {
    if (error && error.code === 11000 && error.keyPattern && error.keyPattern.username) {
      return res.status(400).json({ error: "Username already exists." });
    }

    return res.status(500).json({ error: "Internal server error." });
  }
});

router.put("/users/edit/:id", requireAdminAuth, requireSuperAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: "Admin user not found." });
    }

    const admin = await Admin.findById(req.params.id);

    if (!admin) {
      return res.status(404).json({ error: "Admin user not found." });
    }

    const updates = normalizeUserBody(req.body);
    const allowedFields = [
      "username",
      "name",
      "pf_no",
      "dept_code",
      "dept_name",
      "designation",
      "user_type"
    ];

    const updatePayload = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updatePayload[field] = updates[field];
      }
    }

    const hasEmptyRequiredTextField = requiredTextFields.some(
      (field) => updatePayload[field] !== undefined && !updatePayload[field]
    );

    if (hasEmptyRequiredTextField) {
      return res.status(400).json({ error: "Updated fields cannot be empty." });
    }

    if (!Object.keys(updatePayload).length) {
      return res.status(400).json({ error: "No valid fields provided for update." });
    }

    if (updatePayload.user_type !== undefined && !validateUserType(updatePayload.user_type)) {
      return res.status(400).json({ error: "Invalid user type." });
    }

    if (updatePayload.username && updatePayload.username !== admin.username) {
      const existingAdmin = await Admin.findOne({
        username: updatePayload.username,
        _id: { $ne: admin._id }
      }).select("_id");

      if (existingAdmin) {
        return res.status(400).json({ error: "Username already exists." });
      }
    }

    if (updatePayload.dept_code && updatePayload.dept_code !== admin.dept_code) {
      const department = await findDepartmentByCode(updatePayload.dept_code);

      if (!department) {
        return res.status(400).json({ error: "Invalid department code." });
      }
    }

    const finalPfNo = updatePayload.pf_no || admin.pf_no;
    const finalDeptName = updatePayload.dept_name || admin.dept_name;
    const finalUserType =
      updatePayload.user_type === undefined ? Number(admin.user_type) : updatePayload.user_type;
    const ruleTwoRelevant =
      finalUserType === 1 &&
      (updatePayload.pf_no !== undefined ||
        updatePayload.dept_name !== undefined ||
        updatePayload.user_type !== undefined);

    if (
      ruleTwoRelevant &&
      (await hasDuplicateDepartmentUser({
        pf_no: finalPfNo,
        dept_name: finalDeptName,
        excludeId: admin._id
      }))
    ) {
      return res.status(400).json({
        error: "A department user with this PF number already exists in this department."
      });
    }

    Object.assign(admin, updatePayload);
    await admin.save();

    return res.status(200).json({
      success: true,
      message: "Admin user updated successfully."
    });
  } catch (error) {
    if (error && error.code === 11000 && error.keyPattern && error.keyPattern.username) {
      return res.status(400).json({ error: "Username already exists." });
    }

    return res.status(500).json({ error: "Internal server error." });
  }
});

router.put("/users/:id/reset-password", requireAdminAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { new_password, confirm_password } = req.body;

    if (!isNonEmptyString(new_password) || !isNonEmptyString(confirm_password)) {
      return res.status(400).json({ error: "All fields are required." });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({ error: "New password and confirm password do not match." });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters." });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: "Admin user not found." });
    }

    const targetAdmin = await Admin.findById(req.params.id);

    if (!targetAdmin) {
      return res.status(404).json({ error: "Admin user not found." });
    }

    if (Number(targetAdmin.user_type) === 0) {
      return res.status(403).json({ error: "Cannot reset password of another Super User." });
    }

    targetAdmin.password = await bcrypt.hash(new_password, 10);
    await targetAdmin.save();

    return res.status(200).json({
      success: true,
      message: `Password reset successfully for user: ${targetAdmin.username}`
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to reset password. Please try again." });
  }
});

router.delete("/users/:id", requireAdminAuth, requireSuperAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: "Admin user not found." });
    }

    const targetAdmin = await Admin.findById(req.params.id);

    if (!targetAdmin) {
      return res.status(404).json({ error: "Admin user not found." });
    }

    if (Number(targetAdmin.user_type) === 0) {
      return res.status(403).json({ error: "Cannot delete a Super User account." });
    }

    if (targetAdmin._id.toString() === String(req.admin.id)) {
      return res.status(403).json({ error: "You cannot delete your own account." });
    }

    const username = targetAdmin.username;
    await Admin.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: `Admin user '${username}' has been deleted successfully.`
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete admin user. Please try again." });
  }
});

module.exports = router;
