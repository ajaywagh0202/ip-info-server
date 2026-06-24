import mongoose from "mongoose";
import { randomUUID } from "crypto";
import Department from "../models/Department.js";
import RegisterDevice from "../models/RegisterDevice.js";
import RegisterUser from "../models/RegisterUser.js";
import UserDeviceAssign from "../models/UserDeviceSign.js";

const REQUIRED_REGISTRATION_FIELDS = [
  "serial_no",
  "dsr_no",
  "device_type",
  "name",
  "pf_no",
  "phone",
  "designation",
  "department",
  "section_office",
  "target_ip",
  "assigned_date"
];

const STANDALONE_LOCK_DURATION_MS = 2 * 60 * 1000;
let transactionSupport;

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const hasValue = (value) =>
  value !== undefined && value !== null && String(value).trim() !== "";

const trimPayload = (body) =>
  Object.fromEntries(
    Object.entries(body || {}).map(([key, value]) => [
      key,
      typeof value === "string" ? value.trim() : value
    ])
  );

const toPlainObject = (document) => (document ? document.toObject() : null);

const buildUserUpdate = (payload) => ({
  name: payload.name,
  phone: payload.phone,
  designation: payload.designation,
  department: payload.department,
  section_office: payload.section_office,
  // Maintain the older field names for existing reporting queries.
  dept_name: payload.department,
  Section: payload.section_office
});

const buildDeviceUpdate = (payload) => ({
  dsr_no: payload.dsr_no,
  device_type: payload.device_type,
  target_ip: payload.target_ip,
  assigned_date: payload.assigned_date
});

const buildAssignmentData = (payload, user, device) => ({
  user_id: user._id,
  device_id: device._id,
  pf_no: user.pf_no,
  serial_no: device.serial_no,
  target_ip: payload.target_ip,
  dsr_no: payload.dsr_no,
  assigned_date: payload.assigned_date,
  status: 1
});

const getWriteOptions = (session) => ({
  new: true,
  upsert: true,
  runValidators: true,
  setDefaultsOnInsert: true,
  ...(session ? { session } : {})
});

const upsertUser = (payload, session) =>
  RegisterUser.findOneAndUpdate(
    { pf_no: payload.pf_no },
    { $set: buildUserUpdate(payload) },
    getWriteOptions(session)
  );

const upsertDevice = (payload, session) =>
  RegisterDevice.findOneAndUpdate(
    { serial_no: payload.serial_no },
    { $set: buildDeviceUpdate(payload) },
    getWriteOptions(session)
  );

const hasTransactionSupport = async () => {
  if (transactionSupport !== undefined) {
    return transactionSupport;
  }

  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  transactionSupport = Boolean(hello.setName || hello.msg === "isdbgrid");
  return transactionSupport;
};

const isTransactionUnavailableError = (error) =>
  error?.code === 20 ||
  error?.codeName === "IllegalOperation" ||
  /Transaction numbers are only allowed/i.test(error?.message || "");

const getAssignmentDevice = async (assignment) => {
  if (assignment.device_id && mongoose.isValidObjectId(assignment.device_id)) {
    const device = await RegisterDevice.findById(assignment.device_id);

    if (device) {
      return device;
    }
  }

  return RegisterDevice.findOne({ serial_no: assignment.serial_no });
};

const getAssignmentUser = async (assignment) => {
  if (assignment.user_id && mongoose.isValidObjectId(assignment.user_id)) {
    const user = await RegisterUser.findById(assignment.user_id);

    if (user) {
      return user;
    }
  }

  return RegisterUser.findOne({ pf_no: assignment.pf_no });
};

export const checkDeviceAssignment = async (req, res) => {
  try {
    const serial = typeof req.query.serial === "string" ? req.query.serial.trim() : "";

    if (!serial) {
      return res.status(400).json({ message: "serial is required" });
    }

    const assignment = await UserDeviceAssign.findOne({ serial_no: serial }).sort({
      status: -1,
      updatedAt: -1
    });

    if (assignment) {
      const device = await getAssignmentDevice(assignment);

      if (assignment.status === 1) {
        const user = await getAssignmentUser(assignment);

        if (!user || !device) {
          console.error("[device/check] Assignment has a broken reference", {
            assignmentId: assignment._id,
            serial
          });
          return res.status(500).json({ message: "Assigned device data is incomplete" });
        }

        return res.status(200).json({
          found: true,
          status: 1,
          user: toPlainObject(user),
          device: toPlainObject(device)
        });
      }

      return res.status(200).json({
        found: true,
        status: 0,
        user: null,
        device: toPlainObject(device)
      });
    }

    const device = await RegisterDevice.findOne({ serial_no: serial });

    if (device) {
      return res.status(200).json({
        found: true,
        status: 0,
        user: null,
        device: toPlainObject(device)
      });
    }

    return res.status(200).json({
      found: false,
      status: null,
      user: null,
      device: null
    });
  } catch (error) {
    console.error("[device/check]", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
};

export const listDepartments = async (req, res) => {
  try {
    const departments = await Department.find({}).sort({ deptname: 1 }).lean();

    return res.status(200).json(
      departments.map((department) => ({
        id: department._id,
        name: department.deptname,
        dept_code: department.dept_code,
      }))
    );
  } catch (error) {
    console.error("[departments]", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
};

const saveActiveAssignment = async (existingAssignment, payload, user, device, session) => {
  const assignmentData = buildAssignmentData(payload, user, device);

  if (existingAssignment) {
    Object.assign(existingAssignment, assignmentData);
    existingAssignment.registration_lock = undefined;
    existingAssignment.registration_lock_expires_at = undefined;
    return existingAssignment.save(session ? { session } : undefined);
  }

  const [assignment] = await UserDeviceAssign.create(
    [assignmentData],
    session ? { session } : undefined
  );
  return assignment;
};

const registerWithTransaction = async (payload) => {
  const session = await mongoose.startSession();

  try {
    let savedUser;
    let savedDevice;
    let savedAssignment;

    await session.withTransaction(async () => {
      const existingAssignment = await UserDeviceAssign.findOne({
        serial_no: payload.serial_no
      }).session(session);

      if (existingAssignment?.status === 1) {
        throw new HttpError(409, "This serial number is already assigned to an active user");
      }

      // Do not parallelize operations inside a Mongoose transaction.
      savedUser = await upsertUser(payload, session);
      savedDevice = await upsertDevice(payload, session);
      savedAssignment = await saveActiveAssignment(
        existingAssignment,
        payload,
        savedUser,
        savedDevice,
        session
      );
    });

    return { savedUser, savedDevice, savedAssignment };
  } finally {
    await session.endSession();
  }
};

const getStandaloneLock = async (payload) => {
  const existingAssignment = await UserDeviceAssign.findOne({
    serial_no: payload.serial_no
  }).lean();

  if (existingAssignment?.status === 1) {
    throw new HttpError(409, "This serial number is already assigned to an active user");
  }

  const lockToken = randomUUID();
  const now = new Date();
  const lockExpiresAt = new Date(now.getTime() + STANDALONE_LOCK_DURATION_MS);

  try {
    const lockedAssignment = await UserDeviceAssign.findOneAndUpdate(
      {
        serial_no: payload.serial_no,
        status: { $ne: 1 },
        $or: [
          { registration_lock: null },
          { registration_lock: { $exists: false } },
          { registration_lock_expires_at: { $lte: now } }
        ]
      },
      {
        $set: {
          pf_no: payload.pf_no,
          serial_no: payload.serial_no,
          target_ip: payload.target_ip,
          dsr_no: payload.dsr_no,
          assigned_date: payload.assigned_date,
          status: 0,
          registration_lock: lockToken,
          registration_lock_expires_at: lockExpiresAt
        }
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    return { existingAssignment, lockedAssignment, lockToken };
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }

    const currentAssignment = await UserDeviceAssign.findOne({
      serial_no: payload.serial_no
    }).lean();

    if (currentAssignment?.status === 1) {
      throw new HttpError(409, "This serial number is already assigned to an active user");
    }

    throw new HttpError(409, "Registration for this serial number is already in progress");
  }
};

const releaseStandaloneLock = async (lockedAssignment, existingAssignment, lockToken) => {
  const query = { _id: lockedAssignment._id, registration_lock: lockToken, status: 0 };

  if (!existingAssignment) {
    await UserDeviceAssign.deleteOne(query);
    return;
  }

  await UserDeviceAssign.updateOne(query, {
    $set: {
      user_id: existingAssignment.user_id,
      device_id: existingAssignment.device_id,
      pf_no: existingAssignment.pf_no,
      serial_no: existingAssignment.serial_no,
      target_ip: existingAssignment.target_ip,
      dsr_no: existingAssignment.dsr_no,
      assigned_date: existingAssignment.assigned_date,
      status: existingAssignment.status
    },
    $unset: {
      registration_lock: "",
      registration_lock_expires_at: ""
    }
  });
};

const registerWithoutTransaction = async (payload) => {
  const { existingAssignment, lockedAssignment, lockToken } = await getStandaloneLock(payload);

  try {
    const savedUser = await upsertUser(payload);
    const savedDevice = await upsertDevice(payload);
    const savedAssignment = await UserDeviceAssign.findOneAndUpdate(
      {
        _id: lockedAssignment._id,
        status: 0,
        registration_lock: lockToken
      },
      {
        $set: buildAssignmentData(payload, savedUser, savedDevice),
        $unset: {
          registration_lock: "",
          registration_lock_expires_at: ""
        }
      },
      { new: true, runValidators: true }
    );

    if (!savedAssignment) {
      throw new HttpError(409, "Registration lock expired; please try again");
    }

    return { savedUser, savedDevice, savedAssignment };
  } catch (error) {
    await releaseStandaloneLock(lockedAssignment, existingAssignment, lockToken).catch((releaseError) => {
      console.error("[device/register] Failed to release standalone lock", releaseError);
    });
    throw error;
  }
};

export const registerAndAssignDevice = async (req, res) => {
  try {
    const payload = trimPayload(req.body);
    const missingFields = REQUIRED_REGISTRATION_FIELDS.filter((field) => !hasValue(payload[field]));

    if (missingFields.length) {
      return res.status(400).json({
        message: `Missing required fields: ${missingFields.join(", ")}`
      });
    }

    let savedRecords;

    if (await hasTransactionSupport()) {
      try {
        savedRecords = await registerWithTransaction(payload);
      } catch (error) {
        if (!isTransactionUnavailableError(error)) {
          throw error;
        }

        transactionSupport = false;
        console.warn("[device/register] Transactions unavailable; using standalone lock mode");
      }
    }

    if (!savedRecords) {
      savedRecords = await registerWithoutTransaction(payload);
    }

    return res.status(201).json({
      user: toPlainObject(savedRecords.savedUser),
      device: toPlainObject(savedRecords.savedDevice),
      assignment: toPlainObject(savedRecords.savedAssignment)
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    if (error?.code === 11000) {
      if (error.keyPattern?.serial_no) {
        return res.status(409).json({
          message: "This serial number is already assigned to an active user"
        });
      }

      return res.status(409).json({
        message: "A user with this PF number or device serial number already exists"
      });
    }

    console.error("[device/register]", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
};
