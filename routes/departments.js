import express from "express";
import { listDepartments } from "../controllers/deviceRegistrationController.js";

const router = express.Router();

router.get("/departments", listDepartments);

export default router;
