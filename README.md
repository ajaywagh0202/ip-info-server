# ITC System Scanner Portal Backend

Node.js + Express.js REST API for Indian Railways IT Cell device registration.

## Setup

```bash
npm install
copy .env.example .env
npm start
```

Required environment variables:

```env
PORT=8000
MONGO_URI=mongodb://127.0.0.1:27017/itc_device_registration
FRONTEND_URL=http://localhost:3000,http://localhost:5173
JWT_SECRET=change_this_jwt_secret
```

On startup the server creates:

```text
SCRIPT_FILE/
IP_INFO_FILE/JSON_FILE/
IP_INFO_FILE/PDF_FILE/
```

Place the scanner executable at:

```text
SCRIPT_FILE/ITC_System_Scanner_V1.exe
```

## User Endpoints

Download scanner:

```bash
curl -L "http://localhost:8000/api/download/scanner" -o ITC_System_Scanner_V1.exe
```

### 1. Register and assign a device

`POST /api/register-device` stores the user in `register_users`, the device in
`register_devices`, and their assignment in `user_device_assigns`.

```bash
curl -X POST "http://localhost:8000/api/register-device" \
  -H "Content-Type: application/json" \
  -d "{\"serial_no\":\"9875463215\",\"dsr_no\":\"69582471\",\"device_type\":\"Desktop\",\"name\":\"Ajay Wagh\",\"pf_no\":\"575445547\",\"phone\":\"9999999999\",\"designation\":\"JE\",\"department\":\"IT\",\"section_office\":\"Head Office\",\"target_ip\":\"10.31.3.114\",\"assigned_date\":\"2026-06-23\"}"
```

Required fields: `serial_no`, `dsr_no`, `device_type`, `name`, `pf_no`,
`phone`, `designation`, `department`, `section_office`, `target_ip`, and
`assigned_date`.

### 2. Upload a device scan

`POST /api/device-scan` stores the supplied scan metadata, parsed JSON, and
PDF/JSON file names in `ip_records`. The files themselves are stored in
`IP_INFO_FILE/PDF_FILE` and `IP_INFO_FILE/JSON_FILE`.

```bash
curl -X POST "http://localhost:8000/api/device-scan" \
  -F "dsr_no=69582471" \
  -F "serial_no=9875463215" \
  -F "pf_no=575445547" \
  -F "target_ip=10.31.3.114" \
  -F "name=Ajay Wagh" \
  -F "phone=9999999999" \
  -F "pdf_file=@scanner-report.pdf;type=application/pdf" \
  -F "json_file=@scanner-output.json;type=application/json"
```

The required multipart fields are `dsr_no`, `serial_no`, `pf_no`, `target_ip`,
`pdf_file`, and `json_file`. The JSON file must contain valid JSON.

Successful scan response:

```json
{ "success": true, "message": "Device scan saved successfully." }
```

## Admin Endpoints

Default admin is seeded only when the `admins` collection is empty:

```text
username: admin
password: 123456
```

Login:

```bash
curl -X POST "http://localhost:8000/api/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"123456\"}"
```

Use the returned token:

```bash
curl "http://localhost:8000/api/admin/records" \
  -H "Authorization: Bearer <token>"

curl "http://localhost:8000/api/admin/records?department=IT" \
  -H "Authorization: Bearer <token>"

curl "http://localhost:8000/api/admin/records/<id>" \
  -H "Authorization: Bearer <token>"

curl -L "http://localhost:8000/api/admin/records/<id>/pdf" \
  -H "Authorization: Bearer <token>" -o record.pdf

curl -L "http://localhost:8000/api/admin/records/<id>/json" \
  -H "Authorization: Bearer <token>" -o record.json
```

Records are stored in MongoDB collection `ip_records`. The parsed JSON is saved fully in `json_data`; `target_ip`, `hostname`, and `os` are extracted from the uploaded JSON when present.

## Server details and breakdown logs

Admin-only server endpoints use the existing `RegisterDevice._id` as `server_id`.
Find this ID in registration responses or `register_device._id` in device-details
responses. Department administrators retain their department access restriction.

- `GET /api/admin/servers/:server_id`: complete server view, including breakdown logs.
- `PATCH /api/admin/servers/:server_id`: update server fields using PDF field names.
- `POST /api/admin/servers/:server_id/scan-prefill`: fill missing hostname, OS name/version,
  CPU model and RAM from the latest scan matched by serial number. Preserves admin values.
- `GET /api/admin/servers/:server_id/breakdown`: returns `{ logs: [...] }`.
- `POST /api/admin/servers/:server_id/breakdown`: append an incident.
- `PATCH /api/admin/servers/:server_id/breakdown/:incident_id`: amend or restore an incident.

All requests require the existing admin Bearer token. The PATCH body is a flat
object, for example:

```json
{
  "server_tag_no": "SRV-001",
  "environment": "Production",
  "server_status": "In service",
  "backup_enabled": true,
  "ram_gb": 32,
  "warranty_end_date": "2027-11-17",
  "purchase_order_no": "PO-001"
}
```

New fields live in `register_devices.server_details`. Existing DSR, serial,
primary IP, location, manufacturer, purchase-order, procurement/installation dates
and remarks reuse their existing storage fields. The server view maps them to PDF
names. Edit DSR and primary IP through the existing device-details update API;
serial-number identity remains managed by registration. No duplicate asset records
or changes to uploaded scan files are required.

Full new field definitions: `models/ServerDetails.js`. Software detail fields accept
text (multiple products can be described in one value). Unknown values default to
null; capacities are numeric decimal GB, counts are nonnegative integers and
availability target is a percentage from 0 to 100. Scan GiB values are converted
to decimal GB during explicit prefill. Existing legacy asset dates retain string
storage; new operational/support dates use MongoDB Date. Send ISO dates, and include
an explicit timezone in incident timestamps.

Example new incident body:

```json
{
  "ticket_no": "HD-001",
  "breakdown_start_datetime": "2026-11-17T10:00:00+05:30",
  "root_cause": "Power",
  "reported_by": "IT team",
  "remarks": "Investigation in progress"
}
```

Example restoration PATCH body:

```json
{
  "restoration_datetime": "2026-11-17T12:30:00+05:30",
  "action_taken": "Replaced power supply",
  "restored_by": "Maintenance team",
  "remarks": "Service restored"
}
```

Each entry includes incident_id, server_id, server_tag_no (snapshot at creation),
ticket_no, breakdown_start_datetime, restoration_datetime, downtime_hours,
root_cause, action_taken, reported_by, restored_by, remarks, created_by/at and
updated_by/at. IDs and audit values are server-managed. Downtime is calculated in
hours and remains null while open. Server age is calculated in completed years
from purchase_date (existing procurement date), falling back to purchase_order_date.

Breakdown logs are embedded in `breakdown.logs` on the registered device, independent
of scans. There is no delete endpoint. Restoration cannot precede breakdown start.
Concurrent edits through these new endpoints use optimistic concurrency and return
409 if a document changed; reload before retrying. Public registration cannot set
server details, audit identity or breakdown logs.

Validation: `node --test tests/serverDetails.test.js`. Tests use actual Mongoose
validation and HTTP routes with mocked persistence/auth lookups; they do not require
or modify a live database. Frontend forms are not included in this backend change.
