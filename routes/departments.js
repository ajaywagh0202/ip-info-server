const express = require("express");
const Department = require("../models/Department");

const router = express.Router();

router.get("/departments", async (req, res) => {
  try {
    const departments = await Department.find({}).sort({ deptname: 1 });
    return res.status(200).json({ success: true, data: departments });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;
