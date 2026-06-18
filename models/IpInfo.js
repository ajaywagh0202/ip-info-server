import mongoose from "mongoose";

const ipInfoSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    pf_no: { type: String, required: true, trim: true },
    dept_code: { type: String, required: true, trim: true },
    dept_name: { type: String, required: true, trim: true },
    designation: { type: String, required: true, trim: true },
    target_ip: { type: String, required: true, trim: true },
    device_type: { type: String, required: true, trim: true },
    date_of_procurement: { type: String, required: false },
    dsr_no: { type: String, required: false, trim: true },
    serial_no: { type: String, required: false, trim: true },
    description : { type: String, required: false, trim: true  },
    make : { type: String, required: false, trim: true  },
    quanity : { type: String, required: false, trim: true , dafault : 0  },
    po_no : { type: String, required: false, trim: true  },
    po_date : { type: String, required: false, trim: true  },
    value : { type: String, required: false, trim: true  },
    given_to : { type: String, required: false, trim: true  },
    location : { type: String, required: false, trim: true  },
    date_of_install : { type: String, required: false, trim: true  },
    remarks : { type: String, required: false, trim: true  },
    dsr_file : { type: String, required: false, trim: true  },
    ds_no : { type: String, required: false, trim: true  },
    date : { type: String, required: false, trim: true  },
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

export default mongoose.model("IpInfo", ipInfoSchema);
