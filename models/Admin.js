const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    pf_no: { type: String, required: true, trim: true },
    dept_code: { type: String, required: true, trim: true },
    dept_name: { type: String, required: true, trim: true },
    designation: { type: String, required: true, trim: true },
    password: { type: String, required: true },
    user_type: { type: Number, required: true, trim: true ,default: 1},
  },
  {
    collection: "admins"
  }
);

module.exports = mongoose.model("Admin", adminSchema);
