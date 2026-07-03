import RegisterDevice from "../models/RegisterDevice.js";
import RegisterUser from "../models/RegisterUser.js";

const normalizedValue = (value) => String(value ?? "").trim();

const uniqueValues = (values) => [
  ...new Set(values.map(normalizedValue).filter(Boolean))
];

const mapBy = (records, field) => {
  const result = new Map();

  records.forEach((record) => {
    const key = normalizedValue(record[field]);

    // Queries are ordered newest first, so keep the most recent matching record.
    if (key && !result.has(key)) {
      result.set(key, record);
    }
  });

  return result;
};

// Do not allow a related document to replace the IpInfo record identity or its
// audit timestamps when flattening data for existing frontend grids.
const withoutDocumentMetadata = (record) => {
  if (!record) {
    return {};
  }

  const { _id, __v, createdAt, updatedAt, ...fields } = record;
  return fields;
};

/**
 * Adds registration data to IpInfo records without changing their existing
 * top-level fields. Device matching prefers serial number, then DSR number,
 * then target IP to keep older scan records useful as well.
 */
export const includeRegistrationData = async (ipInfoRecords) => {
  const records = (ipInfoRecords || []).map((record) =>
    typeof record?.toObject === "function" ? record.toObject() : record
  );

  if (!records.length) {
    return [];
  }

  const serialNumbers = uniqueValues(records.map((record) => record.serial_no));
  const dsrNumbers = uniqueValues(records.map((record) => record.dsr_no));
  const targetIps = uniqueValues(records.map((record) => record.target_ip));
  const deviceFilters = [];

  if (serialNumbers.length) {
    deviceFilters.push({ serial_no: { $in: serialNumbers } });
  }

  if (dsrNumbers.length) {
    deviceFilters.push({ dsr_no: { $in: dsrNumbers } });
  }

  if (targetIps.length) {
    deviceFilters.push({ target_ip: { $in: targetIps } });
  }

  const devices = deviceFilters.length
    ? await RegisterDevice.find({ $or: deviceFilters }).sort({ updatedAt: -1 }).lean()
    : [];
  const deviceBySerial = mapBy(devices, "serial_no");
  const deviceByDsr = mapBy(devices, "dsr_no");
  const deviceByTargetIp = mapBy(devices, "target_ip");

  const relatedDevices = records.map((record) => {
    const serialNo = normalizedValue(record.serial_no);
    const dsrNo = normalizedValue(record.dsr_no);
    const targetIp = normalizedValue(record.target_ip);

    return (
      (serialNo && deviceBySerial.get(serialNo)) ||
      (dsrNo && deviceByDsr.get(dsrNo)) ||
      (targetIp && deviceByTargetIp.get(targetIp)) ||
      null
    );
  });

  const pfNumbers = uniqueValues([
    ...records.map((record) => record.pf_no),
    ...relatedDevices.map((device) => device?.pf_no)
  ]);
  const users = pfNumbers.length
    ? await RegisterUser.find({ pf_no: { $in: pfNumbers } }).sort({ updatedAt: -1 }).lean()
    : [];
  const userByPfNumber = mapBy(users, "pf_no");

  return records.map((record, index) => {
    const relatedDevice = relatedDevices[index];
    const pfNo = normalizedValue(record.pf_no) || normalizedValue(relatedDevice?.pf_no);
    const relatedUser = (pfNo && userByPfNumber.get(pfNo)) || null;

    return {
      ...record,
      ...withoutDocumentMetadata(relatedDevice),
      ...withoutDocumentMetadata(relatedUser),
      register_device: relatedDevice,
      register_user: relatedUser,
      _id: record._id,
      submitted_at: record.submitted_at,
      hostname: record.hostname,
      os: record.os,
      json_data: record.json_data,
      pdf_filename: record.pdf_filename,
      json_filename: record.json_filename
    };
  });
};
