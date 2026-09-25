// Report export (CSV + PDF). PDFs are generated server-side with pdf-lib
// using standard fonts (so currency is written as the ISO code, e.g. "NGN").
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import Sale from "../models/Sale.js";
import Expense from "../models/Expense.js";
import Product from "../models/Product.js";
import Tenant from "../models/Tenant.js";
import { scoped } from "./_scope.js";
import { toCSV } from "../utils/csv.js";
import { profitReport, inventoryReport, customerReport, salesSummary, expensesSummary } from "./reports.js";
import { EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from "../lib/constants.js";
import { badRequest } from "../lib/errors.js";

const n2 = (v) => (Number(v) || 0).toFixed(2);
const dt = (d, tz) => (d ? new Date(d).toLocaleString("en-GB", { timeZone: tz, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const day = (d, tz) => (d ? new Date(d).toLocaleDateString("en-GB", { timeZone: tz, day: "2-digit", month: "short", year: "numeric" }) : "");

export async function buildReport(ctx, type, range) {
  const tz = ctx.timezone;
  const cur = ctx.currency || "NGN";
  switch (type) {
    case "sales": {
      const [summary, rows] = await Promise.all([
        salesSummary(ctx, range),
        Sale.find(scoped(ctx, { createdAt: { $gte: range.from, $lt: range.to } })).sort({ createdAt: -1 }).limit(20_000).lean(),
      ]);
      return {
        title: "Sales Report",
        summary: [
          ["Transactions", String(summary.count)],
          [`Total sales (${cur})`, n2(summary.totalSales)],
          [`Revenue excl. tax (${cur})`, n2(summary.revenue)],
          [`Gross profit (${cur})`, n2(summary.grossProfit)],
          [`Discounts (${cur})`, n2(summary.discounts)],
          [`Tax (${cur})`, n2(summary.tax)],
        ],
        columns: [
          { key: "date", label: "Date", width: 90, value: (r) => dt(r.createdAt, tz) },
          { key: "invoiceNumber", label: "Invoice", width: 70 },
          { key: "customerName", label: "Customer", width: 100 },
          { key: "paymentMethod", label: "Method", width: 60, value: (r) => PAYMENT_METHOD_LABELS[r.paymentMethod] || r.paymentMethod },
          { key: "discount", label: "Discount", width: 55, value: (r) => n2(r.discount), align: "right" },
          { key: "total", label: "Total", width: 65, value: (r) => n2(r.total), align: "right" },
          { key: "grossProfit", label: "Profit", width: 60, value: (r) => n2(r.grossProfit), align: "right" },
          { key: "status", label: "Status", width: 55 },
        ],
        rows,
      };
    }
    case "inventory": {
      const [report, rows] = await Promise.all([
        inventoryReport(ctx),
        Product.find(scoped(ctx, { isDeleted: false })).sort({ name: 1 }).select("-image").limit(50_000).lean(),
      ]);
      return {
        title: "Inventory Report",
        summary: [
          ["Products", String(report.totalProducts)],
          ["Total stock quantity", String(report.totalQuantity)],
          ["Low-stock products", String(report.lowStockCount)],
          ["Out-of-stock products", String(report.outOfStockCount)],
          [`Inventory value at cost (${cur})`, n2(report.inventoryValue)],
          [`Retail value (${cur})`, n2(report.retailValue)],
        ],
        columns: [
          { key: "name", label: "Product", width: 150 },
          { key: "sku", label: "SKU", width: 70 },
          { key: "quantity", label: "Qty", width: 45, align: "right" },
          { key: "minimumStockLevel", label: "Min", width: 40, align: "right" },
          { key: "costPrice", label: "Cost", width: 60, value: (r) => n2(r.costPrice), align: "right" },
          { key: "sellingPrice", label: "Price", width: 60, value: (r) => n2(r.sellingPrice), align: "right" },
          { key: "value", label: "Stock value", width: 70, value: (r) => n2(Math.max(r.quantity, 0) * r.costPrice), align: "right" },
        ],
        rows,
      };
    }
    case "profit": {
      const report = await profitReport(ctx, range);
      return {
        title: "Profit & Loss Report",
        summary: [
          [`Revenue (${cur})`, n2(report.revenue)],
          [`Cost of goods sold (${cur})`, n2(report.cogs)],
          [`Gross profit (${cur})`, `${n2(report.grossProfit)} (${report.grossMargin}%)`],
          [`Expenses (${cur})`, n2(report.expenses)],
          [`Net profit (${cur})`, `${n2(report.netProfit)} (${report.netMargin}%)`],
        ],
        columns: [
          { key: "date", label: "Date", width: 90 },
          { key: "revenue", label: "Revenue", width: 90, value: (r) => n2(r.revenue), align: "right" },
          { key: "grossProfit", label: "Gross profit", width: 90, value: (r) => n2(r.grossProfit), align: "right" },
          { key: "expenses", label: "Expenses", width: 90, value: (r) => n2(r.expenses), align: "right" },
          { key: "netProfit", label: "Net profit", width: 90, value: (r) => n2(r.netProfit), align: "right" },
        ],
        rows: report.daily,
      };
    }
    case "expenses": {
      const [summary, rows] = await Promise.all([
        expensesSummary(ctx, range),
        Expense.find(scoped(ctx, { date: { $gte: range.from, $lt: range.to } })).sort({ date: -1 }).limit(20_000).lean(),
      ]);
      return {
        title: "Expense Report",
        summary: [
          [`Total expenses (${cur})`, n2(summary.total)],
          ["Entries", String(summary.count)],
          ...summary.byCategory.map((c) => [`${EXPENSE_CATEGORY_LABELS[c.category] || c.category} (${cur})`, n2(c.total)]),
        ],
        columns: [
          { key: "date", label: "Date", width: 80, value: (r) => day(r.date, tz) },
          { key: "category", label: "Category", width: 90, value: (r) => EXPENSE_CATEGORY_LABELS[r.category] || r.category },
          { key: "description", label: "Description", width: 180 },
          { key: "paymentMethod", label: "Method", width: 70, value: (r) => PAYMENT_METHOD_LABELS[r.paymentMethod] || r.paymentMethod },
          { key: "amount", label: "Amount", width: 75, value: (r) => n2(r.amount), align: "right" },
        ],
        rows,
      };
    }
    case "customers": {
      const report = await customerReport(ctx, range);
      return {
        title: "Customer Report",
        summary: [
          ["Customers", String(report.totalCustomers)],
          ["New in period", String(report.newCustomers)],
          [`Outstanding balances (${cur})`, n2(report.outstanding)],
        ],
        columns: [
          { key: "name", label: "Customer", width: 170 },
          { key: "count", label: "Purchases", width: 70, align: "right" },
          { key: "total", label: "Spent in period", width: 110, value: (r) => n2(r.total), align: "right" },
          { key: "balance", label: "Unpaid in period", width: 110, value: (r) => n2(r.balance), align: "right" },
        ],
        rows: report.topCustomers,
      };
    }
    default:
      throw badRequest("Unknown report type.");
  }
}

export function reportToCSV(report) {
  const summary = report.summary.map(([k, v]) => `"${k.replace(/"/g, '""')}","${String(v).replace(/"/g, '""')}"`).join("\r\n");
  return `${report.title}\r\n${summary}\r\n\r\n${toCSV(report.rows, report.columns)}`;
}

const clean = (s) =>
  String(s ?? "")
    .replace(/₦/g, "NGN ")
    .replace(/[→⇒]/g, "->")
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E -ÿ]/g, "?");

function truncate(font, text, size, width) {
  let t = clean(text);
  if (font.widthOfTextAtSize(t, size) <= width) return t;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`.replace("…", "..."), size) > width) t = t.slice(0, -1);
  return `${t}...`;
}

export async function reportToPDF(ctx, report, rangeLabel) {
  const tenant = await Tenant.findById(ctx.tenantId).select("businessName address phone").lean();
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28;
  const H = 841.89;
  const M = 36;
  const brand = rgb(0.31, 0.27, 0.9);
  const muted = rgb(0.4, 0.45, 0.55);

  let page = pdf.addPage([W, H]);
  let y = H - M;

  const header = () => {
    page.drawText(clean(tenant?.businessName || "StockPilot"), { x: M, y, size: 16, font: bold, color: rgb(0.06, 0.09, 0.16) });
    y -= 18;
    page.drawText(clean(`${report.title} · ${rangeLabel}`), { x: M, y, size: 11, font, color: brand });
    y -= 14;
    page.drawText(clean(`Generated ${new Date().toLocaleString("en-GB", { timeZone: ctx.timezone })} · StockPilot`), { x: M, y, size: 8, font, color: muted });
    y -= 20;
  };
  header();

  // Summary block
  for (const [k, v] of report.summary) {
    page.drawText(clean(k), { x: M, y, size: 9, font, color: muted });
    page.drawText(clean(v), { x: M + 220, y, size: 9, font: bold });
    y -= 13;
  }
  y -= 12;

  const totalWidth = report.columns.reduce((s, c) => s + (c.width || 80), 0);
  const scale = Math.min(1, (W - 2 * M) / totalWidth);
  const cols = report.columns.map((c) => ({ ...c, w: (c.width || 80) * scale }));

  const drawHead = () => {
    page.drawRectangle({ x: M - 2, y: y - 4, width: W - 2 * M + 4, height: 16, color: rgb(0.93, 0.94, 0.98) });
    let x = M;
    for (const c of cols) {
      const text = truncate(bold, c.label, 8, c.w - 4);
      const tx = c.align === "right" ? x + c.w - 4 - bold.widthOfTextAtSize(text, 8) : x;
      page.drawText(text, { x: tx, y, size: 8, font: bold });
      x += c.w;
    }
    y -= 16;
  };
  drawHead();

  const rows = report.rows.slice(0, 5000);
  for (const row of rows) {
    if (y < M + 20) {
      page = pdf.addPage([W, H]);
      y = H - M;
      drawHead();
    }
    let x = M;
    for (const c of cols) {
      const raw = c.value ? c.value(row) : row[c.key];
      const text = truncate(font, raw, 8, c.w - 4);
      const tx = c.align === "right" ? x + c.w - 4 - font.widthOfTextAtSize(text, 8) : x;
      page.drawText(text, { x: tx, y, size: 8, font });
      x += c.w;
    }
    y -= 12;
  }
  if (report.rows.length > rows.length) {
    page.drawText(`Showing first ${rows.length} of ${report.rows.length} rows. Export CSV for the full dataset.`, { x: M, y: y - 6, size: 8, font, color: muted });
  }
  if (!report.rows.length) page.drawText("No records in this period.", { x: M, y, size: 9, font, color: muted });

  const pages = pdf.getPages();
  pages.forEach((p, i) => p.drawText(`Page ${i + 1} of ${pages.length}`, { x: W - M - 60, y: 20, size: 8, font, color: muted }));
  return pdf.save();
}

export function reportToCSVString(report) {
  return reportToCSV(report);
}
