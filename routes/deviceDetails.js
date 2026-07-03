import express from "express";
import mongoose from "mongoose";
import IpInfo from "../models/IpInfo.js";
import RegisterDevice from "../models/RegisterDevice.js";
import { requireAdminAuth } from "../middleware/auth.middleware.js";
import { applyDepartmentScope } from "../utils/departmentScope.js";
import { includeRegistrationData } from "../utils/includeRegistrationData.js";
import "../utils/fieldLabels.js";
import UserDeviceSign from "../models/UserDeviceSign.js";

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

const REGISTER_DEVICE_EDITABLE_FIELDS = new Set(
  EDITABLE_FIELDS.filter((field) => !["name", "phone", "pf_no", "dept_code", "dept_name", "designation", "serial_no"].includes(field))
);
const USER_DEVICE_SIGN_SYNC_FIELDS = ["target_ip", "dsr_no"];

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

const getSerialNoParam = (value) =>
  String(value || "")
    .trim()
    // Supports the frontend's current `serial_no:<value>` URL while callers
    // migrate to the clean `/device-details/<serial_no>` path.
    .replace(/^serial_no\s*:/i, "")
    .trim();

const canAccessIpInfoRecord = async (req, record) => {
  if (Number(req.admin.user_type) !== 1) {
    return true;
  }

  const scopedQuery = await applyDepartmentScope(req, { _id: record._id });
  return Boolean(await IpInfo.exists(scopedQuery));
};

const canAccessRegisterDevice = async (req, device, ipInfoRecord) => {
  if (ipInfoRecord) {
    return canAccessIpInfoRecord(req, ipInfoRecord);
  }

  if (Number(req.admin.user_type) !== 1) {
    return true;
  }

  return (
    String(device?.dept_code || "").trim().toLowerCase() ===
    String(req.admin.dept_code || "").trim().toLowerCase()
  );
};

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

const buildDeviceDetailsQuery = async (req) => {
  const query = {};

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

  return applyDepartmentScope(req, query, {
    deptCode:
      Number(req.admin.user_type) === 0 && req.query.dept_code
        ? String(req.query.dept_code).trim()
        : ""
  });
};

router.use(requireAdminAuth);

router.get("/device-details", async (req, res) => {
  try {
    const query = await buildDeviceDetailsQuery(req);

    if (query.error) {
      return res.status(400).json({ error: query.error });
    }

    const records = await IpInfo.find(query).select(LIST_FIELDS).sort({ submitted_at: -1 }).lean();
    const enrichedRecords = await includeRegistrationData(records);
    const data = enrichedRecords.map(normalizeRecord);

    return res.status(200).json({
      success: true,
      total: data.length,
      data
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load device details." });
  }
});

router.get("/device-details/:serial_no", async (req, res) => {
  try {
    const serialNo = getSerialNoParam(req.params.serial_no);
    let record = serialNo
      ? await IpInfo.findOne({ serial_no: serialNo }).sort({ submitted_at: -1 }).lean()
      : null;

    // Existing screens used the IpInfo _id. Keep that lookup temporarily so
    // deployed frontend builds keep working while the API moves to serial_no.
    if (!record && mongoose.Types.ObjectId.isValid(req.params.serial_no)) {
      record = await IpInfo.findById(req.params.serial_no).lean();
    }

    if (!record) {
      return res.status(404).json({ error: "Record not found." });
    }

    if (!(await canAccessIpInfoRecord(req, record))) {
      return res.status(403).json({
        error: "Access denied. This record belongs to another department."
      });
    }

    const [enrichedRecord] = await includeRegistrationData([record]);

    return res.status(200).json({
      success: true,
      data: normalizeRecord(enrichedRecord)
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load device details." });
  }
});

router.put("/device-details/:serial_no", async (req, res) => {
  try {
    const serialNo = getSerialNoParam(req.params.serial_no);

    if (!serialNo) {
      return res.status(400).json({ error: "serial_no is required." });
    }

    const record = await RegisterDevice.findOne({ serial_no: serialNo }).lean();

    if (!record) {
      return res.status(404).json({ error: "Record not found." });
    }

    const ipInfoRecord = await IpInfo.findOne({ serial_no: serialNo })
      .sort({ submitted_at: -1 })
      .lean();
    if (!(await canAccessRegisterDevice(req, record, ipInfoRecord))) {
      return res.status(403).json({
        error: "Access denied. You can only edit records in your own department."
      });
    }

    const updateFields = {};

    Object.keys(req.body || {}).forEach((bodyField) => {
      const field = normalizeBodyFieldName(bodyField);

      if (REGISTER_DEVICE_EDITABLE_FIELDS.has(field) && req.body[bodyField] !== undefined) {
        updateFields[field] =
          req.body[bodyField] === null || req.body[bodyField] === undefined
            ? req.body[bodyField]
            : String(req.body[bodyField]).trim();
      }
    });

    if (Object.prototype.hasOwnProperty.call(updateFields, "phone") && !/^\d{10}$/.test(updateFields.phone)) {
      return res.status(400).json({ error: "Phone number must be 10 digits." });
    }

    if (!Object.keys(updateFields).length) {
      return res.status(400).json({ error: "No RegisterDevice fields provided." });
    }

    const changedFields = {};

    Object.keys(updateFields).forEach((field) => {
      const previousValue = record[field] === null || record[field] === undefined ? record[field] : String(record[field]);
      const nextValue = updateFields[field] === null || updateFields[field] === undefined ? updateFields[field] : String(updateFields[field]);

      if (previousValue !== nextValue) {
        changedFields[field] = updateFields[field];
      }
    });

    if (Object.prototype.hasOwnProperty.call(changedFields, "quanity")) {
      changedFields.quantity = changedFields.quanity;
    }

    const fieldsToSync = USER_DEVICE_SIGN_SYNC_FIELDS.filter((field) =>
      Object.prototype.hasOwnProperty.call(updateFields, field)
    );

    if (fieldsToSync.length) {
      const userDeviceSign = await UserDeviceSign.findOne({
        serial_no: serialNo
      }).lean();

      if (userDeviceSign) {
        const userDeviceSignUpdates = {};

        fieldsToSync.forEach((field) => {
          const previousValue =
            userDeviceSign[field] === null || userDeviceSign[field] === undefined
              ? userDeviceSign[field]
              : String(userDeviceSign[field]);
          const nextValue =
            updateFields[field] === null || updateFields[field] === undefined
              ? updateFields[field]
              : String(updateFields[field]);

          if (previousValue !== nextValue) {
            userDeviceSignUpdates[field] = updateFields[field];
          }
        });

        if (Object.keys(userDeviceSignUpdates).length) {
          await UserDeviceSign.findOneAndUpdate(
            { serial_no: serialNo },
            { $set: userDeviceSignUpdates },
            { new: true, runValidators: true }
          ).lean();
        }
      }
    }

    const updatedRecord = await RegisterDevice.findOneAndUpdate(
      { serial_no: serialNo },
      { $set: updateFields },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedRecord) {
      return res.status(404).json({ error: "Record not found." });
    }

    const responseSource = ipInfoRecord || {
      serial_no: updatedRecord.serial_no,
      dsr_no: updatedRecord.dsr_no,
      target_ip: updatedRecord.target_ip,
      pf_no: updatedRecord.pf_no,
      device_type: updatedRecord.device_type
    };
    const [enrichedRecord] = await includeRegistrationData([responseSource]);

    return res.status(200).json({
      success: true,
      message: "RegisterDevice record updated successfully.",
      changed_fields: changedFields,
      data: normalizeRecord(enrichedRecord)
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update record." });
  }
});

export default router;
