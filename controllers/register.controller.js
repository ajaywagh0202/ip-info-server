import fs from "fs/promises";
import IpInfo from "../models/IpInfo.js";
import RegisterDevice from "../models/RegisterDevice.js";

const REQUIRED_DEVICE_SCAN_FIELDS = ["dsr_no", "serial_no", "pf_no", "target_ip"];

const getUploadedFile = (files, fieldName) => {
  if (!files || !files[fieldName] || !files[fieldName][0]) {
    return null;
  }

  return files[fieldName][0];
};

const getFirstValueByKey = (value, keys) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(value, key) && value[key] != null) {
      return String(value[key]);
    }
  }

  for (const child of Object.values(value)) {
    const found = getFirstValueByKey(child, keys);
    if (found) {
      return found;
    }
  }

  return null;
};

const removeUploadedFiles = async (...files) => {
  await Promise.all(
    files
      .filter(Boolean)
      .map((file) => fs.unlink(file.path).catch(() => null))
  );
};

const getBodyText = (body, field, fallback = "") => String(body[field] || fallback).trim();

const getFirstTextValue = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return "";
};

const getDepartmentFields = (body) => {
  const department = getBodyText(body, "department");

  return {
    dept_code: getBodyText(body, "dept_code", department),
    dept_name: getBodyText(body, "dept_name", department)
  };
};

export const saveDeviceScan = async (req, res) => {
  const pdfFile = getUploadedFile(req.files, "pdf_file");
  const jsonFile = getUploadedFile(req.files, "json_file");

  try {
    const missingFields = REQUIRED_DEVICE_SCAN_FIELDS.filter(
      (field) => !String(req.body[field] || "").trim()
    );

    if (missingFields.length) {
      await removeUploadedFiles(pdfFile, jsonFile);
      return res.status(400).json({ error: `Missing required field(s): ${missingFields.join(", ")}.` });
    }

    if (!pdfFile || !jsonFile) {
      await removeUploadedFiles(pdfFile, jsonFile);
      return res.status(400).json({ error: "pdf_file and json_file are required." });
    }

    let parsedJson;

    try {
      const jsonContents = await fs.readFile(jsonFile.path, "utf8");
      parsedJson = JSON.parse(jsonContents);
    } catch (error) {
      await removeUploadedFiles(pdfFile, jsonFile);
      return res.status(400).json({ error: "Uploaded JSON file is invalid." });
    }

    const systemInfo = parsedJson?.system_info;
    const registrationFormData = parsedJson?.registration_form_data;
    const targetIp = getBodyText(req.body, "target_ip");
    const serialNo = getBodyText(req.body, "serial_no");
    const dsrNo = getBodyText(req.body, "dsr_no");
    const departmentFields = getDepartmentFields(req.body);

    const record = new IpInfo({
      dsr_no: dsrNo,
      target_ip: targetIp,
      pf_no: getBodyText(req.body, "pf_no"),
      serial_no: serialNo,
      name: getBodyText(req.body, "name") || undefined,
      phone: getBodyText(req.body, "phone") || undefined,
      dept_code: departmentFields.dept_code || undefined,
      dept_name: departmentFields.dept_name || undefined,
      designation: getBodyText(req.body, "designation") || undefined,
      device_type: getFirstTextValue(req.body.device_type, registrationFormData?.device_type) || undefined,
      hostname: getFirstTextValue(
        systemInfo?.hostname,
        getFirstValueByKey(parsedJson, ["hostname", "host_name", "HostName", "HOSTNAME"])
      ) || null,
      os: getFirstTextValue(
        systemInfo?.os,
        getFirstValueByKey(parsedJson, ["os", "OS", "operating_system", "OperatingSystem"])
      ) || null,
      json_data: parsedJson,
      pdf_filename: pdfFile ? pdfFile.filename : null,
      json_filename: jsonFile ? jsonFile.filename : null
    });

    await record.save();

    let registerDeviceUpdated = false;

    try {
      const updatedDevice = await RegisterDevice.findOneAndUpdate(
        { serial_no: serialNo },
        { $set: { target_ip: targetIp } },
        { new: true, runValidators: true, upsert: false }
      );
      registerDeviceUpdated = Boolean(updatedDevice);

      if (!updatedDevice) {
        console.warn(`[api/device-scan] No RegisterDevice found for serial_no: ${serialNo}`);
      }
    } catch (updateError) {
      // The scan has already been persisted. Do not delete its files or report a
      // false failure merely because the optional linked-device sync could not run.
      console.error(`[api/device-scan] Could not update RegisterDevice ${serialNo}`, updateError);
    }

    return res.status(201).json({
      success: true,
      message: "Device scan saved successfully.",
      data: record,
      register_device_updated: registerDeviceUpdated
    });
  } catch (error) {
    console.error("[api/device-scan]", error);
    await removeUploadedFiles(pdfFile, jsonFile);
    return res.status(500).json({ error: "Internal server error." });
  }
};

// Compatibility export for callers that used the former controller name.
export const registerDevice = saveDeviceScan;
