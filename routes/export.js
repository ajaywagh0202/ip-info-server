import express from "express";
import mongoose from "mongoose";
import IpInfo from "../models/IpInfo.js";
import { requireAdminAuth } from "../middleware/auth.middleware.js";
import {
  buildExportRow,
  generateExcel,
  generatePdf
} from "../utils/exportHelper.js";

const router = express.Router();

const VALID_FORMATS = new Set(["pdf", "xlsx"]);
const VALID_REPORT_TYPES = new Set(["ip", "dsr", "series", "all"]);

const timestampForFilename = () => new Date().toISOString().replace(/[:.]/g, "-");

router.post("/export", requireAdminAuth, async (req, res) => {
  try {
    const format = String(req.body.format || "").toLowerCase();
    const reportType = String(req.body.report_type || "").toLowerCase();
    const ids = req.body.ids;

    if (!VALID_FORMATS.has(format)) {
      return res.status(400).json({ error: "Invalid export format." });
    }

    if (!VALID_REPORT_TYPES.has(reportType)) {
      return res.status(400).json({ error: "Invalid report type." });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "No records selected for export." });
    }

    const uniqueIds = [...new Set(ids.map((id) => String(id)))];

    if (uniqueIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json({ error: "Invalid record id." });
    }

    const records = await IpInfo.find({ _id: { $in: uniqueIds } }).sort({ submitted_at: -1 });

    if (Number(req.admin.user_type) === 1) {
      const allowedDeptCode = String(req.admin.dept_code || "");
      const hasDeniedRecord = records.length !== uniqueIds.length ||
        records.some((record) => String(record.dept_code || "") !== allowedDeptCode);

      if (hasDeniedRecord) {
        return res.status(403).json({
          error: "Access denied. You can only export your own department's data."
        });
      }
    }

    const rows = records.map(buildExportRow);
    const filename = `ITC_Report_${reportType}_${timestampForFilename()}.${format}`;

    if (format === "xlsx") {
      const buffer = await generateExcel(rows, reportType);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.status(200).send(Buffer.from(buffer));
    }

    const deptLabel = Number(req.admin.user_type) === 1
      ? req.admin.dept_name || req.admin.dept_code || "Department"
      : "All Departments";
    const buffer = await generatePdf(rows, reportType, deptLabel);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(500).json({ error: "Failed to generate export." });
  }
});

export default router;
