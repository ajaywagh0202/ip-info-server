import RegisterDevice from "../models/RegisterDevice.js";
import IpInfo from "../models/IpInfo.js";

const REQUIRED_DEVICE_FIELDS = [
  "name",
  "phone",
  "pf_no",
  "dept_code",
  "dept_name",
  "designation",
  "device_type",
  "target_ip"
];

const hasValue = (value) =>
  value !== undefined && value !== null && String(value).trim() !== "";

const getErrorMessage = (error) =>
  error instanceof Error ? error.message : String(error);

const getFirstForwardedIp = (value) => {
  const headerValue = Array.isArray(value) ? value[0] : value;

  return typeof headerValue === "string" ? headerValue.split(",")[0].trim() : "";
};

const getForwardedHeaderIp = (value) => {
  const headerValue = Array.isArray(value) ? value[0] : value;

  if (typeof headerValue !== "string") {
    return "";
  }

  const match = headerValue.match(/(?:^|[;,]\s*)for="?([^;,"]+)/i);

  if (!match) {
    return "";
  }

  const forwardedIp = match[1].trim();
  const bracketedIpv6 = forwardedIp.match(/^\[([^\]]+)\](?::\d+)?$/);

  return bracketedIpv6 ? bracketedIpv6[1] : forwardedIp;
};

const cleanIp = (ip) => String(ip || "").trim().replace(/^::ffff:/i, "");

export const getMyIp = async (req, res) => {
  try {
    const forwardedFor = getFirstForwardedIp(req.headers["x-forwarded-for"]);
    const realIp = getFirstForwardedIp(req.headers["x-real-ip"]);
    const standardForwardedIp = getForwardedHeaderIp(req.headers.forwarded);
    const rawIp =
      forwardedFor ||
      realIp ||
      standardForwardedIp ||
      req.ip ||
      req.socket.remoteAddress ||
      "";
    const ip = cleanIp(rawIp);

    return res.status(200).json({ ip });
  } catch (error) {
    console.error("[ip-service/my-ip]", error);
    return res.status(500).json({
      message: "Internal server error",
      error: getErrorMessage(error)
    });
  }
};

export const getRegisteredDevice = async (req, res) => {
  try {
    const dsr_no = typeof req.query.dsr_no === "string" ? req.query.dsr_no.trim() : "";

    if (!dsr_no) {
      return res.status(400).json({ message: "dsr_no is required" });
    }

    const record = await RegisterDevice.findOne({ dsr_no });

    if (!record) {
      return res.status(404).json({ message: "No device registered with this DSR number" });
    }

    return res.status(200).json({ data: record });
  } catch (error) {
    console.error("[ip-service/register:get]", error);
    return res.status(500).json({
      message: "Internal server error",
      error: getErrorMessage(error)
    });
  }
};

export const registerDevice = async (req, res) => {
  try {
    const { dsr_no, target_ip } = req.body;
    const missingFields = REQUIRED_DEVICE_FIELDS.filter((field) => !hasValue(req.body[field]));

    if (missingFields.length) {
      return res.status(400).json({
        message: `Missing required fields: ${missingFields.join(", ")}`
      });
    }

    const existingDevice = await RegisterDevice.findOne({ dsr_no });

    if (existingDevice) {
      return res.status(409).json({ message: "Device with this DSR number already exists" });
    }

    const record = new RegisterDevice({ ...req.body, dsr_no, target_ip });
    const savedRecord = await record.save();

    return res.status(201).json({
      message: "Device registered successfully",
      data: savedRecord
    });
  } catch (error) {
    console.error("[ip-service/register:post]", error);
    return res.status(500).json({
      message: "Internal server error",
      error: getErrorMessage(error)
    });
  }
};

export const scanDevice = async (req, res) => {
  try {
    const { dsr_no, target_ip, flag } = req.body;
    const normalizedFlag = typeof flag === "string" ? Number(flag) : flag;

    if (!hasValue(target_ip) || flag === undefined || flag === null) {
      return res.status(400).json({ message: "target_ip and flag are required" });
    }

    if (![0, 1].includes(normalizedFlag)) {
      return res.status(400).json({ message: "flag must be either 0 or 1" });
    }

    let scanResult;

    try {
      const agentHost = target_ip.includes(":") && !target_ip.startsWith("[")
        ? `[${target_ip}]`
        : target_ip;
      const agentResponse = await fetch(`http://${agentHost}:7979/scan`, {
        method: "POST",
        headers: {
          Authorization: "Bearer ITC2024CLIENT",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ dsr_no, target_ip }),
        signal: AbortSignal.timeout(60_000)
      });

      if (!agentResponse.ok) {
        throw new Error(`Agent returned HTTP ${agentResponse.status}`);
      }

      scanResult = await agentResponse.json();
    } catch (error) {
      console.error("[ip-service/scan] Agent request failed:", error);
      return res.status(502).json({
        message: "Agent unreachable or scan failed",
        error: getErrorMessage(error)
      });
    }

    const hostname = scanResult?.hostname ?? null;
    const os = scanResult?.os ?? null;
    const json_data = scanResult?.json_data ?? null;

    if (normalizedFlag === 0) {
      return res.status(200).json({
        message: "Scan complete (offline — data not saved)",
        saved: false,
        data: { hostname, os, json_data }
      });
    }

    const ipRecord = await new IpInfo({
      dsr_no,
      target_ip,
      hostname,
      os,
      json_data,
      is_active: true
    }).save();

    if (hasValue(dsr_no)) {
      await RegisterDevice.findOneAndUpdate(
        { dsr_no },
        { target_ip },
        { upsert: false }
      );
    }

    return res.status(200).json({
      message: "Scan complete — data saved",
      saved: true,
      data: {
        ip_record_id: ipRecord._id,
        hostname,
        os,
        json_data
      }
    });
  } catch (error) {
    console.error("[ip-service/scan]", error);
    return res.status(500).json({
      message: "Internal server error",
      error: getErrorMessage(error)
    });
  }
};
