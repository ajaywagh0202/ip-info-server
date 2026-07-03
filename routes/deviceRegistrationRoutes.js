import express from "express";
import {
  checkDeviceAssignment,
  registerAndAssignDevice
} from "../controllers/deviceRegistrationController.js";

const router = express.Router();

// Official register-and-assign endpoint.
router.post("/register-device", registerAndAssignDevice);

// Existing frontend routes kept as backward-compatible aliases.
router.get("/device/check", checkDeviceAssignment);
router.post("/device/register", registerAndAssignDevice);

export default router;
