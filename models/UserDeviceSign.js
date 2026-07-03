import mongoose from "mongoose";

const UserDeviceAsignSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RegisterUser",
      required: false,
      index: true
    },
    device_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RegisterDevice",
      required: false,
      index: true
    },
    pf_no: { type: String, required: true, trim: true },
    serial_no: { type: String, required: true, unique: true, trim: true },
    target_ip: { type: String, required: true, trim: true },
    dsr_no: { type: String, required: false, trim: true },
    assigned_date: { type: String, required: false, trim: true },
    status: { type: Number, enum: [0, 1], required: true, default: 1 },
    // Used only when MongoDB is running without transaction support.
    registration_lock: { type: String, required: false, default: null },
    registration_lock_expires_at: { type: Date, required: false, default: null }
  },
  {
    collection: "user_device_assigns",
    timestamps: true
  }
);

export default mongoose.model("UserDeviceAssign", UserDeviceAsignSchema);
