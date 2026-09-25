import { ImageResponse } from "next/og";

export const alt = "StockPilot — Run your shop smarter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "linear-gradient(135deg, #1e1b4b 0%, #4338ca 60%, #6366f1 100%)", color: "white" }}>
        <div style={{ fontSize: 34, opacity: 0.85, display: "flex" }}>StockPilot</div>
        <div style={{ fontSize: 72, fontWeight: 700, marginTop: 24, lineHeight: 1.1, display: "flex" }}>Run your shop smarter.</div>
        <div style={{ fontSize: 40, marginTop: 16, opacity: 0.9, display: "flex" }}>Know your stock. Know your numbers.</div>
        <div style={{ fontSize: 26, marginTop: 48, opacity: 0.75, display: "flex" }}>Inventory · POS · Customers · Suppliers · Expenses · Reports</div>
      </div>
    ),
    size,
  );
}
