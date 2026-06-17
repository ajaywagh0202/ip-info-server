import "dotenv/config";

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const connectDB = require("./config/db");
const seedDefaultAdmin = require("./utils/seedAdmin");
const seedDepartments = require("./utils/seedDepartments");
const registerRoutes = require("./routes/register.routes");
const downloadRoutes = require("./routes/download.routes");
const adminAuthRoutes = require("./routes/adminAuth");
const adminProfileRoutes = require("./routes/adminProfile");
const adminUsersRoutes = require("./routes/adminUsers");
const adminRecordsRoutes = require("./routes/adminRecords");
const deviceDetailsRoutes = require("./routes/deviceDetails");
const ipReportRoutes = require("./routes/ipReport");
const dsrReportRoutes = require("./routes/dsrReport");
const seriesReportRoutes = require("./routes/seriesReport");
const departmentRoutes = require("./routes/departments");
const exportRoutes = require("./routes/export");
const analyticsRoutes = require("./routes/analytics");

const app = express();

const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

const isLocalDevOrigin = (origin) => {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch (error) {
    return false;
  }
};

const isPrivateNetworkDevOrigin = (origin) => {
  try {
    const { hostname, port } = new URL(origin);
    const isPrivateIp =
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);

    return isPrivateIp && ["3000", "5173"].includes(port);
  } catch (error) {
    return false;
  }
};

app.set("trust proxy", true);

const corsOptions = {
  origin: (origin, callback) => {
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      isLocalDevOrigin(origin) ||
      isPrivateNetworkDevOrigin(origin)
    ) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const ensureFolders = () => {
  fs.mkdirSync(path.join(__dirname, "SCRIPT_FILE"), { recursive: true });
  ensureUploadFolders();
};

app.get("/health", (req, res) => {
  res.json({ success: true, message: "Server is running" });
});

app.use("/api", registerRoutes);
app.use("/api", downloadRoutes);
app.use("/api", departmentRoutes);
app.use("/api/admin", adminAuthRoutes);
app.use("/api/admin/profile", adminProfileRoutes);
app.use("/api/admin", adminUsersRoutes);
app.use("/api/admin", deviceDetailsRoutes);
app.use("/api/admin", ipReportRoutes);
app.use("/api/admin", dsrReportRoutes);
app.use("/api/admin", seriesReportRoutes);
app.use("/api/admin", adminRecordsRoutes);
app.use("/api/admin", exportRoutes);
app.use("/api/admin", analyticsRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal server error"
  });
});

const startServer = async () => {
  ensureFolders();
  await connectDB();
  await seedDepartments();
  await seedDefaultAdmin();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
