import express from "express";
import IpInfo from "../models/IpInfo.js";
import { requireAdminAuth } from "../middleware/auth.middleware.js";
import { applyDeptFilter } from "../utils/applyDeptFilter.js";

const router = express.Router();

router.use(requireAdminAuth);

router.get("/ip-report/list", async (req, res) => {
  try {
    const match = applyDeptFilter(req, {});
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
          submitted_at: 1
        }
      },
      { $sort: { target_ip: 1 } }
    ]);

    return res.status(200).json({ success: true, data });
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

    const query = applyDeptFilter(req, { target_ip: targetIp });
    const records = await IpInfo.find(query).sort({ submitted_at: -1 });

    if (!records.length) {
      return res.status(404).json({ error: "No records found for this IP address." });
    }

    return res.status(200).json({ success: true, data: records });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
