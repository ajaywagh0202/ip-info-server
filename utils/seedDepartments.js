import Department from "../models/Department.js";
import DeviceList from "../models/DeviceList.js";

const departments = [
  { deptname: "Account", dept_code: "ACCOUNT" },
  { deptname: "Operating", dept_code: "OPERATING" },
  { deptname: "Signal And Telecommunication", dept_code: "S_AND_T" },
  { deptname: "Mechanical", dept_code: "MECHANICAL" },
  { deptname: "Electrical", dept_code: "ELECTRICAL" },
  { deptname: "Commercial", dept_code: "COMMERCIAL" },
];

export const seedDepartments = async () => {
  const count = await Department.countDocuments();

  if (count > 0) {
    return;
  }

  await Department.insertMany(departments);
};

const devices = [
  { device_name: "Desktop", device_code: "DESKTOP", view: 1 },
  { device_name: "Laptop", device_code: "LAPTOP", view: 1 },
  { device_name: "All in One", device_code: "ALL_IN_ONE", view: 1 },
  { device_name: "Server", device_code: "SERVER", view: 1 },
  { device_name: "NAS Server", device_code: "NAS_SERVER", view: 1 },
  { device_name: "Printer", device_code: "PRINTER", view: 0 },
  { device_name: "Monitor", device_code: "MONITOR", view: 0 },
  { device_name: "Xerox Machine", device_code: "XEROX_MACHINE", view: 0 },
  { device_name: "Projector", device_code: "PROJECTOR", view: 0 },
  { device_name: "Router", device_code: "ROUTER", view: 0 },
];

export const seedDevices = async () => {
  const count = await DeviceList.countDocuments();

  if (count > 0) {
    return;
  }

  await DeviceList.insertMany(devices);
}