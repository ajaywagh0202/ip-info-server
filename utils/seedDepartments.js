import Department from "../models/Department.js";

const departments = [
  { deptname: "Account", dept_code: "ACCOUNT" },
  { deptname: "Operating", dept_code: "OPERATING" },
  { deptname: "Signal And Telecommunication", dept_code: "S_AND_T" },
  { deptname: "Mechanical", dept_code: "MECHANICAL" },
  { deptname: "Electrical", dept_code: "ELECTRICAL" },
  { deptname: "Commercial", dept_code: "COMMERCIAL" },
];

const seedDepartments = async () => {
  const count = await Department.countDocuments();

  if (count > 0) {
    return;
  }

  await Department.insertMany(departments);
};

export default seedDepartments;
