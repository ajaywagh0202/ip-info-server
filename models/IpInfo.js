import mongoose from "mongoose";

const ipInfoSchema = new mongoose.Schema(
  {
    dsr_no: { type: String, required: false, trim: true },
    target_ip: { type: String, required: true, trim: true },
    name: { type: String, required: false, trim: true },
    phone: { type: String, required: false, trim: true },
    // These are not supplied by the agent scan endpoint, so they must remain optional.
    pf_no: { type: String, required: false, trim: true },
    serial_no: { type: String, required: false, trim: true },
    dept_code: { type: String, required: false, trim: true },
    dept_name: { type: String, required: false, trim: true },
    designation: { type: String, required: false, trim: true },
    device_type: { type: String, required: false, trim: true },
    hostname: { type: String, default: null, trim: true },
    os: { type: String, default: null, trim: true },
    json_data: { type: mongoose.Schema.Types.Mixed, default: null },
    pdf_filename: { type: String, default: null },
    json_filename: { type: String, default: null },
    submitted_at: { type: Date, default: Date.now },
    is_active: { type: Boolean, default: true },
  },
  {
    collection: "ip_records"
  }
);

export default mongoose.model("IpInfo", ipInfoSchema);
