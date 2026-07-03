import express from "express";
import IpInfo from "../models/IpInfo.js";
import { requireAdminAuth } from "../middleware/auth.middleware.js";
import { applyDepartmentScope } from "../utils/departmentScope.js";
import { includeRegistrationData } from "../utils/includeRegistrationData.js";

const router = express.Router();

router.use(requireAdminAuth);

router.get("/ip-report/list", async (req, res) => {
  try {
    const match = await applyDepartmentScope(req, {});
    const data = await IpInfo.aggregate([
      { $match: match },
      { $sort: { submitted_at: -1 } },
      {
        $group: {
          _id: "$target_ip",
          target_ip: { $first: "$target_ip" },
          hostname: { $first: "$hostname" },
          dept_name: { $first: "$dept_name" },
          dept_code: { $first: "$dept_code" },
          os: { $first: "$os" },
          device_type: { $first: "$device_type" },
          dsr_no: { $first: "$dsr_no" },
          serial_no: { $first: "$serial_no" },
          pf_no: { $first: "$pf_no" },
          submitted_at: { $first: "$submitted_at" }
        }
      },
      {
        $project: {
          _id: 0,
          target_ip: 1,
          hostname: 1,
          dept_name: 1,
          dept_code: 1,
          os: 1,
          device_type: 1,
          dsr_no: 1,
          serial_no: 1,
          pf_no: 1,
          submitted_at: 1
        }
      },
      { $sort: { target_ip: 1 } }
    ]);

    const enrichedData = await includeRegistrationData(data);

    return res.status(200).json({ success: true, data: enrichedData });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

router.get("/ip-report/:target_ip/records", async (req, res) => {
  try {
    const targetIp = String(req.params.target_ip || "").trim();

    if (!targetIp) {
      return res.status(400).json({ error: "IP address is required." });
    }

    const query = await applyDepartmentScope(req, { target_ip: targetIp });
    const records = await IpInfo.find(query).sort({ submitted_at: -1 }).lean();

    if (!records.length) {
      return res.status(404).json({ error: "No records found for this IP address." });
    }

    const enrichedRecords = await includeRegistrationData(records);

    return res.status(200).json({ success: true, data: enrichedRecords });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
