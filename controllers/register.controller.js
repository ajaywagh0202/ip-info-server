const fs = require("fs/promises");
const IpInfo = require("../models/IpInfo");

const requiredFields = ["name", "phone", "pf_no", "department", "designation"];

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

const registerDevice = async (req, res) => {
  const pdfFile = getUploadedFile(req.files, "pdf_file");
  const jsonFile = getUploadedFile(req.files, "json_file");

  try {
    const missingFields = requiredFields.filter((field) => !String(req.body[field] || "").trim());

    if (missingFields.length) {
      await removeUploadedFiles(pdfFile, jsonFile);
      return res.status(400).json({ error: `Missing required field(s): ${missingFields.join(", ")}.` });
    }

    if (!pdfFile || !jsonFile) {
      await removeUploadedFiles(pdfFile, jsonFile);
      return res.status(400).json({ error: "Both pdf_file and json_file are required." });
    }

    let parsedJson;

    try {
      const jsonContents = await fs.readFile(jsonFile.path, "utf8");
      parsedJson = JSON.parse(jsonContents);
    } catch (error) {
      await removeUploadedFiles(pdfFile, jsonFile);
      return res.status(400).json({ error: "Uploaded JSON file is invalid." });
    }

    const targetIp = getFirstValueByKey(parsedJson, [
      "target_ip",
      "ip_address",
      "ipAddress",
      "IP_ADDRESS",
      "ip"
    ]);

    if (!targetIp) {
      await removeUploadedFiles(pdfFile, jsonFile);
      return res.status(400).json({ error: "target_ip not found in uploaded JSON file." });
    }

    await IpInfo.create({
      name: req.body.name.trim(),
      phone: req.body.phone.trim(),
      pf_no: req.body.pf_no.trim(),
      department: req.body.department.trim(),
      designation: req.body.designation.trim(),
      target_ip: targetIp,
      hostname: getFirstValueByKey(parsedJson, ["hostname", "host_name", "HostName", "HOSTNAME"]),
      os: getFirstValueByKey(parsedJson, ["os", "OS", "operating_system", "OperatingSystem"]),
      json_data: parsedJson,
      pdf_filename: pdfFile.filename,
      json_filename: jsonFile.filename
    });

    return res.status(200).json({
      success: true,
      message: "Device registered successfully."
    });
  } catch (error) {
    await removeUploadedFiles(pdfFile, jsonFile);
    return res.status(500).json({ error: "Internal server error." });
  }
};

module.exports = {
  registerDevice
};
