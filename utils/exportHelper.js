const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

const EXPORT_COLUMNS = [
  { header: "Name", key: "Name" },
  { header: "Phone", key: "Phone" },
  { header: "PF No.", key: "PF No." },
  { header: "Department", key: "Department" },
  { header: "Designation", key: "Designation" },
  { header: "Target IP", key: "Target IP" },
  { header: "Device Type", key: "Device Type" },
  { header: "Date of Procurement", key: "Date of Procurement" },
  { header: "DSR No.", key: "DSR No." },
  { header: "Series No.", key: "Series No." },
  { header: "Hostname", key: "Hostname" },
  { header: "OS", key: "OS" },
  { header: "OS Version", key: "OS Version" },
  { header: "OS Release", key: "OS Release" },
  { header: "Architecture", key: "Architecture" },
  { header: "Distro", key: "Distro" },
  { header: "Scan Time", key: "Scan Time" },
  { header: "Host Hypervisor", key: "Host Hypervisor" },
  { header: "CPU Count", key: "CPU Count" },
  { header: "CPU Model", key: "CPU Model" },
  { header: "CPU Usage %", key: "CPU Usage %" },
  { header: "RAM Total", key: "RAM Total" },
  { header: "RAM Used", key: "RAM Used" },
  { header: "RAM Free", key: "RAM Free" },
  { header: "RAM %", key: "RAM %" },
  { header: "Uptime", key: "Uptime" },
  { header: "Score", key: "Score" },
  { header: "Grade", key: "Grade" },
  { header: "CRITICAL Findings", key: "CRITICAL Findings" },
  { header: "HIGH Findings", key: "HIGH Findings" },
  { header: "MEDIUM Findings", key: "MEDIUM Findings" },
  { header: "LOW Findings", key: "LOW Findings" },
  { header: "INFO Findings", key: "INFO Findings" }
];

const FIELD_KEYS = {
  osVersion: ["system_info.os_version", "os_version", "OS_Version", "osVersion"],
  osRelease: ["system_info.os_release", "os_release", "OS_Release", "osRelease"],
  architecture: ["system_info.architecture", "architecture", "Architecture"],
  distro: ["system_info.distro", "distro", "Distro"],
  scanTime: ["system_info.scan_time", "scan_time", "Scan_Time", "scanTime"],
  hostHypervisor: ["system_info.host_hypervisor", "host_hypervisor", "Host_Hypervisor", "hostHypervisor"],
  cpuCount: ["system_health.cpu_count", "cpu_count", "CPU_Count", "cpuCount"],
  cpuModel: ["system_health.cpu_model", "cpu_model", "CPU_Model", "cpuModel"],
  cpuUsage: ["system_health.cpu_usage_pct", "system_health.cpu_usage_percent", "cpu_usage_pct", "cpu_usage_percent", "CPU_Usage_Percent", "cpuUsagePercent"],
  ramTotal: ["system_health.ram_total", "ram_total", "RAM_Total", "ramTotal"],
  ramUsed: ["system_health.ram_used", "ram_used", "RAM_Used", "ramUsed"],
  ramFree: ["system_health.ram_free", "ram_free", "RAM_Free", "ramFree"],
  ramPercent: ["system_health.ram_pct", "system_health.ram_percent", "ram_pct", "ram_percent", "RAM_Percent", "ramPercent"],
  uptime: ["system_health.uptime", "uptime", "Uptime"],
  score: ["cyber_security.score", "score", "Score"],
  grade: ["cyber_security.grade", "grade", "Grade"],
  criticalFindings: ["cyber_security.summary.CRITICAL", "critical_findings", "CRITICAL_Findings", "criticalFindings"],
  highFindings: ["cyber_security.summary.HIGH", "high_findings", "HIGH_Findings", "highFindings"],
  mediumFindings: ["cyber_security.summary.MEDIUM", "medium_findings", "MEDIUM_Findings", "mediumFindings"],
  lowFindings: ["cyber_security.summary.LOW", "low_findings", "LOW_Findings", "lowFindings"],
  infoFindings: ["cyber_security.summary.INFO", "info_findings", "INFO_Findings", "infoFindings"]
};

const WORKSHEET_NAMES = {
  ip: "IP_Report",
  dsr: "DSR_Report",
  series: "Series_Report",
  all: "Combined_Report"
};

const formatDateTime = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const valueAtPath = (source, path) => {
  if (!source || typeof source !== "object") {
    return null;
  }

  return String(path)
    .split(".")
    .reduce((current, segment) => {
      if (current === null || current === undefined || typeof current !== "object") {
        return null;
      }

      return Object.prototype.hasOwnProperty.call(current, segment) ? current[segment] : null;
    }, source);
};

const getField = (jsonData, possibleKeys) => {
  for (const key of possibleKeys) {
    const value = valueAtPath(jsonData, key);

    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }

  return null;
};

const displayValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return value;
};

const buildExportRow = (record) => {
  const jsonData = record.json_data || {};

  return {
    "Name": displayValue(record.name),
    "Phone": displayValue(record.phone),
    "PF No.": displayValue(record.pf_no),
    "Department": displayValue(record.dept_name),
    "Designation": displayValue(record.designation),
    "Target IP": displayValue(record.target_ip),
    "Device Type": displayValue(record.device_type),
    "Date of Procurement": displayValue(record.date_of_procurement),
    "DSR No.": displayValue(record.dsr_no),
    "Series No.": displayValue(record.Series_no),
    "Hostname": displayValue(record.hostname),
    "OS": displayValue(record.os),
    "OS Version": displayValue(getField(jsonData, FIELD_KEYS.osVersion)),
    "OS Release": displayValue(getField(jsonData, FIELD_KEYS.osRelease)),
    "Architecture": displayValue(getField(jsonData, FIELD_KEYS.architecture)),
    "Distro": displayValue(getField(jsonData, FIELD_KEYS.distro)),
    "Scan Time": displayValue(getField(jsonData, FIELD_KEYS.scanTime)),
    "Host Hypervisor": displayValue(getField(jsonData, FIELD_KEYS.hostHypervisor)),
    "CPU Count": displayValue(getField(jsonData, FIELD_KEYS.cpuCount)),
    "CPU Model": displayValue(getField(jsonData, FIELD_KEYS.cpuModel)),
    "CPU Usage %": displayValue(getField(jsonData, FIELD_KEYS.cpuUsage)),
    "RAM Total": displayValue(getField(jsonData, FIELD_KEYS.ramTotal)),
    "RAM Used": displayValue(getField(jsonData, FIELD_KEYS.ramUsed)),
    "RAM Free": displayValue(getField(jsonData, FIELD_KEYS.ramFree)),
    "RAM %": displayValue(getField(jsonData, FIELD_KEYS.ramPercent)),
    "Uptime": displayValue(getField(jsonData, FIELD_KEYS.uptime)),
    "Score": displayValue(getField(jsonData, FIELD_KEYS.score)),
    "Grade": displayValue(getField(jsonData, FIELD_KEYS.grade)),
    "CRITICAL Findings": displayValue(getField(jsonData, FIELD_KEYS.criticalFindings)),
    "HIGH Findings": displayValue(getField(jsonData, FIELD_KEYS.highFindings)),
    "MEDIUM Findings": displayValue(getField(jsonData, FIELD_KEYS.mediumFindings)),
    "LOW Findings": displayValue(getField(jsonData, FIELD_KEYS.lowFindings)),
    "INFO Findings": displayValue(getField(jsonData, FIELD_KEYS.infoFindings))
  };
};

const generateExcel = async (rows, reportType) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(WORKSHEET_NAMES[reportType] || WORKSHEET_NAMES.all);
  const generatedAt = formatDateTime();

  worksheet.mergeCells(1, 1, 1, EXPORT_COLUMNS.length);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = `ITC Device Scan Report - Generated on ${generatedAt}`;
  titleCell.font = { bold: true, size: 14, color: { argb: "FFFF6200" } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };

  worksheet.columns = EXPORT_COLUMNS.map((column) => ({ key: column.key, width: 12 }));
  const headerRow = worksheet.getRow(2);
  headerRow.values = EXPORT_COLUMNS.map((column) => column.header);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF003580" }
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  rows.forEach((row) => worksheet.addRow(row));

  worksheet.views = [{ state: "frozen", ySplit: 2 }];
  worksheet.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: 2, column: EXPORT_COLUMNS.length }
  };

  worksheet.columns.forEach((column) => {
    let maxLength = 12;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const cellLength = String(cell.value || "").length;
      maxLength = Math.max(maxLength, cellLength);
    });
    column.width = Math.min(Math.max(maxLength + 2, 12), 30);
  });

  return workbook.xlsx.writeBuffer();
};

const truncate = (value, length = 24) => {
  const text = String(displayValue(value));
  return text.length > length ? `${text.slice(0, length - 1)}.` : text;
};

const getPdfColumnGroups = () => {
  const anchorColumns = EXPORT_COLUMNS.slice(0, 1).concat(EXPORT_COLUMNS.slice(5, 6));
  const remainingColumns = EXPORT_COLUMNS.filter((column) => !["Name", "Target IP"].includes(column.key));
  const groups = [];

  for (let index = 0; index < remainingColumns.length; index += 10) {
    groups.push(anchorColumns.concat(remainingColumns.slice(index, index + 10)));
  }

  return groups;
};

const drawPdfTable = (doc, rows, columns, subtitle, deptLabel) => {
  const margin = 24;
  const pageWidth = doc.page.width - margin * 2;
  const rowHeight = 22;
  const colWidth = pageWidth / columns.length;
  let y = 92;

  const drawHeader = () => {
    doc.fontSize(13).fillColor("#003580").font("Helvetica-Bold").text("Indian Railways - ITC Device Scan Report", margin, 24);
    doc.fontSize(8).fillColor("#333333").font("Helvetica").text(subtitle, margin, 43);
    doc.text(`Department: ${deptLabel}`, margin, 56);

    doc.rect(margin, 72, pageWidth, rowHeight).fill("#003580");
    columns.forEach((column, columnIndex) => {
      doc
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .fontSize(6.5)
        .text(column.header, margin + columnIndex * colWidth + 2, 78, {
          width: colWidth - 4,
          height: rowHeight - 4
        });
    });
  };

  drawHeader();

  rows.forEach((row, rowIndex) => {
    if (y + rowHeight > doc.page.height - 44) {
      doc.addPage();
      y = 92;
      drawHeader();
    }

    doc.rect(margin, y, pageWidth, rowHeight).fill(rowIndex % 2 === 0 ? "#ffffff" : "#f0f4ff");
    columns.forEach((column, columnIndex) => {
      doc
        .strokeColor("#d8deea")
        .lineWidth(0.4)
        .rect(margin + columnIndex * colWidth, y, colWidth, rowHeight)
        .stroke();
      doc
        .fillColor("#222222")
        .font("Helvetica")
        .fontSize(6.5)
        .text(truncate(row[column.key]), margin + columnIndex * colWidth + 2, y + 6, {
          width: colWidth - 4,
          height: rowHeight - 5
        });
    });

    y += rowHeight;
  });
};

const addPdfFooters = (doc) => {
  const range = doc.bufferedPageRange();

  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    doc
      .fontSize(8)
      .fillColor("#666666")
      .text(`Page ${index + 1} of ${range.count}`, 24, doc.page.height - 28, { align: "left" })
      .text("Generated by ITC System Scanner Portal", 24, doc.page.height - 28, { align: "right" });
  }
};

const generatePdf = (rows, reportType, deptLabel) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 24,
    bufferPages: true
  });
  const chunks = [];
  const subtitle = `${reportType} Report | Generated: ${formatDateTime()}`;

  doc.on("data", (chunk) => chunks.push(chunk));
  doc.on("error", reject);
  doc.on("end", () => resolve(Buffer.concat(chunks)));

  const groups = getPdfColumnGroups();
  groups.forEach((columns, index) => {
    if (index > 0) {
      doc.addPage();
    }
    drawPdfTable(doc, rows, columns, subtitle, deptLabel);
  });

  addPdfFooters(doc);
  doc.end();
});

module.exports = {
  EXPORT_COLUMNS,
  FIELD_KEYS,
  buildExportRow,
  formatDateTime,
  generateExcel,
  generatePdf,
  getField
};
