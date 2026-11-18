import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { deflateSync, inflateSync } from "zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const senderEmail = process.env.BREVO_SENDER_EMAIL || "hello@gticomputers.lk";
const senderName = process.env.BREVO_SENDER_NAME || "GTI COMPUTERS";
const company = {
  phone: "076 659 1486",
  email: "hello@gticomputers.lk",
  address: "4th Post, Poddiwala, Maththaka, Galle, Sri Lanka",
  facebook: "GTI Computers",
  instagram: "GTI Computers"
};

const bankDetails = [
  ["Account name", "GTI COMPUTERS (PVT) LTD"],
  ["Bank", "Commercial Bank"],
  ["Branch", "Pitigala"],
  ["Account number", "8030821923"]
];

const hasCustomerEmail = (order = {}) => {
  const email = String(order.shippingAddress?.email || "").trim();
  return email && email !== "-";
};

const money = (value = 0) => `Rs. ${Number(value || 0).toLocaleString("en-LK", { maximumFractionDigits: 2 })}`;

const orderNumber = (order = {}) => String(order._id || "").slice(-8).toUpperCase();

const formatDate = (value) => value ? new Date(value).toLocaleString("en-LK", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
}) : new Date().toLocaleString("en-LK", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});

const pdfText = (value = "") => String(value)
  .replaceAll("\\", "\\\\")
  .replaceAll("(", "\\(")
  .replaceAll(")", "\\)");

const toAscii = (value = "") => String(value).replace(/[^\x20-\x7E]/g, " ");

const fitText = (value = "", max = 42) => {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
};

// ---------------------------------------------------------------------------
// PNG logo loader (unchanged from original — reads the site logo straight
// off disk and embeds it as a FlateDecode DeviceRGB image, no canvas needed)
// ---------------------------------------------------------------------------
const unfilterPng = ({ width, height, channels, data }) => {
  const stride = width * channels;
  const rows = Buffer.alloc(height * stride);
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = data[sourceOffset];
    sourceOffset += 1;
    const rowStart = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const raw = data[sourceOffset + x];
      const left = x >= channels ? rows[rowStart + x - channels] : 0;
      const up = y > 0 ? rows[rowStart - stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? rows[rowStart - stride + x - channels] : 0;
      let value = raw;
      if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + up;
      else if (filter === 3) value = raw + Math.floor((left + up) / 2);
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value = raw + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
      }
      rows[rowStart + x] = value & 255;
    }
    sourceOffset += stride;
  }
  return rows;
};

const loadLogoImage = () => {
  const candidates = [
    path.resolve(__dirname, "../../../client/public/assets/logo.png"),
    path.resolve(__dirname, "../../../../client/public/assets/logo.png"),
    path.resolve(process.cwd(), "../client/public/assets/logo.png"),
    path.resolve(process.cwd(), "client/public/assets/logo.png"),
    path.resolve(process.cwd(), "public/assets/logo.png")
  ];
  const logoPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!logoPath) return null;
  try {
    const png = fs.readFileSync(logoPath);
    if (png.toString("ascii", 1, 4) !== "PNG") return null;
    let offset = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    const idat = [];
    while (offset < png.length) {
      const length = png.readUInt32BE(offset);
      const type = png.toString("ascii", offset + 4, offset + 8);
      const chunk = png.subarray(offset + 8, offset + 8 + length);
      if (type === "IHDR") {
        width = chunk.readUInt32BE(0);
        height = chunk.readUInt32BE(4);
        bitDepth = chunk[8];
        colorType = chunk[9];
      } else if (type === "IDAT") {
        idat.push(chunk);
      } else if (type === "IEND") {
        break;
      }
      offset += length + 12;
    }
    const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
    if (!width || !height || bitDepth !== 8 || !channels || !idat.length) return null;
    const rgbaOrRgb = unfilterPng({ width, height, channels, data: inflateSync(Buffer.concat(idat)) });
    const rgb = Buffer.alloc(width * height * 3);
    for (let i = 0, j = 0; i < rgbaOrRgb.length; i += channels, j += 3) {
      const alpha = channels === 4 ? rgbaOrRgb[i + 3] / 255 : 1;
      rgb[j] = Math.round(rgbaOrRgb[i] * alpha + 255 * (1 - alpha));
      rgb[j + 1] = Math.round(rgbaOrRgb[i + 1] * alpha + 255 * (1 - alpha));
      rgb[j + 2] = Math.round(rgbaOrRgb[i + 2] * alpha + 255 * (1 - alpha));
    }
    return { width, height, data: deflateSync(rgb) };
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Accurate Helvetica glyph widths — replaces the old `length * size * 0.48`
// guess, which is what caused misaligned right-aligned numbers before.
// ---------------------------------------------------------------------------
const HELVETICA_REGULAR_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  222, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 200, 334, 584
];
const HELVETICA_BOLD_WIDTHS = [
  278, 333, 474, 556, 556, 1000, 722, 238, 333, 333, 389, 584, 333, 333, 333, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 778, 278, 556, 722, 611, 889, 722, 778,
  667, 778, 722, 722, 667, 722, 722, 1000, 722, 722, 667, 333, 278, 333, 584, 556,
  278, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 278, 389, 584
];

const approxTextWidth = (value = "", size = 10, font = "F1") => {
  const str = String(value || "");
  let totalWidth = 0;
  const isBold = font === "F2";
  const widths = isBold ? HELVETICA_BOLD_WIDTHS : HELVETICA_REGULAR_WIDTHS;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 32 && code <= 126) totalWidth += widths[code - 32];
    else totalWidth += isBold ? 556 : 500;
  }
  return (totalWidth / 1000) * size;
};

const wrapText = (value = "", maxWidth, size = 10, font = "F1") => {
  const words = String(value || "").split(" ").filter(Boolean);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (approxTextWidth(candidate, size, font) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });
  if (current) lines.push(current);
  return lines;
};

// ---------------------------------------------------------------------------
// Drawing helpers — a tiny PDF content-stream "canvas" (rects, circles,
// leaf motifs, the ribbon shape, clipped logo image, measured text)
// ---------------------------------------------------------------------------
const createCanvas = () => {
  const commands = [];
  const hexToRgb = (hex) => {
    const value = hex.replace("#", "");
    const r = parseInt(value.slice(0, 2), 16) / 255;
    const g = parseInt(value.slice(2, 4), 16) / 255;
    const b = parseInt(value.slice(4, 6), 16) / 255;
    return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
  };
  const fill = (hex) => commands.push(`${hexToRgb(hex)} rg`);
  const stroke = (hex) => commands.push(`${hexToRgb(hex)} RG`);

  const api = {
    rect(x, y, w, h, fillHex, strokeHex, lineWidth) {
      if (fillHex) fill(fillHex);
      if (strokeHex) stroke(strokeHex);
      if (lineWidth) commands.push(`${lineWidth} w`);
      commands.push(`${x} ${y} ${w} ${h} re ${fillHex && strokeHex ? "B" : fillHex ? "f" : "S"}`);
    },
    roundedRect(x, y, w, h, r, fillHex, strokeHex, lineWidth) {
      if (fillHex) fill(fillHex);
      if (strokeHex) stroke(strokeHex);
      if (lineWidth) commands.push(`${lineWidth} w`);
      const k = 0.5523 * r;
      commands.push(`${x + r} ${y} m`);
      commands.push(`${x + w - r} ${y} l`);
      commands.push(`${x + w - r + k} ${y} ${x + w} ${y + r - k} ${x + w} ${y + r} c`);
      commands.push(`${x + w} ${y + h - r} l`);
      commands.push(`${x + w} ${y + h - r + k} ${x + w - r + k} ${y + h} ${x + w - r} ${y + h} c`);
      commands.push(`${x + r} ${y + h} l`);
      commands.push(`${x + r - k} ${y + h} ${x} ${y + h - r + k} ${x} ${y + h - r} c`);
      commands.push(`${x} ${y + r} l`);
      commands.push(`${x} ${y + r - k} ${x + r - k} ${y} ${x + r} ${y} c`);
      commands.push("h");
      commands.push(fillHex && strokeHex ? "B" : fillHex ? "f" : "S");
    },
    circle(cx, cy, r, fillHex, strokeHex, lineWidth) {
      if (fillHex) fill(fillHex);
      if (strokeHex) stroke(strokeHex);
      if (lineWidth) commands.push(`${lineWidth} w`);
      const k = 0.5523 * r;
      commands.push(`${cx - r} ${cy} m`);
      commands.push(`${cx - r} ${cy + k} ${cx - k} ${cy + r} ${cx} ${cy + r} c`);
      commands.push(`${cx + k} ${cy + r} ${cx + r} ${cy + k} ${cx + r} ${cy} c`);
      commands.push(`${cx + r} ${cy - k} ${cx + k} ${cy - r} ${cx} ${cy - r} c`);
      commands.push(`${cx - k} ${cy - r} ${cx - r} ${cy - k} ${cx - r} ${cy} c`);
      commands.push("h");
      commands.push(fillHex && strokeHex ? "B" : fillHex ? "f" : "S");
    },
    // rounded-top / pointed-bottom pennant used for the "INVOICE" tag
    shieldRibbon(x, yTop, w, straightH, tipDrop, fillHex, strokeHex, lineWidth) {
      const rx = x + w;
      const midX = x + w / 2;
      const yStraightBottom = yTop - straightH;
      const yTip = yStraightBottom - tipDrop;
      const r = 14;
      if (fillHex) fill(fillHex);
      if (strokeHex) stroke(strokeHex);
      if (lineWidth) commands.push(`${lineWidth} w`);
      commands.push(`${x} ${yTop - r} m`);
      commands.push(`${x} ${yTop - r * 0.45} ${x + r * 0.45} ${yTop} ${x + r} ${yTop} c`);
      commands.push(`${rx - r} ${yTop} l`);
      commands.push(`${rx - r * 0.45} ${yTop} ${rx} ${yTop - r * 0.45} ${rx} ${yTop - r} c`);
      commands.push(`${rx} ${yStraightBottom} l`);
      commands.push(`${midX} ${yTip} l`);
      commands.push(`${x} ${yStraightBottom} l`);
      commands.push("h");
      commands.push(fillHex && strokeHex ? "B" : fillHex ? "f" : "S");
    },
    leaf(cx, cy, length, width, angleDeg, hex) {
      const rad = (angleDeg * Math.PI) / 180;
      const cos = Math.cos(rad).toFixed(4);
      const sin = Math.sin(rad).toFixed(4);
      fill(hex);
      commands.push(`q ${cos} ${sin} ${-sin} ${cos} ${cx} ${cy} cm`);
      const w = width / 2;
      commands.push(`0 0 m`);
      commands.push(`${(length * 0.3).toFixed(2)} ${w} ${(length * 0.7).toFixed(2)} ${w} ${length} 0 c`);
      commands.push(`${(length * 0.7).toFixed(2)} ${-w} ${(length * 0.3).toFixed(2)} ${-w} 0 0 c`);
      commands.push("h f");
      commands.push("Q");
    },
    leafCluster(cx, cy, baseAngle, hexA, hexB) {
      const specs = [
        { dx: -4, dy: -2, len: 44, wid: 15, ang: baseAngle - 22, hex: hexA },
        { dx: 6, dy: -8, len: 56, wid: 19, ang: baseAngle - 5, hex: hexB },
        { dx: 14, dy: 0, len: 38, wid: 14, ang: baseAngle + 15, hex: hexA },
        { dx: 0, dy: 8, len: 32, wid: 12, ang: baseAngle + 32, hex: hexB },
        { dx: 12, dy: 12, len: 26, wid: 10, ang: baseAngle - 42, hex: hexA }
      ];
      specs.forEach((s) => api.leaf(cx + s.dx, cy + s.dy, s.len, s.wid, s.ang, s.hex));
    },
    clipCircleImage(name, cx, cy, r) {
      const k = 0.5523 * r;
      commands.push("q");
      commands.push(`${cx - r} ${cy} m`);
      commands.push(`${cx - r} ${cy + k} ${cx - k} ${cy + r} ${cx} ${cy + r} c`);
      commands.push(`${cx + k} ${cy + r} ${cx + r} ${cy + k} ${cx + r} ${cy} c`);
      commands.push(`${cx + r} ${cy - k} ${cx + k} ${cy - r} ${cx} ${cy - r} c`);
      commands.push(`${cx - k} ${cy - r} ${cx - r} ${cy - k} ${cx - r} ${cy} c`);
      commands.push("h W n");
      const d = r * 2;
      api.image(name, cx - r, cy - r, d, d);
      commands.push("Q");
    },
    image(name, x, y, w, h) {
      commands.push(`q ${w} 0 0 ${h} ${x} ${y} cm /${name} Do Q`);
    },
    line(x1, y1, x2, y2, hex = "#dedbd1", width = 1) {
      stroke(hex);
      commands.push(`${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
    },
    text(value, x, y, size = 10, font = "F1", hex = "#17372c") {
      fill(hex);
      commands.push(`BT /${font} ${size} Tf ${x} ${y} Td (${pdfText(toAscii(value))}) Tj ET`);
    },
    rightText(value, x, y, size = 10, font = "F1", hex = "#17372c") {
      api.text(value, x - approxTextWidth(value, size, font), y, size, font, hex);
    },
    centerText(value, cx, y, size = 10, font = "F1", hex = "#17372c") {
      api.text(value, cx - approxTextWidth(value, size, font) / 2, y, size, font, hex);
    },
    commands
  };
  return api;
};

// ---------------------------------------------------------------------------
// Invoice PDF builder
// ---------------------------------------------------------------------------
const buildConfirmedInvoiceAttachment = (order = {}) => {
  const invoiceNumber = `INV-${orderNumber(order)}`;
  const customerName = order.shippingAddress?.name || order.user?.name || "Customer";
  const customerEmail = order.shippingAddress?.email || order.user?.email || "";
  const items = order.items || [];
  const logo = loadLogoImage();
  const c = createCanvas();

  const forest = "#112e23";
  const lime = "#d8ed6c";
  const paper = "#faf8f5";
  const ink = "#1a201c";
  const sub = "#5c635e";
  const hair = "#e2ded6";
  const gold = "#d4af37";
  const cream = "#f4efe4";
  const white = "#ffffff";
  const mint = "#bfe0a0";

  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const margin = 42;
  const x0 = margin;
  const x1 = PAGE_W - margin;
  const contentW = x1 - x0;

  // ---- page background ----
  c.rect(0, 0, PAGE_W, PAGE_H, paper);
  c.rect(10, 10, PAGE_W - 20, PAGE_H - 20, null, gold, 0.75);

  // ---- leaf corner decorations ----
  c.leafCluster(margin - 16, PAGE_H - 4, -40, forest, lime);
  c.leafCluster(PAGE_W - margin + 30, PAGE_H - 4, -145, forest, gold);

  // ---- logo badge ----
  const badgeR = 34;
  const badgeCx = margin + badgeR + 2;
  const badgeCy = PAGE_H - 78;
  c.circle(badgeCx, badgeCy, badgeR + 6, null, gold, 1.4);
  c.circle(badgeCx, badgeCy, badgeR + 2, white);
  c.circle(badgeCx, badgeCy, badgeR, null, forest, 1);
  if (logo) {
    c.clipCircleImage("Logo", badgeCx, badgeCy, badgeR - 3);
  } else {
    c.circle(badgeCx, badgeCy, badgeR - 3, forest);
    c.centerText("G", badgeCx, badgeCy - 9, 24, "F2", lime);
  }

  const textX = badgeCx + badgeR + 20;
  c.text("GTI", textX, badgeCy + 24, 20, "F2", forest);
  c.text("COMPUTERS", textX, badgeCy + 6, 15, "F2", "#3f5c4c");
  c.text("Technology, chosen carefully.", textX, badgeCy - 10, 9, "F3", sub);
  c.circle(textX + 4, badgeCy - 24, 5, forest);
  c.text(company.phone, textX + 14, badgeCy - 27, 8.5, "F1", sub);
  const phoneW = approxTextWidth(company.phone, 8.5, "F1");
  c.circle(textX + 14 + phoneW + 18, badgeCy - 24, 5, forest);
  c.text(company.email, textX + 14 + phoneW + 28, badgeCy - 27, 8.5, "F1", sub);

  // ---- invoice ribbon ----
  const ribbonW = 190;
  const ribbonX = PAGE_W - margin - ribbonW;
  const ribbonYTop = PAGE_H - 8;
  const ribbonStraightH = 100;
  const ribbonTipDrop = 38;
  c.shieldRibbon(ribbonX, ribbonYTop, ribbonW, ribbonStraightH, ribbonTipDrop, forest, gold, 1.2);
  const ribbonCx = ribbonX + ribbonW / 2;
  c.centerText("INVOICE", ribbonCx, ribbonYTop - 30, 15, "F2", gold);
  c.centerText(invoiceNumber, ribbonCx, ribbonYTop - 52, 10.5, "F2", white);
  c.centerText(formatDate(order.createdAt), ribbonCx, ribbonYTop - 66, 8, "F1", mint);
  if (order.paymentStatus === "paid") {
    const pillW = 56;
    const pillX = ribbonCx - pillW / 2;
    const pillY = ribbonYTop - 90;
    c.roundedRect(pillX, pillY, pillW, 15, 7.5, lime);
    c.centerText("PAID", ribbonCx, pillY + 4.5, 8.5, "F2", forest);
  }

  c.line(x0, PAGE_H - 158, x1, PAGE_H - 158, gold, 1.2);
  c.line(x0, PAGE_H - 161, x1, PAGE_H - 161, lime, 0.6);

  // ---- info cards ----
  const infoTop = PAGE_H - 178;
  const cardH = 76;
  const infoBottom = infoTop - cardH;

  const postalCode = order.shippingAddress?.postalCode || "";
  const hasDelivery = order.shippingAddress && postalCode && postalCode !== "00000" && postalCode !== "-" && postalCode !== "N/A";

  const colGap = 12;
  let col1W, col2W, col3W, col1X, col2X, col3X;
  if (hasDelivery) {
    const availableW = contentW - colGap * 2;
    col1W = availableW * 0.4;
    col2W = availableW * 0.3;
    col3W = availableW * 0.3;
    col1X = x0;
    col2X = x0 + col1W + colGap;
    col3X = col2X + col2W + colGap;
  } else {
    const availableW = contentW - colGap;
    col1W = availableW / 2;
    col2W = 0;
    col3W = availableW / 2;
    col1X = x0;
    col2X = 0;
    col3X = x0 + col1W + colGap;
  }

  let displayEmail = customerEmail;
  if (!displayEmail || displayEmail === company.email || displayEmail === "-" || displayEmail === "N/A") displayEmail = "";

  // BILLED TO
  c.roundedRect(col1X, infoBottom, col1W, cardH, 8, cream, hair);
  c.text("BILLED TO", col1X + 10, infoTop - 14, 7, "F2", gold);
  const billedToLines = [];
  if (customerName) billedToLines.push(`Name: ${customerName}`);
  if (displayEmail) billedToLines.push(`Email: ${displayEmail}`);
  const phoneText = order.shippingAddress?.phone || order.user?.phone || "";
  if (phoneText) billedToLines.push(`Mobile: ${phoneText}`);
  billedToLines.forEach((text, i) => {
    const isFirst = i === 0;
    c.text(fitText(text, hasDelivery ? 40 : 55), col1X + 10, infoTop - 28 - (i * 14), isFirst ? 9.5 : 8.5, isFirst ? "F2" : "F1", isFirst ? ink : sub);
  });

  // DELIVER TO
  if (hasDelivery) {
    c.roundedRect(col2X, infoBottom, col2W, cardH, 8, cream, hair);
    c.text("DELIVER TO", col2X + 10, infoTop - 14, 7, "F2", gold);
    const deliverToLines = [];
    const street = order.shippingAddress?.houseNumberStreet || order.shippingAddress?.street;
    if (street) deliverToLines.push(`Address: ${street}`);
    const apt = order.shippingAddress?.apartment;
    if (apt) deliverToLines.push(`Apt: ${apt}`);
    const cityDist = [order.shippingAddress?.city, order.shippingAddress?.district].filter(Boolean).join(", ");
    if (cityDist) deliverToLines.push(`City: ${cityDist}`);
    if (postalCode) deliverToLines.push(`Postal: ${postalCode}`);
    deliverToLines.forEach((text, i) => {
      const isFirst = i === 0;
      c.text(fitText(text, 28), col2X + 10, infoTop - 28 - (i * 12), isFirst ? 9 : 8.5, isFirst ? "F2" : "F1", isFirst ? ink : sub);
    });
  }

  // PAYMENT INFO
  c.roundedRect(col3X, infoBottom, col3W, cardH, 8, cream, hair);
  c.text("PAYMENT INFO", col3X + 10, infoTop - 14, 7, "F2", gold);
  const paymentLines = [];
  paymentLines.push(`Method: ${order.paymentMethod === "bank" ? "Bank Transfer" : order.paymentMethod === "cash" ? "Cash Payment" : order.paymentMethod === "online" ? "PayHere" : "Cash on Delivery"}`);
  if (order.paymentReference) paymentLines.push(`Ref: ${order.paymentReference}`);
  paymentLines.push(`Status: ${order.paymentStatus || "pending"}`);
  paymentLines.forEach((text, i) => {
    const isFirst = i === 0;
    c.text(fitText(text, hasDelivery ? 28 : 50), col3X + 10, infoTop - 28 - (i * 14), isFirst ? 9 : 8.5, isFirst ? "F2" : "F1", isFirst ? ink : sub);
  });
  if (order.paymentStatus === "paid") {
    const stampX = col3X + col3W - 54;
    const stampY = infoBottom + 8;
    c.roundedRect(stampX, stampY, 44, 16, 4, null, gold);
    c.centerText("PAID", stampX + 22, stampY + 5, 8.5, "F2", gold);
  }

  // ---- items table ----
  const tableTop = infoBottom - 30;
  const qtyX = x0 + contentW - 176;
  const priceX = x0 + contentW - 84;
  c.roundedRect(x0, tableTop - 26, contentW, 26, 6, forest);
  c.text("PRODUCT", x0 + 14, tableTop - 17, 7.5, "F2", lime);
  c.rightText("QTY", qtyX, tableTop - 17, 7.5, "F2", lime);
  c.rightText("PRICE", priceX, tableTop - 17, 7.5, "F2", lime);
  c.rightText("AMOUNT", x1 - 14, tableTop - 17, 7.5, "F2", lime);

  let rowY = tableTop - 26;
  const rowHeight = 28;
  const maxRows = 8;
  items.slice(0, maxRows).forEach((item, index) => {
    rowY -= rowHeight;
    if (index % 2 === 1) c.rect(x0, rowY, contentW, rowHeight, cream);
    c.line(x0, rowY, x1, rowY, hair, 0.5);
    c.circle(x0 + 12, rowY + 14, 4, lime, forest, 0.6);
    c.text(fitText(item.name, 32), x0 + 24, rowY + 17, 9.5, "F2", ink);
    c.text(`${item.unit}`, x0 + 24, rowY + 6, 7.5, "F1", sub);
    c.rightText(String(item.quantity), qtyX, rowY + 13, 9, "F1", ink);
    c.rightText(money(item.price), priceX, rowY + 13, 9, "F1", ink);
    c.rightText(money((Number(item.price) || 0) * (Number(item.quantity) || 0)), x1 - 4, rowY + 13, 9.5, "F2", forest);
  });
  if (items.length > maxRows) {
    rowY -= 22;
    c.rect(x0, rowY, contentW, 22, cream);
    c.line(x0, rowY, x1, rowY, hair, 0.5);
    c.text(`+ ${items.length - maxRows} more item(s) recorded in this order`, x0 + 14, rowY + 7, 8, "F2", gold);
  }
  c.line(x0, rowY, x1, rowY, hair, 1);

  const footerBottom = 34;
  const footerH = 84;
  const footerTop = footerBottom + footerH;

  // ---- totals ----
  const discountAmount = Number(order.discountAmount || order.offerDiscountAmount || 0);
  const discountPercentage = Number(order.discountPercentage || order.offerDiscountPercentage || 0);
  const totalsW = 210;
  const totalsX = x1 - totalsW;
  let totalsY = rowY - 22;
  c.text("Subtotal", totalsX, totalsY, 9, "F1", sub);
  c.rightText(money(order.subtotal), x1 - 14, totalsY, 9, "F1", ink);
  totalsY -= 16;
  if (discountAmount > 0) {
    c.text(`Discount (${discountPercentage}%)`, totalsX, totalsY, 9, "F1", sub);
    c.rightText(`-${money(discountAmount)}`, x1 - 14, totalsY, 9, "F1", ink);
    totalsY -= 16;
  }
  c.text("Shipping", totalsX, totalsY, 9, "F1", sub);
  c.rightText(Number(order.shippingFee) ? money(order.shippingFee) : "Free", x1 - 14, totalsY, 9, "F1", ink);
  totalsY -= 12;
  c.line(totalsX, totalsY, x1, totalsY, hair, 0.5);

  const totalBarH = 40;
  totalsY -= totalBarH + 10;
  c.roundedRect(totalsX, totalsY, totalsW, totalBarH, 6, forest);
  c.rect(totalsX, totalsY, 4, totalBarH, lime);
  c.text("TOTAL DUE", totalsX + 14, totalsY + 24, 8.5, "F2", lime);
  c.rightText(money(order.total), x1 - 14, totalsY + 20, 17, "F2", white);

  // ---- bank details ----
  if (order.paymentMethod === "bank") {
    const bankCardW = totalsX - x0 - 18;
    const bankCardH = 112;
    const bankCardY = footerTop + 14;
    c.roundedRect(x0, bankCardY, bankCardW, bankCardH, 8, cream, hair);
    c.rect(x0, bankCardY + bankCardH - 5, bankCardW, 5, lime);
    c.text("BANK TRANSFER DETAILS", x0 + 14, bankCardY + bankCardH - 23, 8, "F2", gold);
    c.text("Please use these details when settling this invoice.", x0 + 14, bankCardY + bankCardH - 38, 8, "F1", sub);
    bankDetails.forEach(([label, value], index) => {
      const lineY = bankCardY + bankCardH - 56 - index * 14;
      c.text(`${label}:`, x0 + 14, lineY, 8.3, "F2", forest);
      c.text(value, x0 + 106, lineY, 8.3, "F1", ink);
    });
  }

  // ---- footer ----
  c.roundedRect(x0, footerBottom, contentW, footerH, 10, cream, hair);
  c.rect(x0, footerTop - 5, contentW, 5, lime);
  c.leafCluster(x0 - 6, footerBottom + 6, 55, forest, lime);
  c.text("Thank you for shopping with us!", x0 + 30, footerTop - 27, 13, "F3", forest);

  const noteLines = wrapText(
    "This invoice confirms the order placed on our website. Keep it for your records.",
    contentW - 210, 8.5, "F1"
  );
  noteLines.slice(0, 2).forEach((text, index) => {
    c.text(text, x0 + 30, footerTop - 44 - index * 12, 8.5, "F1", sub);
  });
  c.text(`${company.address} | ${company.phone} | ${company.email}`, x0 + 30, footerBottom + 15, 8, "F1", sub);

  const fbX = x1 - 156;
  const ttX = x1 - 66;
  const iconSize = 14;
  const iconY = footerBottom + 13;
  c.roundedRect(fbX - 18, iconY, iconSize, iconSize, iconSize / 2, forest);
  c.text("f", fbX - 14, iconY + 3.5, 9, "F2", white);
  c.text("facebook", fbX, footerBottom + 16, 8.5, "F2", gold);
  c.roundedRect(ttX - 18, iconY, iconSize, iconSize, iconSize / 2, forest);
  c.text("i", ttX - 14, iconY + 3.5, 9, "F2", white);
  c.text("instagram", ttX, footerBottom + 16, 8.5, "F2", gold);

  // ---- assemble PDF ----
  const content = c.commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >>${logo ? " /XObject << /Logo 8 0 R >>" : ""} >> /Contents 7 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`
  ];
  if (logo) {
    objects.push({
      header: `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${logo.data.length} >>\nstream\n`,
      stream: logo.data,
      footer: "\nendstream"
    });
  }
  const chunks = [];
  let pdfLength = 0;
  const push = (value) => {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value, "binary");
    chunks.push(chunk);
    pdfLength += chunk.length;
  };
  push("%PDF-1.4\n");
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdfLength);
    push(`${index + 1} 0 obj\n`);
    if (typeof object === "string") {
      push(object);
    } else {
      push(object.header);
      push(object.stream);
      push(object.footer);
    }
    push("\nendobj\n");
  });
  const xref = pdfLength;
  push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  offsets.slice(1).forEach((offset) => {
    push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  });
  push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return {
    name: `${invoiceNumber}.pdf`,
    content: Buffer.concat(chunks).toString("base64")
  };
};

const itemsHtml = (order = {}) => (order.items || []).map((item) => `
  <tr>
    <td style="padding:10px;border-bottom:1px solid #e8e2d7;"><strong>${item.name}</strong><br><span style="color:#6d756c;font-size:12px;">${item.unit} x ${item.quantity}</span></td>
    <td style="padding:10px;border-bottom:1px solid #e8e2d7;text-align:right;">${money((Number(item.price) || 0) * (Number(item.quantity) || 0))}</td>
  </tr>
`).join("");

const baseTemplate = ({ title, intro, order }) => `
  <div style="margin:0;background:#f7f1e8;padding:28px 14px;font-family:Arial,sans-serif;color:#17372c;">
    <div style="max-width:640px;margin:auto;background:#fff;border-radius:28px;overflow:hidden;border:1px solid #e8e2d7;">
      <div style="background:#17372c;padding:28px;color:#fff;">
        <img src="https://www.gticomputers.lk/assets/logo.png" alt="GTI COMPUTERS" style="height:54px;width:auto;margin-bottom:18px;">
        <h1 style="margin:0;font-size:28px;line-height:1.1;">${title}</h1>
        <p style="margin:12px 0 0;color:#d7dfcf;line-height:1.6;">${intro}</p>
      </div>
      <div style="padding:26px;">
        <p style="margin:0 0 16px;color:#6d756c;">Order No :  <strong style="color:#17372c;">#${orderNumber(order)}</strong></p>
        <table style="width:100%;border-collapse:collapse;margin:0 0 18px;">
          ${itemsHtml(order)}
        </table>
        <div style="background:#f7f1e8;border-radius:18px;padding:16px;">
          <p style="display:flex;justify-content:space-between;margin:0 0 8px;"><span>Subtotal : </span><strong>${money(order.subtotal)}.00</strong></p>
          ${Number(order.discountAmount) > 0 ? `<p style="display:flex;justify-content:space-between;margin:0 0 8px;color:#3f6b4f;"><span>Discount : </span><strong>-${money(order.discountAmount)}.00</strong></p>` : ""}
          <p style="display:flex;justify-content:space-between;margin:0 0 8px;"><span>Shipping : </span><strong>${Number(order.shippingFee) ? money(order.shippingFee) : "Free"}.00</strong></p>
          <p style="display:flex;justify-content:space-between;margin:12px 0 0;padding-top:12px;border-top:1px solid #e8e2d7;font-size:18px;"><span>Total : </span><strong>${money(order.total)}.00</strong></p>
        </div>
        ${order.status === "shipped" && order.trackingNumber ? `
          <div style="margin-top:18px;border:1px solid #d8ed6c;background:#f4ffe5;border-radius:18px;padding:18px;">
            <p style="margin:0 0 8px;color:#17372c;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;">Courier tracking details</p>
            <p style="margin:0 0 12px;color:#6d756c;line-height:1.6;">
              Your tracking number is
              <strong style="display:inline-block;margin:0 4px;padding:6px 10px;border-radius:999px;background:#17372c;color:#d8ed6c;letter-spacing:0.05em;">${order.trackingNumber}</strong>
            </p>
            ${order.trackingUrl ? `<a href="${order.trackingUrl}" style="display:inline-block;background:#d8ed6c;color:#17372c;text-decoration:none;border-radius:999px;padding:11px 16px;font-size:13px;font-weight:800;">Track your parcel</a>` : ""}
          </div>
        ` : ""}
        <p style="margin:18px 0 0;color:#6d756c;line-height:1.6;">Thank you for shopping with GTI COMPUTERS.</p>
      </div>
    </div>
  </div>
`;

export const sendBrevoEmail = async ({ to, subject, htmlContent, attachment }) => {
  if (!process.env.BREVO_API_KEY || !to) return;
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: to }],
      subject,
      htmlContent,
      ...(attachment ? { attachment: [attachment] } : {})
    })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Brevo email failed: ${response.status} ${text}`);
  }
};

export const sendOtpEmail = async ({ to, otp, purpose = "register" }) => {
  if (!process.env.BREVO_API_KEY) {
    throw new Error("Email OTP service is not configured");
  }
  const title = purpose === "password-reset" ? "Reset your password" : "Verify your email";
  const intro = purpose === "password-reset"
    ? "Use this OTP to reset your GTI COMPUTERS account password."
    : "Use this OTP to verify your email and finish creating your GTI COMPUTERS account.";
  await sendBrevoEmail({
    to,
    subject: `${otp} is your GTI COMPUTERS OTP`,
    htmlContent: `
      <div style="margin:0;background:#f7f1e8;padding:28px 14px;font-family:Arial,sans-serif;color:#17372c;">
        <div style="max-width:560px;margin:auto;background:#fff;border-radius:28px;overflow:hidden;border:1px solid #e8e2d7;">
          <div style="background:#17372c;padding:28px;color:#fff;">
            <img src="https://www.gticomputers.lk/assets/logo.png" alt="GTI COMPUTERS" style="height:54px;width:auto;margin-bottom:18px;">
            <h1 style="margin:0;font-size:28px;line-height:1.1;">${title}</h1>
            <p style="margin:12px 0 0;color:#d7dfcf;line-height:1.6;">${intro}</p>
          </div>
          <div style="padding:28px;text-align:center;">
            <p style="margin:0 0 14px;color:#6d756c;">Your one-time password is</p>
            <div style="display:inline-block;border:1px solid #d8ed6c;background:#f4ffe5;border-radius:18px;padding:16px 24px;font-size:34px;font-weight:900;letter-spacing:0.22em;color:#17372c;">${otp}</div>
            <p style="margin:18px 0 0;color:#6d756c;line-height:1.6;font-size:13px;">This OTP expires in 10 minutes. If you did not request this, you can ignore this email.</p>
          </div>
        </div>
      </div>
    `
  });
};

export const sendOrderEmail = async (order, kind) => {
  if (!hasCustomerEmail(order)) return;
  const email = order.shippingAddress.email;
  const templates = {
    pending: {
      subject: `Order #${orderNumber(order)} received - payment verification pending`,
      title: "Your order is pending verification",
      intro: "We received your order and payment slip. We will check the receipt and confirm your order soon."
    },
    confirmed: {
      subject: `Order #${orderNumber(order)} confirmed`,
      title: "Your order is confirmed",
      intro: "Your GTI COMPUTERS order is confirmed. We will prepare it carefully for courier delivery."
    },
    processing: {
      subject: `Order #${orderNumber(order)} is being prepared`,
      title: "Your order is being prepared",
      intro: "Your order is now being packed with care."
    },
    shipped: {
      subject: `Order #${orderNumber(order)} has been shipped`,
      title: "Your order is on the way",
      intro: order.trackingNumber
        ? "Your order has been handed over for courier delivery. Your courier tracking details are below."
        : "Your order has been handed over for courier delivery."
    },
    delivered: {
      subject: `Order #${orderNumber(order)} delivered`,
      title: "Your order has been delivered",
      intro: "We hope you enjoy your GTI COMPUTERS order."
    },
    cancelled: {
      subject: `Order #${orderNumber(order)} cancelled`,
      title: "Your order was cancelled",
      intro: "This order has been cancelled. Please contact us if you need any help."
    }
  };
  const template = templates[kind];
  if (!template) return;
  try {
    await sendBrevoEmail({
      to: email,
      subject: template.subject,
      htmlContent: baseTemplate({ title: template.title, intro: template.intro, order }),
      attachment: kind === "confirmed" ? buildConfirmedInvoiceAttachment(order) : undefined
    });
  } catch (error) {
    console.error(error.message);
  }
};
