import mongoose from "mongoose";

const RegisterDeviceSchema = new mongoose.Schema(
  {
    dsr_no: { type: String, required: false, trim: true },
    target_ip: { type: String, required: true, trim: true },
    device_type: { type: String, required: true, trim: true },
    // Legacy registration fields retained for the IP-service registration endpoint.
    name: { type: String, required: false, trim: true },
    phone: { type: String, required: false, trim: true },
    pf_no: { type: String, required: false, trim: true },
    dept_code: { type: String, required: false, trim: true },
    dept_name: { type: String, required: false, trim: true },
    designation: { type: String, required: false, trim: true },
    date_of_procurement: { type: String, required: false },
    serial_no: { type: String, required: false, unique: true, sparse: true, trim: true },
    description : { type: String, required: false, trim: true  },
    make : { type: String, required: false, trim: true  },
    quantity: { type: Number, required: false, default: 0 },
    // Preserve the misspelled historical field so older documents remain readable.
    quanity: { type: String, required: false, trim: true },
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
    assigned_date: { type: String, required: false, trim: true },
    // Hiring Device Related 
    is_hiring : { type : Number , require: false , default: 0},
    from_date : { type: String, required: false, trim: true },
    to_date : { type: String, required: false, trim: true },
    contract_no : { type: String, required: false, trim: true },
    sr_no : { type: String, required: false, trim: true }
  },
  {
    collection: "register_devices",
    timestamps: true
  }
);

export default mongoose.model("RegisterDevice", RegisterDeviceSchema);
