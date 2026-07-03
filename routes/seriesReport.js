import express from "express";
import IpInfo from "../models/IpInfo.js";
import { requireAdminAuth } from "../middleware/auth.middleware.js";
import { applyDepartmentScope } from "../utils/departmentScope.js";
import { includeRegistrationData } from "../utils/includeRegistrationData.js";

const router = express.Router();

router.get("/series-report/:series_no", requireAdminAuth, async (req, res) => {
  try {
    const seriesNo = String(req.params.series_no || "").trim();

    if (!seriesNo) {
      return res.status(400).json({ error: "Series number is required." });
    }

    const query = await applyDepartmentScope(req, { serial_no: seriesNo });
    const records = await IpInfo.find(query).sort({ submitted_at: -1 }).lean();

    if (!records.length) {
      return res.status(404).json({ error: "No records found for this Series number." });
    }

    const enrichedRecords = await includeRegistrationData(records);

    return res.status(200).json({
      success: true,
      total: enrichedRecords.length,
      data: enrichedRecords
    });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
