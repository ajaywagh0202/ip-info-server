const express = require("express");
const { registerDevice } = require("../controllers/register.controller");
const { registrationUpload } = require("../middleware/upload.middleware");

const router = express.Router();

router.post("/register", registrationUpload, registerDevice);

module.exports = router;
