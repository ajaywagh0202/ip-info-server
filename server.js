require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const connectDB = require("./config/db");
const seedDefaultAdmin = require("./utils/seedAdmin");
const registerRoutes = require("./routes/register.routes");
const downloadRoutes = require("./routes/download.routes");
const adminRoutes = require("./routes/admin.routes");

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

app.set("trust proxy", true);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || isLocalDevOrigin(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

const ensureFolders = () => {
  [
    path.join(__dirname, "SCRIPT_FILE"),
    path.join(__dirname, "IP_INFO_FILE"),
    path.join(__dirname, "IP_INFO_FILE", "JSON_FILE"),
    path.join(__dirname, "IP_INFO_FILE", "PDF_FILE")
  ].forEach((folder) => {
    fs.mkdirSync(folder, { recursive: true });
  });
};

app.get("/health", (req, res) => {
  res.json({ success: true, message: "Server is running" });
});

app.use("/api", registerRoutes);
app.use("/api", downloadRoutes);
app.use("/api/admin", adminRoutes);

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
  await seedDefaultAdmin();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
