import express from "express";
import { downloadScanner } from "../controllers/download.controller.js";

const router = express.Router();

router.get("/download/scanner", downloadScanner);

export default router;
