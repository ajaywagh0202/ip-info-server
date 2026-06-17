const mongoose = require("mongoose");

const DepartmentSchema = new mongoose.Schema(
  {
    deptname: { type: String, required: true, unique: true, trim: true },
    dept_code: { type: String, required: true, trim: true },
  },
  {
    collection: "departments"
  }
);

module.exports = mongoose.model("Department", DepartmentSchema);
