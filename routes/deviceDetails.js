const express = require("express");
const mongoose = require("mongoose");
const IpInfo = require("../models/IpInfo");
const { requireAdminAuth } = require("../middleware/auth.middleware");
const { applyDeptFilter } = require("../utils/applyDeptFilter");
require("../utils/fieldLabels");

const router = express.Router();

const LIST_FIELDS = "_id name phone pf_no dept_code dept_name designation device_type dsr_no serial_no Serial_no submitted_at";
const EDITABLE_FIELDS = [
  "name",
  "phone",
  "pf_no",
  "dept_code",
  "dept_name",
  "designation",
  "target_ip",
  "device_type",
  "date_of_procurement",
  "dsr_no",
  "serial_no",
  "description",
  "make",
  "quanity",
  "po_no",
  "po_date",
  "value",
  "given_to",
  "location",
  "date_of_install",
  "remarks",
  "dsr_file",
  "ds_no",
  "date"
];

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeBodyFieldName = (field) => {
  if (field === "Serial_no") {
    return "serial_no";
  }

  if (field === "quantity") {
    return "quanity";
  }

  return field;
};

const exactCaseInsensitiveRegex = (value) => new RegExp(`^${escapeRegex(String(value || "").trim())}$`, "i");

const normalizeRecord = (record) => ({
  ...record,
  description: record.description ?? null,
  make: record.make ?? null,
  quanity: record.quanity ?? null,
  po_no: record.po_no ?? null,
  po_date: record.po_date ?? null,
  value: record.value ?? null,
  given_to: record.given_to ?? null,
  location: record.location ?? null,
  date_of_install: record.date_of_install ?? null,
  remarks: record.remarks ?? null,
  dsr_file: record.dsr_file ?? null,
  ds_no: record.ds_no ?? null,
  date: record.date ?? null,
  Serial_no: record.serial_no ?? record.Serial_no ?? null,
  serial_no: record.serial_no ?? record.Serial_no ?? null,
  target_ip: record.target_ip ?? null,
  hostname: record.hostname ?? null,
  os: record.os ?? null,
  json_data: record.json_data ?? null,
  quantity: record.quanity ?? null
});

const addDateFilter = (query, fromDate, toDate) => {
  if (!fromDate && !toDate) {
    return null;
  }

  query.submitted_at = {};

  if (fromDate) {
    const parsedFrom = new Date(fromDate);

    if (Number.isNaN(parsedFrom.getTime())) {
      return "Invalid from_date.";
    }

    query.submitted_at.$gte = parsedFrom;
  }

  if (toDate) {
    const parsedTo = new Date(toDate);

    if (Number.isNaN(parsedTo.getTime())) {
      return "Invalid to_date.";
    }

    query.submitted_at.$lte = parsedTo;
  }

  return null;
};

const buildDeviceDetailsQuery = (req) => {
  const query = applyDeptFilter(req, {});

  if (Number(req.admin.user_type) === 1 && req.admin.dept_code) {
    query.dept_code = exactCaseInsensitiveRegex(req.admin.dept_code);
  }

  if (Number(req.admin.user_type) === 0 && req.query.dept_code) {
    query.dept_code = exactCaseInsensitiveRegex(req.query.dept_code);
  }

  if (req.query.dsr_no) {
    query.dsr_no = { $regex: escapeRegex(req.query.dsr_no), $options: "i" };
  }

  const serialNoFilter = req.query.Serial_no || req.query.serial_no;

  if (serialNoFilter) {
    query.serial_no = { $regex: escapeRegex(serialNoFilter), $options: "i" };
  }

  if (req.query.device_type) {
    query.device_type = String(req.query.device_type).trim();
  }

  const dateError = addDateFilter(query, req.query.from_date, req.query.to_date);

  if (dateError) {
    return { error: dateError };
  }

  return query;
};

router.use(requireAdminAuth);

router.get("/device-details", async (req, res) => {
  try {
    const query = buildDeviceDetailsQuery(req);

    if (query.error) {
      return res.status(400).json({ error: query.error });
    }

    const records = await IpInfo.find(query).select(LIST_FIELDS).sort({ submitted_at: -1 }).lean();
    const data = records.map(normalizeRecord);

    return res.status(200).json({
      success: true,
      total: data.length,
      data
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load device details." });
  }
});

router.get("/device-details/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: "Record not found." });
    }

    const { id } = req.params;
    const record = await IpInfo.findById(id).lean();

    if (!record) {
      return res.status(404).json({ error: "Record not found." });
    }

    const recordDeptCode = String(record.dept_code || "").trim().toLowerCase();
    const adminDeptCode = String(req.admin.dept_code || "").trim().toLowerCase();

    if (Number(req.admin.user_type) === 1 && recordDeptCode !== adminDeptCode) {
      return res.status(403).json({
        error: "Access denied. This record belongs to another department."
      });
    }

    return res.status(200).json({
      success: true,
      data: normalizeRecord(record)
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load device details." });
  }
});

router.put("/device-details/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: "Record not found." });
    }

    const { id } = req.params;
    const record = await IpInfo.findById(id).lean();

    if (!record) {
      return res.status(404).json({ error: "Record not found." });
    }

    const recordDeptCode = String(record.dept_code || "").trim().toLowerCase();
    const adminDeptCode = String(req.admin.dept_code || "").trim().toLowerCase();

    if (Number(req.admin.user_type) === 1 && recordDeptCode !== adminDeptCode) {
      return res.status(403).json({
        error: "Access denied. You can only edit records in your own department."
      });
    }

    const updateFields = {};

    Object.keys(req.body || {}).forEach((bodyField) => {
      const field = normalizeBodyFieldName(bodyField);

      if (EDITABLE_FIELDS.includes(field) && req.body[bodyField] !== undefined) {
        updateFields[field] =
          req.body[bodyField] === null || req.body[bodyField] === undefined
            ? req.body[bodyField]
            : String(req.body[bodyField]).trim();
      }
    });

    if (Object.prototype.hasOwnProperty.call(updateFields, "phone") && !/^\d{10}$/.test(updateFields.phone)) {
      return res.status(400).json({ error: "Phone number must be 10 digits." });
    }

    if (
      Number(req.admin.user_type) === 1 &&
      Object.prototype.hasOwnProperty.call(updateFields, "dept_code") &&
      updateFields.dept_code !== req.admin.dept_code
    ) {
      return res.status(403).json({
        error: "Access denied. You can only edit records in your own department."
      });
    }

    if (
      Number(req.admin.user_type) === 1 &&
      Object.prototype.hasOwnProperty.call(updateFields, "dept_name") &&
      updateFields.dept_name !== req.admin.dept_name
    ) {
      return res.status(403).json({
        error: "Access denied. You can only edit records in your own department."
      });
    }

    if (!Object.keys(updateFields).length) {
      return res.status(400).json({ error: "No editable fields provided." });
    }

    const changedFields = {};

    Object.keys(updateFields).forEach((field) => {
      const previousValue = record[field] === null || record[field] === undefined ? record[field] : String(record[field]);
      const nextValue = updateFields[field] === null || updateFields[field] === undefined ? updateFields[field] : String(updateFields[field]);

      if (previousValue !== nextValue) {
        changedFields[field] = updateFields[field];
      }
    });

    if (Object.prototype.hasOwnProperty.call(changedFields, "serial_no")) {
      changedFields.Serial_no = changedFields.serial_no;
    }

    if (Object.prototype.hasOwnProperty.call(changedFields, "quanity")) {
      changedFields.quantity = changedFields.quanity;
    }

    const updatedRecord = await IpInfo.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: false }
    ).lean();

    if (!updatedRecord) {
      return res.status(404).json({ error: "Record not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Device record updated successfully.",
      changed_fields: changedFields,
      data: normalizeRecord(updatedRecord)
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update record." });
  }
});

module.exports = router;
