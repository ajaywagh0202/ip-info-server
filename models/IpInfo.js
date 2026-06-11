const mongoose = require("mongoose");

const ipInfoSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    pf_no: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    designation: { type: String, required: true, trim: true },
    target_ip: { type: String, required: true, trim: true },
    hostname: { type: String, default: null, trim: true },
    os: { type: String, default: null, trim: true },
    json_data: { type: mongoose.Schema.Types.Mixed, default: null },
    pdf_filename: { type: String, default: null },
    json_filename: { type: String, default: null },
    submitted_at: { type: Date, default: Date.now }
  },
  {
    collection: "ip_records"
  }
);

module.exports = mongoose.model("IpInfo", ipInfoSchema);
