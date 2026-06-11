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
PORT=5000
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
curl -L "http://localhost:5000/api/download/scanner" -o ITC_System_Scanner_V1.exe
```

Register device:

```bash
curl -X POST "http://localhost:5000/api/register" \
  -F "name=Ajay Wagh" \
  -F "phone=9999999999" \
  -F "pf_no=PF001" \
  -F "department=IT" \
  -F "designation=JE" \
  -F "pdf_file=@scanner-report.pdf;type=application/pdf" \
  -F "json_file=@scanner-output.json;type=application/json"
```

Successful response:

```json
{ "success": true, "message": "Device registered successfully." }
```

## Admin Endpoints

Default admin is seeded only when the `admins` collection is empty:

```text
username: admin
password: 123456
```

Login:

```bash
curl -X POST "http://localhost:5000/api/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"123456\"}"
```

Use the returned token:

```bash
curl "http://localhost:5000/api/admin/records" \
  -H "Authorization: Bearer <token>"

curl "http://localhost:5000/api/admin/records?department=IT" \
  -H "Authorization: Bearer <token>"

curl "http://localhost:5000/api/admin/records/<id>" \
  -H "Authorization: Bearer <token>"

curl -L "http://localhost:5000/api/admin/records/<id>/pdf" \
  -H "Authorization: Bearer <token>" -o record.pdf

curl -L "http://localhost:5000/api/admin/records/<id>/json" \
  -H "Authorization: Bearer <token>" -o record.json
```

Records are stored in MongoDB collection `ip_records`. The parsed JSON is saved fully in `json_data`; `target_ip`, `hostname`, and `os` are extracted from the uploaded JSON when present.
