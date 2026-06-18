import express from "express";
import Department from "../models/Department.js";

const router = express.Router();

router.get("/departments", async (req, res) => {
  try {
    const departments = await Department.find({}).sort({ deptname: 1 });
    return res.status(200).json({ success: true, data: departments });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
