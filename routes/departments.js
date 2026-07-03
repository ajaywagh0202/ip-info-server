import express from "express";
import { listDepartments, addDevice, getDevices, createDepartment } from "../controllers/deviceRegistrationController.js";

const router = express.Router();

router.get("/departments", listDepartments);
router.get("/devices", getDevices);

router.post("/add-device", addDevice);
router.post("/departments", createDepartment)

export default router;
