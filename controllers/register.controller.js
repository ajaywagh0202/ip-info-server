import fs from "fs/promises";
import IpInfo from "../models/IpInfo.js";

const requiredFields = ["name", "phone", "pf_no", "designation"];

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

const getDepartmentFields = (body) => {
  const department = getBodyText(body, "department");

  return {
    dept_code: getBodyText(body, "dept_code", department),
    dept_name: getBodyText(body, "dept_name", department)
  };
};

export const registerDevice = async (req, res) => {
  const pdfFile = getUploadedFile(req.files, "pdf_file");
  const jsonFile = getUploadedFile(req.files, "json_file");

  try {
    const departmentFields = getDepartmentFields(req.body);
    const missingFields = requiredFields.filter((field) => !String(req.body[field] || "").trim());

    if (!departmentFields.dept_code || !departmentFields.dept_name) {
      missingFields.push("department");
    }

    if (missingFields.length) {
      await removeUploadedFiles(pdfFile, jsonFile);
      return res.status(400).json({ error: `Missing required field(s): ${missingFields.join(", ")}.` });
    }

    if (!/^\d{10}$/.test(String(req.body.phone || "").trim())) {
      await removeUploadedFiles(pdfFile, jsonFile);
      return res.status(400).json({ error: "Phone number must be 10 digits." });
    }

    let parsedJson = null;

    if (jsonFile) {
      try {
        const jsonContents = await fs.readFile(jsonFile.path, "utf8");
        parsedJson = JSON.parse(jsonContents);
      } catch (error) {
        await removeUploadedFiles(pdfFile, jsonFile);
        return res.status(400).json({ error: "Uploaded JSON file is invalid." });
      }
    }

    const record = new IpInfo({
      name: getBodyText(req.body, "name"),
      phone: getBodyText(req.body, "phone"),
      pf_no: getBodyText(req.body, "pf_no"),
      dept_code: departmentFields.dept_code,
      dept_name: departmentFields.dept_name,
      designation: getBodyText(req.body, "designation"),
      target_ip: getFirstValueByKey(parsedJson, [
        "target_ip",
        "ip_address",
        "ipAddress",
        "IP_ADDRESS",
        "ip"
      ]) || getBodyText(req.body, "target_ip") || null,
      device_type: getBodyText(req.body, "device_type", "Unknown"),
      dsr_no: getBodyText(req.body, "dsr_no"),
      serial_no:
        req.body.Serial_no === undefined && req.body.serial_no === undefined
          ? undefined
          : String(req.body.Serial_no || req.body.serial_no).trim(),
      hostname: getFirstValueByKey(parsedJson, ["hostname", "host_name", "HostName", "HOSTNAME"]),
      os: getFirstValueByKey(parsedJson, ["os", "OS", "operating_system", "OperatingSystem"]),
      json_data: parsedJson,
      pdf_filename: pdfFile ? pdfFile.filename : null,
      json_filename: jsonFile ? jsonFile.filename : null
    });

    await record.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: "Device registered successfully."
    });
  } catch (error) {
    await removeUploadedFiles(pdfFile, jsonFile);
    return res.status(500).json({ error: "Internal server error." });
  }
};
