import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import IpInfo from "../models/IpInfo.js";
import { requireAdminAuth } from "../middleware/auth.middleware.js";
import { applyDeptFilter } from "../utils/applyDeptFilter.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PDF_DIR = path.join(__dirname, "..", "IP_INFO_FILE", "PDF_FILE");
const JSON_DIR = path.join(__dirname, "..", "IP_INFO_FILE", "JSON_FILE");

const parseDateBoundary = (value, suffix) => {
  const date = new Date(`${String(value).trim()}${suffix}`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const addOptionalRecordFilters = (req, query) => {
  if (Number(req.admin.user_type) === 0 && req.query.dept_code) {
    query.dept_code = String(req.query.dept_code).trim();
  }

  if (req.query.series_no) {
    query.Series_no = String(req.query.series_no).trim();
  }

  if (req.query.dsr_no) {
    query.dsr_no = String(req.query.dsr_no).trim();
  }

  if (req.query.target_ip) {
    query.target_ip = String(req.query.target_ip).trim();
  }

  if (req.query.from_date || req.query.to_date) {
    query.submitted_at = {};

    if (req.query.from_date) {
      const fromDate = parseDateBoundary(req.query.from_date, "T00:00:00.000Z");

      if (!fromDate) {
        return { error: "Invalid from_date." };
      }

      query.submitted_at.$gte = fromDate;
    }

    if (req.query.to_date) {
      const toDate = parseDateBoundary(req.query.to_date, "T23:59:59.999Z");

      if (!toDate) {
        return { error: "Invalid to_date." };
      }

      query.submitted_at.$lte = toDate;
    }
  }

  return query;
};

router.use(requireAdminAuth);

router.get("/records", async (req, res) => {
  try {
    const query = addOptionalRecordFilters(req, applyDeptFilter(req, {}));

    if (query.error) {
      return res.status(400).json({ error: query.error });
    }

    const records = await IpInfo.find(query).sort({ submitted_at: -1 });

    return res.status(200).json({ success: true, data: records });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

router.get("/records/series/:series_no", async (req, res) => {
  try {
    const query = applyDeptFilter(req, { Series_no: String(req.params.series_no || "").trim() });
    const records = await IpInfo.find(query).sort({ submitted_at: -1 });

    if (!records.length) {
      return res.status(404).json({ error: "No records found for this series number." });
    }

    return res.status(200).json({ success: true, data: records });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

router.get("/records/dsr/:dsr_no", async (req, res) => {
  try {
    const query = applyDeptFilter(req, { dsr_no: String(req.params.dsr_no || "").trim() });
    const records = await IpInfo.find(query).sort({ submitted_at: -1 });

    if (!records.length) {
      return res.status(404).json({ error: "No records found for this DSR number." });
    }

    return res.status(200).json({ success: true, data: records });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

router.get("/ip-list", async (req, res) => {
  try {
    const match = applyDeptFilter(req, {});
    const ipList = await IpInfo.aggregate([
      { $match: match },
      { $sort: { submitted_at: -1 } },
      {
        $group: {
          _id: "$target_ip",
          target_ip: { $first: "$target_ip" },
          dept_name: { $first: "$dept_name" },
          dept_code: { $first: "$dept_code" },
          hostname: { $first: "$hostname" }
        }
      },
      { $project: { _id: 0, target_ip: 1, dept_name: 1, dept_code: 1, hostname: 1 } },
      { $sort: { target_ip: 1 } }
    ]);

    return res.status(200).json({ success: true, data: ipList });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

router.get("/ip-list/:target_ip/logs", async (req, res) => {
  try {
    const query = applyDeptFilter(req, { target_ip: String(req.params.target_ip || "").trim() });
    const records = await IpInfo.find(query).sort({ submitted_at: -1 });

    if (!records.length) {
      return res.status(404).json({ error: "No records found for this IP address." });
    }

    return res.status(200).json({ success: true, data: records });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

router.get("/records/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: "Record not found." });
    }

    const query = applyDeptFilter(req, { _id: req.params.id });
    const record = await IpInfo.findOne(query);

    if (!record) {
      return res.status(404).json({ error: "Record not found." });
    }

    return res.status(200).json({ success: true, data: record });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

const downloadRecordFile = async (req, res, type) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: "Record not found." });
    }

    const query = applyDeptFilter(req, { _id: req.params.id });
    const record = await IpInfo.findOne(query);

    if (!record) {
      return res.status(404).json({ error: "Record not found." });
    }

    const directory = type === "pdf" ? PDF_DIR : JSON_DIR;
    const filename = type === "pdf" ? record.pdf_filename : record.json_filename;

    if (!filename) {
      return res.status(404).json({ error: "File not found." });
    }

    const filePath = path.resolve(directory, filename);
    const storageRoot = path.resolve(directory);

    if (!filePath.startsWith(storageRoot) || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found." });
    }

    return res.download(filePath, filename);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error." });
  }
};

router.get("/records/:id/pdf", (req, res) => downloadRecordFile(req, res, "pdf"));
router.get("/records/:id/json", (req, res) => downloadRecordFile(req, res, "json"));

export default router;
