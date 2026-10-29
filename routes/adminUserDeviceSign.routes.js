import express from "express";
import {
  createAssignment,
  getActiveAssignments,
  searchRegisterDevice,
  searchRegisterUser,
  updateAssignmentStatus
} from "../controllers/adminUserDeviceSign.controller.js";
import { requireAdminAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/user-device-sign/active", requireAdminAuth, getActiveAssignments);
router.post("/user-device-sign", requireAdminAuth, createAssignment);
router.patch("/user-device-sign/:id/status", requireAdminAuth, updateAssignmentStatus);

router.get("/register-users/search", requireAdminAuth, searchRegisterUser);
router.get("/register-devices/search", requireAdminAuth, searchRegisterDevice);

export default router;
