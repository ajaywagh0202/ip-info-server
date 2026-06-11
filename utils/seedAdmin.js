const bcrypt = require("bcrypt");
const Admin = require("../models/Admin");

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
    designation: "IT Officer",
    password
  });
};

module.exports = seedDefaultAdmin;
