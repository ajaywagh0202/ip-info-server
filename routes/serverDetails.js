import express from "express";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import RegisterDevice from "../models/RegisterDevice.js";
import IpInfo from "../models/IpInfo.js";
import { serverFieldNames, incidentEditableFields } from "../models/ServerDetails.js";
import { requireAdminAuth } from "../middleware/auth.middleware.js";
import { canAccessRegisterDevice } from "./deviceDetails.js";

const router = express.Router();
class InputError extends Error { constructor(message) { super(message); this.name = "InputError"; } }
const aliases = {
  ip_address_primary: "target_ip", location_site: "location", dsr_no: "dsr_no",
  purchase_order_no: "po_no", purchase_order_date: "po_date", purchase_date: "date_of_procurement",
  installation_date: "date_of_install", vendor_name: "make", serial_no: "serial_no", remarks: "remarks"
};
export const serverView = (device) => {
  const data = device.toObject ? device.toObject() : device;
  const result = { ...data.server_details, server_id: data._id };
  for (const [key, field] of Object.entries(aliases)) result[key] = data[field] ?? null;
  const purchased = new Date(data.date_of_procurement || data.po_date || NaN);
  result.age_years = Number.isNaN(purchased.getTime()) ? null : Math.max(0, Math.floor((Date.now() - purchased.getTime()) / (365.2425 * 86400000)));
  result.record_last_updated_on = data.updatedAt ?? null;
  result.record_last_updated_by = data.record_last_updated_by ?? null;
  result.breakdown = data.breakdown || { logs: [] };
  return result;
};

export function validateInput(body, allowed) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new InputError("Expected a JSON object.");
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) throw new InputError(`Field is not editable: ${key}`);
    const value = body[key];
    if (value !== null && typeof value === "object") throw new InputError(`Invalid value for ${key}`);
    if ((key.endsWith("_date") || key.endsWith("_datetime")) && value !== null &&
        (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value) || Number.isNaN(Date.parse(value)))) {
      throw new InputError(`Invalid date: ${key}`);
    }
    if ((key.endsWith("_date") || key.endsWith("_datetime")) && typeof value === "string") {
      const day = value.slice(0, 10);
      if (new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) throw new InputError(`Invalid calendar date: ${key}`);
    }
    if (["backup_enabled", "dr_replication", "power_supply_redundant"].includes(key) && value !== null && typeof value !== "boolean") throw new InputError(`${key} must be boolean or null.`);
    if ((key.endsWith("_count") || key.endsWith("_gb") || key === "availability_target") && value !== null && (typeof value !== "number" || !Number.isFinite(value))) throw new InputError(`${key} must be a number or null.`);
  }
}

router.use(requireAdminAuth);
router.use("/servers/:server_id", async (req, res, next) => {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.server_id)) return res.status(400).json({ error: "Invalid server_id." });
    const device = await RegisterDevice.findById(req.params.server_id);
    if (!device) return res.status(404).json({ error: "Server not found." });
    const scan = device.serial_no ? await IpInfo.findOne({ serial_no: device.serial_no }).sort({ submitted_at: -1 }).lean() : null;
    if (![0, 1].includes(Number(req.admin.user_type)) || !(await canAccessRegisterDevice(req, device, scan))) return res.status(403).json({ error: "Access denied for this department." });
    req.serverDevice = device;
    req.serverScan = scan;
    next();
  } catch (error) { next(error); }
});
router.get("/servers/:server_id", (req, res) => res.json({ success: true, data: serverView(req.serverDevice) }));
router.patch("/servers/:server_id", async (req, res, next) => {
  try {
    // Shared identity/IP fields retain their existing registration update flow.
    const editableAliases = Object.keys(aliases).filter(key => !["serial_no", "ip_address_primary", "dsr_no"].includes(key));
    validateInput(req.body, [...serverFieldNames, ...editableAliases]);
    if (!Object.keys(req.body).length) throw new InputError("No fields provided.");
    const device = req.serverDevice;
    if (!device.server_details) device.server_details = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (aliases[key]) device.set(aliases[key], value);
      else device.set(`server_details.${key}`, value);
    }
    device.record_last_updated_by = req.admin.id;
    await device.save();
    res.json({ success: true, data: serverView(device) });
  } catch (error) { next(error); }
});
// Explicit prefill never overwrites an admin value or infers ambiguous software.
router.post("/servers/:server_id/scan-prefill", async (req, res, next) => {
  try {
    const device = req.serverDevice;
    const scan = req.serverScan;
    if (!scan) return res.status(404).json({ error: "No scan found for this server." });
    const json = scan.json_data || {};
    const candidates = {
      hostname: scan.hostname || json.system_info?.hostname,
      os_name: json.system_info?.distro || scan.os || json.system_info?.os,
      os_version: json.system_info?.os_version,
      cpu_make_model: json.system_health?.cpu_model
    };
    const ram = /^([0-9]+(?:\.[0-9]+)?)\s*(GiB|GB)$/i.exec(String(json.system_health?.ram_total || ""));
    if (ram) candidates.ram_gb = Number((Number(ram[1]) * (ram[2].toLowerCase() === "gib" ? 1073741824 / 1e9 : 1)).toFixed(3));
    if (!device.server_details) device.server_details = {};
    const populated = [];
    for (const [key, value] of Object.entries(candidates)) {
      if (value !== undefined && value !== null && value !== "" && device.server_details[key] == null) {
        device.set(`server_details.${key}`, value);
        populated.push(key);
      }
    }
    if (populated.length) {
      device.record_last_updated_by = req.admin.id;
      await device.save();
    }
    res.json({ success: true, populated_fields: populated, scan_id: scan._id, data: serverView(device) });
  } catch (error) { next(error); }
});
router.get("/servers/:server_id/breakdown", (req, res) => res.json({ success: true, data: req.serverDevice.breakdown || { logs: [] } }));
router.post("/servers/:server_id/breakdown", async (req, res, next) => {
  try {
    validateInput(req.body, incidentEditableFields);
    const device = req.serverDevice;
    const now = new Date();
    device.breakdown.logs.push({ ...req.body, incident_id: `INC-${randomUUID()}`, server_id: device._id,
      server_tag_no: device.server_details?.server_tag_no ?? null,
      created_by: req.admin.id, updated_by: req.admin.id, created_at: now, updated_at: now });
    device.record_last_updated_by = req.admin.id;
    await device.save();
    res.status(201).json({ success: true, data: device.breakdown.logs.at(-1) });
  } catch (error) { next(error); }
});
router.patch("/servers/:server_id/breakdown/:incident_id", async (req, res, next) => {
  try {
    validateInput(req.body, incidentEditableFields);
    if (!Object.keys(req.body).length) throw new InputError("No fields provided.");
    const device = req.serverDevice;
    const incident = device.breakdown.logs.find(log => log.incident_id === req.params.incident_id);
    if (!incident) return res.status(404).json({ error: "Incident not found." });
    for (const [key, value] of Object.entries(req.body)) incident.set(key, value);
    incident.updated_by = req.admin.id;
    incident.updated_at = new Date();
    device.record_last_updated_by = req.admin.id;
    await device.save();
    res.json({ success: true, data: incident });
  } catch (error) { next(error); }
});
router.use((error, req, res, next) => {
  if (error.name === "VersionError") return res.status(409).json({ error: "Record changed. Reload and retry." });
  if (["InputError", "ValidationError", "CastError"].includes(error.name)) return res.status(400).json({ error: error.message });
  next(error);
});
export default router;
