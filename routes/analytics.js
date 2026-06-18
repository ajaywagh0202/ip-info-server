import express from "express";
import IpInfo from "../models/IpInfo.js";
import { requireAdminAuth } from "../middleware/auth.middleware.js";
import { applyDeptFilter } from "../utils/applyDeptFilter.js";

const router = express.Router();

const ifNullChain = (fields, fallback) => fields.reduceRight(
  (current, field) => ({ $ifNull: [`$${field}`, current] }),
  fallback
);

const numericExpression = (fields) => ({
  $convert: {
    input: {
      $trim: {
        input: {
          $replaceAll: {
            input: { $toString: ifNullChain(fields, "") },
            find: "%",
            replacement: ""
          }
        }
      }
    },
    to: "double",
    onError: 0,
    onNull: 0
  }
});

const cpuModelExpression = () => ifNullChain([
  "json_data.system_health.cpu_model",
  "json_data.cpu_model",
  "json_data.CPU_Model",
  "json_data.cpuModel"
], "Unknown");

const osExpression = () => ifNullChain([
  "os",
  "json_data.system_info.os",
  "json_data.os",
  "json_data.OS"
], "Unknown");

const gradeExpression = () => ifNullChain([
  "json_data.cyber_security.grade",
  "json_data.grade",
  "json_data.Grade"
], "Unknown");

const ramTotalExpression = () => ifNullChain([
  "json_data.system_health.ram_total",
  "json_data.ram_total",
  "json_data.RAM_Total",
  "json_data.ramTotal"
], "");

const buildOtherBucket = (items, labelKey, limit = 10) => {
  if (items.length <= limit) {
    return items;
  }

  const visibleItems = items.slice(0, limit);
  const otherCount = items.slice(limit).reduce((total, item) => total + item.count, 0);
  return visibleItems.concat({ [labelKey]: "Other", count: otherCount });
};

const normalizeGradeDistribution = (items) => {
  const order = ["A", "B", "C", "D", "F", "Unknown"];
  return items.sort((left, right) => {
    const leftIndex = order.indexOf(left.grade);
    const rightIndex = order.indexOf(right.grade);
    const normalizedLeft = leftIndex === -1 ? order.length : leftIndex;
    const normalizedRight = rightIndex === -1 ? order.length : rightIndex;
    return normalizedLeft - normalizedRight;
  });
};

const normalizeRamDistribution = (items) => {
  const order = ["4 GB", "8 GB", "16 GB", "32 GB", "64 GB+", "Unknown"];
  const bySize = new Map(items.map((item) => [item.ram_size, item.count]));

  return order
    .filter((ramSize) => bySize.has(ramSize))
    .map((ramSize) => ({ ram_size: ramSize, count: bySize.get(ramSize) }));
};

router.get("/analytics/summary", requireAdminAuth, async (req, res) => {
  try {
    const match = applyDeptFilter(req, {});

    const [
      cpuDistribution,
      ramDistribution,
      osDistribution,
      securityGradeDistribution,
      findingsSummary,
      overviewStats
    ] = await Promise.all([
      IpInfo.aggregate([
        { $match: match },
        { $addFields: { cpu_model_value: cpuModelExpression() } },
        { $group: { _id: "$cpu_model_value", count: { $sum: 1 } } },
        { $project: { _id: 0, cpu_model: { $ifNull: ["$_id", "Unknown"] }, count: 1 } },
        { $sort: { count: -1, cpu_model: 1 } }
      ]),
      IpInfo.aggregate([
        { $match: match },
        {
          $addFields: {
            ram_total_text: { $toString: ramTotalExpression() }
          }
        },
        {
          $addFields: {
            ram_total_number: {
              $let: {
                vars: {
                  ramMatch: { $regexFind: { input: "$ram_total_text", regex: /[0-9]+(\.[0-9]+)?/ } }
                },
                in: {
                  $convert: {
                    input: "$$ramMatch.match",
                    to: "double",
                    onError: null,
                    onNull: null
                  }
                }
              }
            }
          }
        },
        {
          $addFields: {
            ram_size: {
              $switch: {
                branches: [
                  { case: { $eq: ["$ram_total_number", null] }, then: "Unknown" },
                  { case: { $lte: ["$ram_total_number", 4] }, then: "4 GB" },
                  { case: { $lte: ["$ram_total_number", 8] }, then: "8 GB" },
                  { case: { $lte: ["$ram_total_number", 16] }, then: "16 GB" },
                  { case: { $lte: ["$ram_total_number", 32] }, then: "32 GB" }
                ],
                default: "64 GB+"
              }
            }
          }
        },
        { $group: { _id: "$ram_size", count: { $sum: 1 } } },
        { $project: { _id: 0, ram_size: "$_id", count: 1 } }
      ]),
      IpInfo.aggregate([
        { $match: match },
        { $addFields: { os_value: osExpression() } },
        { $group: { _id: "$os_value", count: { $sum: 1 } } },
        { $project: { _id: 0, os: { $ifNull: ["$_id", "Unknown"] }, count: 1 } },
        { $sort: { count: -1, os: 1 } }
      ]),
      IpInfo.aggregate([
        { $match: match },
        { $addFields: { grade_value: gradeExpression() } },
        { $group: { _id: "$grade_value", count: { $sum: 1 } } },
        { $project: { _id: 0, grade: { $ifNull: ["$_id", "Unknown"] }, count: 1 } }
      ]),
      IpInfo.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            total_critical: { $sum: numericExpression(["json_data.cyber_security.summary.CRITICAL", "json_data.critical_findings", "json_data.CRITICAL_Findings", "json_data.criticalFindings"]) },
            total_high: { $sum: numericExpression(["json_data.cyber_security.summary.HIGH", "json_data.high_findings", "json_data.HIGH_Findings", "json_data.highFindings"]) },
            total_medium: { $sum: numericExpression(["json_data.cyber_security.summary.MEDIUM", "json_data.medium_findings", "json_data.MEDIUM_Findings", "json_data.mediumFindings"]) },
            total_low: { $sum: numericExpression(["json_data.cyber_security.summary.LOW", "json_data.low_findings", "json_data.LOW_Findings", "json_data.lowFindings"]) },
            total_info: { $sum: numericExpression(["json_data.cyber_security.summary.INFO", "json_data.info_findings", "json_data.INFO_Findings", "json_data.infoFindings"]) }
          }
        },
        { $project: { _id: 0, total_critical: 1, total_high: 1, total_medium: 1, total_low: 1, total_info: 1 } }
      ]),
      IpInfo.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            total_devices: { $sum: 1 },
            avg_score: { $avg: numericExpression(["json_data.cyber_security.score", "json_data.score", "json_data.Score"]) },
            avg_cpu_usage: { $avg: numericExpression(["json_data.system_health.cpu_usage_pct", "json_data.system_health.cpu_usage_percent", "json_data.cpu_usage_pct", "json_data.cpu_usage_percent", "json_data.CPU_Usage_Percent", "json_data.cpuUsagePercent"]) },
            avg_ram_usage: { $avg: numericExpression(["json_data.system_health.ram_pct", "json_data.system_health.ram_percent", "json_data.ram_pct", "json_data.ram_percent", "json_data.RAM_Percent", "json_data.ramPercent"]) }
          }
        },
        { $project: { _id: 0, total_devices: 1, avg_score: 1, avg_cpu_usage: 1, avg_ram_usage: 1 } }
      ])
    ]);

    return res.status(200).json({
      success: true,
      data: {
        overview_stats: overviewStats[0] || {
          total_devices: 0,
          avg_score: 0,
          avg_cpu_usage: 0,
          avg_ram_usage: 0
        },
        cpu_distribution: buildOtherBucket(cpuDistribution, "cpu_model"),
        ram_distribution: normalizeRamDistribution(ramDistribution),
        os_distribution: osDistribution,
        security_grade_distribution: normalizeGradeDistribution(securityGradeDistribution),
        findings_summary: findingsSummary[0] || {
          total_critical: 0,
          total_high: 0,
          total_medium: 0,
          total_low: 0,
          total_info: 0
        }
      }
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load analytics data." });
  }
});

export default router;
