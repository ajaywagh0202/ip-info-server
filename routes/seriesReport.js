const express = require("express");
const IpInfo = require("../models/IpInfo");
const { requireAdminAuth } = require("../middleware/auth.middleware");
const { applyDeptFilter } = require("../utils/applyDeptFilter");

const router = express.Router();

router.get("/series-report/:series_no", requireAdminAuth, async (req, res) => {
  try {
    const seriesNo = String(req.params.series_no || "").trim();

    if (!seriesNo) {
      return res.status(400).json({ error: "Series number is required." });
    }

    const query = applyDeptFilter(req, { serial_no: seriesNo });
    const records = await IpInfo.find(query).sort({ submitted_at: -1 });

    if (!records.length) {
      return res.status(404).json({ error: "No records found for this Series number." });
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

module.exports = router;
