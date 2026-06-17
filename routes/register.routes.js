import express from "express";
import { registerDevice } from "../controllers/register.controller.js";
import { registrationUpload } from "../middleware/upload.middleware.js";

const router = express.Router();

router.post("/register", registrationUpload, registerDevice);

export default router;
