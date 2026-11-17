import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import RegisterDevice from "../models/RegisterDevice.js";
import Admin from "../models/Admin.js";
import IpInfo from "../models/IpInfo.js";
import router, { validateInput, serverView } from "../routes/serverDetails.js";

const adminId = new mongoose.Types.ObjectId();
const incident = () => ({ incident_id: "INC-test", server_id: new mongoose.Types.ObjectId(),
  created_by: adminId, updated_by: adminId, created_at: new Date(), updated_at: new Date(),
  breakdown_start_datetime: "2026-11-17T10:00:00Z" });
const device = () => new RegisterDevice({ target_ip: "10.0.0.1", device_type: "Server" });

test("unknown operational values and empty history default correctly", async () => {
  const d = device();
  await d.validate();
  assert.equal(d.server_details.backup_enabled, null);
  assert.deepEqual(d.breakdown.logs.toObject(), []);
  assert.equal(serverView(d).server_id.toString(), d.id);
});
test("restoration calculates downtime and rejects reversed dates", async () => {
  const d = device();
  d.breakdown.logs.push(incident());
  await d.validate();
  const log = d.breakdown.logs[0];
  assert.equal(log.downtime_hours, null);
  log.restoration_datetime = "2026-11-17T12:30:00Z";
  await d.validate();
  assert.equal(log.downtime_hours, 2.5);
  log.restoration_datetime = "2026-11-17T09:00:00Z";
  await assert.rejects(d.validate(), /Restoration cannot precede/);
});
test("required incident date and numeric limits are validated", async () => {
  const d = device();
  d.breakdown.logs.push({ ...incident(), breakdown_start_datetime: null });
  d.server_details.ram_gb = -1;
  d.server_details.availability_target = 101;
  await assert.rejects(d.validate(), { name: "ValidationError" });
});
test("input rejects audit forgery, dotted paths, invalid dates and string booleans", () => {
  assert.throws(() => validateInput({ created_by: "fake" }, []), /not editable/);
  assert.throws(() => validateInput({ "breakdown.logs": [] }, []), /not editable/);
  assert.throws(() => validateInput({ last_patch_date: "invalid" }, ["last_patch_date"]), /Invalid date/);
  assert.throws(() => validateInput({ backup_enabled: "false" }, ["backup_enabled"]), /boolean/);
});
test("admin API adds separate logs, restores an incident and enforces access", async (t) => {
  const d = device();
  d.dept_code = "IT";
  let role = 0;
  let department = "IT";
  t.mock.method(Admin, "findById", () => ({ select: () => ({ lean: async () => ({ _id: adminId, user_type: role, dept_code: department }) }) }));
  t.mock.method(RegisterDevice, "findById", async () => d);
  t.mock.method(d, "save", async () => { await d.validate(); return d; });
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-server-details-secret";
  const app = express();
  app.use(express.json());
  app.use(router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  });
  const base = `http://127.0.0.1:${server.address().port}/servers/${d.id}`;
  const headers = { Authorization: `Bearer ${jwt.sign({ id: adminId.toString() }, process.env.JWT_SECRET)}`, "Content-Type": "application/json" };
  assert.equal((await fetch(base)).status, 401);
  let response = await fetch(base, { method: "PATCH", headers, body: JSON.stringify({ server_tag_no: "SRV-01", backup_enabled: false, purchase_order_no: "PO-1" }) });
  assert.equal(response.status, 200);
  assert.equal(d.po_no, "PO-1");
  assert.equal(d.server_details.backup_enabled, false);
  for (let i = 0; i < 2; i++) {
    response = await fetch(`${base}/breakdown`, { method: "POST", headers, body: JSON.stringify({ breakdown_start_datetime: "2026-11-17T10:00:00Z", ticket_no: `T-${i}` }) });
    assert.equal(response.status, 201);
  }
  assert.equal(d.breakdown.logs.length, 2);
  const first = d.breakdown.logs[0];
  assert.equal(first.server_id.toString(), d.id);
  assert.equal(first.server_tag_no, "SRV-01");
  assert.equal(first.created_by.toString(), adminId.toString());
  response = await fetch(`${base}/breakdown/${first.incident_id}`, { method: "PATCH", headers, body: JSON.stringify({ restoration_datetime: "2026-11-17T12:30:00Z" }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.downtime_hours, 2.5);
  assert.equal(d.breakdown.logs[1].restoration_datetime, null);
  response = await fetch(`${base}/breakdown`, { method: "POST", headers, body: JSON.stringify({ downtime_hours: 99 }) });
  assert.equal(response.status, 400);
  role = 1; department = "HR";
  assert.equal((await fetch(base, { headers })).status, 403);
  department = "";
  assert.equal((await fetch(base, { headers })).status, 403);
  department = "IT";
  assert.equal((await fetch(base, { headers })).status, 200);
  role = 0;
  d.serial_no = "TEST-001";
  t.mock.method(IpInfo, "findOne", () => ({ sort: () => ({ lean: async () => ({
    _id: new mongoose.Types.ObjectId(), hostname: "scanned-host", os: "Windows",
    json_data: { system_health: { ram_total: "16 GiB", cpu_model: "Test CPU" } }
  }) }) }));
  d.server_details.hostname = "admin-host";
  response = await fetch(`${base}/scan-prefill`, { method: "POST", headers });
  assert.equal(response.status, 200);
  assert.equal(d.server_details.hostname, "admin-host");
  assert.equal(d.server_details.ram_gb, 17.18);
  assert.equal(d.breakdown.logs.length, 2);
  assert.equal(d.breakdown.logs[0].downtime_hours, 2.5);
  t.mock.method(d, "save", async () => { const error = new Error("conflict"); error.name = "VersionError"; throw error; });
  response = await fetch(base, { method: "PATCH", headers, body: JSON.stringify({ environment: "Test" }) });
  assert.equal(response.status, 409);
});
