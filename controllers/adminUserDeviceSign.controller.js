import mongoose from "mongoose";
import RegisterDevice from "../models/RegisterDevice.js";
import RegisterUser from "../models/RegisterUser.js";
import UserDeviceAssign from "../models/UserDeviceSign.js";

const ACTIVE_STATUS = 1;
const REMOVED_STATUS = 0;
const REQUIRED_ASSIGNMENT_FIELDS = ["pf_no", "serial_number", "dsr_no", "target_ip"];

const trimValue = (value) => (typeof value === "string" ? value.trim() : "");

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const exactRegex = (value) => new RegExp(`^${escapeRegex(value)}$`, "i");

const partialRegexQuery = (field, value) => ({
  [field]: { $regex: escapeRegex(value), $options: "i" }
});

const getSerialNumber = (record) => record?.serial_number || record?.serial_no || "";

const sendJson = (res, statusCode, payload) =>
  res.status(statusCode).json({
    success: payload.success,
    message: payload.message,
    data: payload.data ?? null,
    ...(payload.found !== undefined ? { found: payload.found } : {}),
    ...(payload.conflict !== undefined ? { conflict: payload.conflict } : {})
  });

const logAssignmentRequest = ({ action, pf_no, serial_number, admin }) => {
  console.info(
    "[admin/user-device-sign]",
    JSON.stringify({
      action,
      admin: admin?.username || null,
      pf_no: pf_no || null,
      serial_number: serial_number || null,
      timestamp: new Date().toISOString()
    })
  );
};

const buildActiveAssignmentMatch = (query) => {
  const conditions = [{ status: ACTIVE_STATUS }];
  const pfNo = trimValue(query.pf_no);
  const serialNumber = trimValue(query.serial_number || query.serial_no);
  const dsrNo = trimValue(query.dsr_no);
  const targetIp = trimValue(query.target_ip);

  if (pfNo) {
    conditions.push(partialRegexQuery("pf_no", pfNo));
  }

  if (serialNumber) {
    conditions.push({
      $or: [
        partialRegexQuery("serial_no", serialNumber),
        partialRegexQuery("serial_number", serialNumber)
      ]
    });
  }

  if (dsrNo) {
    conditions.push(partialRegexQuery("dsr_no", dsrNo));
  }

  if (targetIp) {
    conditions.push(partialRegexQuery("target_ip", targetIp));
  }

  return conditions.length === 1 ? conditions[0] : { $and: conditions };
};

const serializeAssignment = (assignment) => {
  const value = assignment?.toObject ? assignment.toObject() : assignment;

  if (!value) {
    return null;
  }

  return {
    _id: value._id,
    pf_no: value.pf_no,
    serial_number: getSerialNumber(value),
    dsr_no: value.dsr_no,
    target_ip: value.target_ip,
    status: value.status,
    created_at: value.created_at || value.createdAt || null,
    updated_at: value.updated_at || value.updatedAt || null
  };
};

const serializeUser = (user) =>
  user
    ? {
        pf_no: user.pf_no,
        name: user.name,
        designation: user.designation,
        department: user.department
      }
    : null;

const serializeDevice = (device) =>
  device
    ? {
        serial_number: getSerialNumber(device),
        device_type: device.device_type,
        dsr_no: device.dsr_no,
        make: device.make,
        model: device.model
      }
    : null;

const findUserByPfNo = (pfNo) =>
  RegisterUser.findOne({ pf_no: exactRegex(pfNo) })
    .select("pf_no name designation department")
    .lean();

const findDeviceBySerialNumber = (serialNumber) =>
  RegisterDevice.findOne({
    $or: [{ serial_no: exactRegex(serialNumber) }, { serial_number: exactRegex(serialNumber) }]
  }).lean();

const findActiveByTargetIp = (targetIp) =>
  UserDeviceAssign.findOne({
    status: ACTIVE_STATUS,
    target_ip: exactRegex(targetIp)
  }).lean();

const findActiveBySerialNumber = (serialNumber) =>
  UserDeviceAssign.findOne({
    status: ACTIVE_STATUS,
    $or: [{ serial_no: exactRegex(serialNumber) }, { serial_number: exactRegex(serialNumber) }]
  }).lean();

const findActiveByPfNo = (pfNo) =>
  UserDeviceAssign.findOne({
    status: ACTIVE_STATUS,
    pf_no: exactRegex(pfNo)
  }).lean();

export const getActiveAssignments = async (req, res, next) => {
  try {
    const assignments = await UserDeviceAssign.aggregate([
      { $match: buildActiveAssignmentMatch(req.query) },
      {
        $lookup: {
          from: "register_users",
          localField: "pf_no",
          foreignField: "pf_no",
          as: "user"
        }
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          assignment_serial_number: { $ifNull: ["$serial_number", "$serial_no"] },
          assignment_created_at: { $ifNull: ["$created_at", "$createdAt"] }
        }
      },
      {
        $lookup: {
          from: "register_devices",
          let: { serialNumber: "$assignment_serial_number" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$serial_number", "$$serialNumber"] },
                    { $eq: ["$serial_no", "$$serialNumber"] }
                  ]
                }
              }
            },
            {
              $project: {
                serial_number: { $ifNull: ["$serial_number", "$serial_no"] },
                device_type: 1,
                make: 1,
                model: 1
              }
            }
          ],
          as: "device"
        }
      },
      { $unwind: { path: "$device", preserveNullAndEmptyArrays: true } },
      { $sort: { assignment_created_at: -1, _id: -1 } },
      {
        $project: {
          _id: 1,
          pf_no: 1,
          user_name: "$user.name",
          department: "$user.department",
          serial_number: "$assignment_serial_number",
          device_type: "$device.device_type",
          make: "$device.make",
          model: "$device.model",
          dsr_no: 1,
          target_ip: 1,
          status: 1,
          created_at: "$assignment_created_at"
        }
      }
    ]);

    return sendJson(res, 200, {
      success: true,
      message: "Active assignments retrieved",
      data: assignments
    });
  } catch (error) {
    return next(error);
  }
};

export const updateAssignmentStatus = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return sendJson(res, 404, {
        success: false,
        message: "Assignment not found",
        data: null
      });
    }

    if (Number(req.body?.status) !== REMOVED_STATUS) {
      return sendJson(res, 400, {
        success: false,
        message: "Only status 0 is allowed for removal",
        data: null
      });
    }

    const now = new Date();
    const updatedRecord = await UserDeviceAssign.findByIdAndUpdate(
      req.params.id,
      { $set: { status: REMOVED_STATUS, updated_at: now } },
      { new: true, runValidators: true, strict: false, lean: true }
    );

    if (!updatedRecord) {
      return sendJson(res, 404, {
        success: false,
        message: "Assignment not found",
        data: null
      });
    }

    logAssignmentRequest({
      action: "remove_assignment",
      pf_no: updatedRecord.pf_no,
      serial_number: getSerialNumber(updatedRecord),
      admin: req.admin
    });

    return sendJson(res, 200, {
      success: true,
      message: "Assignment removed",
      data: serializeAssignment(updatedRecord)
    });
  } catch (error) {
    return next(error);
  }
};

export const searchRegisterUser = async (req, res, next) => {
  try {
    const pfNo = trimValue(req.query.pf_no);

    if (!pfNo) {
      return sendJson(res, 400, {
        success: false,
        found: false,
        message: "pf_no is required",
        data: null
      });
    }

    let user = await findUserByPfNo(pfNo);

    if (!user) {
      user = await RegisterUser.findOne(partialRegexQuery("pf_no", pfNo))
        .select("pf_no name designation department")
        .sort({ pf_no: 1 })
        .lean();
    }

    return sendJson(res, 200, {
      success: true,
      found: Boolean(user),
      message: user ? "User found" : "User not found",
      data: serializeUser(user)
    });
  } catch (error) {
    return next(error);
  }
};

export const searchRegisterDevice = async (req, res, next) => {
  try {
    const serialNumber = trimValue(req.query.serial_number || req.query.serial_no);

    if (!serialNumber) {
      return sendJson(res, 400, {
        success: false,
        found: false,
        message: "serial_number is required",
        data: null
      });
    }

    let device = await findDeviceBySerialNumber(serialNumber);

    if (!device) {
      device = await RegisterDevice.findOne({
        $or: [
          partialRegexQuery("serial_no", serialNumber),
          partialRegexQuery("serial_number", serialNumber)
        ]
      })
        .sort({ serial_no: 1 })
        .lean();
    }

    return sendJson(res, 200, {
      success: true,
      found: Boolean(device),
      message: device ? "Device found" : "Device not found",
      data: serializeDevice(device)
    });
  } catch (error) {
    return next(error);
  }
};

export const createAssignment = async (req, res, next) => {
  try {
    const payload = {
      pf_no: trimValue(req.body?.pf_no),
      serial_number: trimValue(req.body?.serial_number || req.body?.serial_no),
      dsr_no: trimValue(req.body?.dsr_no),
      target_ip: trimValue(req.body?.target_ip)
    };

    logAssignmentRequest({
      action: "create_assignment",
      pf_no: payload.pf_no,
      serial_number: payload.serial_number,
      admin: req.admin
    });

    const missingFields = REQUIRED_ASSIGNMENT_FIELDS.filter((field) => !payload[field]);

    if (missingFields.length) {
      return sendJson(res, 400, {
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
        data: null
      });
    }

    const ipConflict = await findActiveByTargetIp(payload.target_ip);

    if (ipConflict) {
      return sendJson(res, 409, {
        success: false,
        conflict: true,
        message: `Target IP ${payload.target_ip} is already assigned to PF No ${ipConflict.pf_no}`,
        data: null
      });
    }

    const deviceConflict = await findActiveBySerialNumber(payload.serial_number);

    if (deviceConflict) {
      return sendJson(res, 409, {
        success: false,
        conflict: true,
        message: `Device ${payload.serial_number} is already assigned to PF No ${deviceConflict.pf_no}`,
        data: null
      });
    }

    const userConflict = await findActiveByPfNo(payload.pf_no);

    if (userConflict) {
      return sendJson(res, 409, {
        success: false,
        conflict: true,
        message: `PF No ${payload.pf_no} already has an active device assignment (Serial No ${getSerialNumber(userConflict)})`,
        data: null
      });
    }

    const user = await findUserByPfNo(payload.pf_no);

    if (!user) {
      return sendJson(res, 400, {
        success: false,
        message: `PF No ${payload.pf_no} was not found`,
        data: null
      });
    }

    const device = await findDeviceBySerialNumber(payload.serial_number);

    if (!device) {
      return sendJson(res, 400, {
        success: false,
        message: `Device ${payload.serial_number} was not found`,
        data: null
      });
    }

    const assignment = new UserDeviceAssign({
      user_id: user._id,
      device_id: device._id,
      pf_no: user.pf_no,
      serial_no: getSerialNumber(device) || payload.serial_number,
      dsr_no: payload.dsr_no,
      target_ip: payload.target_ip,
      status: ACTIVE_STATUS
    });

    const newRecord = await assignment.save();

    return sendJson(res, 201, {
      success: true,
      message: "Device assigned successfully",
      data: serializeAssignment(newRecord)
    });
  } catch (error) {
    if (error?.code === 11000) {
      return sendJson(res, 409, {
        success: false,
        conflict: true,
        message: "An active assignment conflict was detected; please refresh and try again",
        data: null
      });
    }

    return next(error);
  }
};
