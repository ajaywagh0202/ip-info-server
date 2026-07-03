import mongoose from "mongoose";

const RegisterUserSchema = new mongoose.Schema(
  {
    pf_no: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    designation: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    section_office: { type: String, required: true, trim: true },

    // Kept for compatibility with records created by the original registration flow.
    dept_code: { type: String, required: false, trim: true },
    dept_name: { type: String, required: false, trim: true },
    Section: { type: String, required: false, trim: true }
  },
  {
    collection: "register_users",
    timestamps: true
  }
);

export default mongoose.model("RegisterUser", RegisterUserSchema);
