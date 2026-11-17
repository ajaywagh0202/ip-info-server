import mongoose from "mongoose";

const text = () => ({ type: String, trim: true, default: null });
const number = () => ({ type: Number, min: 0, default: null });
const date = () => ({ type: Date, default: null });
const boolean = () => ({ type: Boolean, default: null });
const fields = {};
for (const key of `server_tag_no hostname fqdn ip_address_secondary subnet_vlan building_floor_room rack_no rack_u_position environment server_role hosting_type application_category application_name application_owner_dept model_name cpu_make_model storage_raid_level storage_type os_name os_version os_license_type database_software middleware_software other_software_details ilo_idrac_type management_ip management_url management_username_ref warranty_status amc_vendor backup_policy monitoring_tool patching_group criticality server_status`.split(" ")) fields[key] = text();
for (const key of `cpu_socket_count cpu_core_count cpu_thread_count ram_gb storage_os_gb storage_data_gb nic_count`.split(" ")) fields[key] = number();
for (const key of `warranty_end_date last_patch_date last_health_check_date`.split(" ")) fields[key] = date();
for (const key of `power_supply_redundant backup_enabled dr_replication`.split(" ")) fields[key] = boolean();
fields.availability_target = { type: Number, min: 0, max: 100, default: null };
for (const key of ["cpu_socket_count", "cpu_core_count", "cpu_thread_count", "nic_count"]) {
  fields[key].validate = { validator: value => value == null || Number.isInteger(value), message: "Count must be a whole number." };
}
export const serverFieldNames = Object.keys(fields);
export const serverDetailsSchema = new mongoose.Schema(fields, { _id: false });

export const incidentEditableFields = ["ticket_no", "breakdown_start_datetime", "restoration_datetime", "root_cause", "action_taken", "reported_by", "restored_by", "remarks"];
export const incidentSchema = new mongoose.Schema({
  incident_id: { type: String, required: true },
  server_id: { type: mongoose.Schema.Types.ObjectId, ref: "RegisterDevice", required: true },
  server_tag_no: text(),
  ticket_no: text(),
  breakdown_start_datetime: { type: Date, required: true },
  restoration_datetime: date(),
  downtime_hours: number(),
  root_cause: text(), action_taken: text(), reported_by: text(), restored_by: text(), remarks: text(),
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  created_at: { type: Date, required: true }, updated_at: { type: Date, required: true }
}, { _id: false });
incidentSchema.pre("validate", function () {
  if (this.restoration_datetime && this.breakdown_start_datetime) {
    if (this.restoration_datetime < this.breakdown_start_datetime) {
      this.invalidate("restoration_datetime", "Restoration cannot precede breakdown start.");
    } else {
      this.downtime_hours = (this.restoration_datetime - this.breakdown_start_datetime) / 3600000;
    }
  } else this.downtime_hours = null;
});
