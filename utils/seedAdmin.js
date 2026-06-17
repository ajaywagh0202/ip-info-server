import bcrypt from "bcrypt";
import Admin from "../models/Admin.js";

const seedDefaultAdmin = async () => {
  const count = await Admin.countDocuments();

  if (count > 0) {
    return;
  }

  const password = await bcrypt.hash("123456", 10);

  await Admin.create({
    username: "admin",
    name: "System Administrator",
    pf_no: "ADMIN001",
    dept_code: "ACCOUNT",
    dept_name: "Account",
    designation: "IT Officer",
    user_type: 0,
    password
  });
};

export default seedDefaultAdmin;
