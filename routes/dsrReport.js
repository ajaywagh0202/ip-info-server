import express from "express";
import IpInfo from "../models/IpInfo.js";
import { requireAdminAuth } from "../middleware/auth.middleware.js";
import { applyDeptFilter } from "../utils/applyDeptFilter.js";

const router = express.Router();

router.get("/dsr-report/:dsr_no", requireAdminAuth, async (req, res) => {
  try {
    const dsrNo = String(req.params.dsr_no || "").trim();

    if (!dsrNo) {
      return res.status(400).json({ error: "DSR number is required." });
    }

    const query = applyDeptFilter(req, { dsr_no: dsrNo });
    const records = await IpInfo.find(query).sort({ submitted_at: -1 });

    if (!records.length) {
      return res.status(404).json({ error: "No records found for this DSR number." });
    }

    return res.status(200).json({
      success: true,
      total: records.length,
      data: records
    });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
