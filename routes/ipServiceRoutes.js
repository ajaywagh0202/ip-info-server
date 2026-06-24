import express from "express";
import {
  getMyIp,
  getRegisteredDevice,
  registerDevice,
  scanDevice
} from "../controllers/ipServiceController.js";

const router = express.Router();

router.get("/my-ip", getMyIp);
router.get("/register", getRegisteredDevice);
router.post("/register", registerDevice);
router.post("/scan", scanDevice);

export default router;
