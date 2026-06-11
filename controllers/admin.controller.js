const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Admin = require("../models/Admin");
const IpInfo = require("../models/IpInfo");

const PDF_DIR = path.join(__dirname, "..", "IP_INFO_FILE", "PDF_FILE");
const JSON_DIR = path.join(__dirname, "..", "IP_INFO_FILE", "JSON_FILE");

const login = async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const admin = await Admin.findOne({ username });

    if (!admin) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const passwordMatches = await bcrypt.compare(password, admin.password);

    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const token = jwt.sign(
      {
        id: admin._id.toString(),
        username: admin.username
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.status(200).json({ token });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error." });
  }
};

const getRecords = async (req, res) => {
  try {
    const filter = {};

    if (req.query.department) {
      filter.department = String(req.query.department).trim();
    }

    const records = await IpInfo.find(filter).sort({ submitted_at: -1 });
    return res.status(200).json(records);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error." });
  }
};

const getRecord = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: "Record not found." });
    }

    const record = await IpInfo.findById(req.params.id);

    if (!record) {
      return res.status(404).json({ error: "Record not found." });
    }

    return res.status(200).json(record);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error." });
  }
};

const downloadRecordFile = async (req, res, type) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: "Record not found." });
    }

    const record = await IpInfo.findById(req.params.id);

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

const downloadRecordPdf = (req, res) => downloadRecordFile(req, res, "pdf");

const downloadRecordJson = (req, res) => downloadRecordFile(req, res, "json");

module.exports = {
  login,
  getRecords,
  getRecord,
  downloadRecordPdf,
  downloadRecordJson
};
