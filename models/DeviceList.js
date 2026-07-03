import mongoose from "mongoose";

const DeviceListSchema = new mongoose.Schema(
  {
    device_name: { type: String, required: true, unique: true, trim: true },
    device_code: { type: String, required: true, trim: true },
    view: { type: Number, required: true, default: 0 },
  },
  {
    collection: "device_lists"
  }
);

export default mongoose.model("DeviceList", DeviceListSchema);
