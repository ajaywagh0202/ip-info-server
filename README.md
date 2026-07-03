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
