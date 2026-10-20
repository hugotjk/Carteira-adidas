import * as XLSX from "xlsx-js-style";
import { Order } from "../types";

/**
 * Monta o arquivo Excel da tela "Liberar & Cancelar" com as linhas originais
 * da planilha (colunas A até BC), mantendo a formatação usada na importação.
 */
export function buildReleaseWorkbook(selectedOrders: Order[]): Blob {
  const rowsToExport = selectedOrders.map(o => {
    const row = { ...(o.originalRow || o) };
    // Process all values to convert numeric strings to actual numbers
    Object.keys(row).forEach(key => {
      const val = row[key];
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed === '') return;

        // 1. Brazilian format: "1.234,56" or "123,45"
        if (/^-?[\d.]+,[\d]+$/.test(trimmed)) {
          const num = parseFloat(trimmed.replace(/\./g, '').replace(',', '.'));
          if (!isNaN(num)) row[key] = num;
        }
        // 2. Standard numeric or integer: "1234" or "1234.56"
        else if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
          // Avoid converting codes with leading zeros (e.g. "00123")
          const isCode = trimmed.length > 1 && trimmed.startsWith('0') && !trimmed.startsWith('0.');
          if (!isCode) {
            const num = parseFloat(trimmed);
            if (!isNaN(num)) row[key] = num;
          }
        }
      }
    });
    return row;
  });
  
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rowsToExport);
  
  // High-precision column configurations for A to BC (columns 1 to 55)
  const colConfigs = [
    // A (0)
    { wch: 10.29, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // B (1)
    { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // C (2)
    { wch: 7, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // D (3)
    { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // E (4)
    { wch: 4.57, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // F (5)
    { wch: 22.86, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // G (6)
    { wch: 10.29, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // H (7)
    { wch: 31.29, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // I (8)
    { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // J (9)
    { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // K (10)
    { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // L (11)
    { wch: 20.86, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // M (12)
    { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // N (13)
    { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // O (14)
    { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // P (15)
    { wch: 9.71, format: "dd/mm/yyyy", align: "center", headerColor: "000000", headerTextColor: "FFFFFF" },
    // Q (16)
    { wch: 9.71, format: "dd/mm/yyyy", align: "center", headerColor: "000000", headerTextColor: "FFFFFF" },
    // R (17)
    { wch: 9.71, format: "dd/mm/yyyy", align: "center", headerColor: "000000", headerTextColor: "FFFFFF" },
    // S (18)
    { wch: 10.29, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // T (19)
    { wch: 9.71, format: "dd/mm/yyyy", align: "center", headerColor: "000000", headerTextColor: "FFFFFF" },
    // U (20)
    { wch: 10.86, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // V (21)
    { wch: 9.71, format: "dd/mm/yyyy", align: "center", headerColor: "000000", headerTextColor: "FFFFFF" },
    // W (22)
    { wch: 7.57, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // X (23)
    { wch: 23.43, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // Y (24)
    { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // Z (25)
    { wch: 15.43, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // AA (26)
    { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // AB (27)
    { wch: 13.86, format: "General", align: "center", headerColor: "000000", headerTextColor: "FFFFFF" },
    // AC (28)
    { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // AD (29)
    { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // AE (30)
    { wch: 10.29, format: '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)', align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // AF (31)
    { wch: 7.29, format: '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)', align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // AG (32)
    { wch: 4, format: "General", align: "left", headerColor: "90EE90", headerTextColor: "000000" }, // Verde-claro
    // AH (33)
    { wch: 10.29, format: "General", align: "left", headerColor: "90EE90", headerTextColor: "000000" }, // Verde-claro
    // AI (34)
    { wch: 9.71, format: "General", align: "left", headerColor: "90EE90", headerTextColor: "000000" }, // Verde-claro
    // AJ (35)
    { wch: 7.43, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // AK (36)
    { wch: 7.43, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // AL (37)
    { wch: 7.43, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // AM (38)
    { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // AN (39)
    { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // AO (40)
    { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // AP (41)
    { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // AQ (42)
    { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // AR (43)
    { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // AS (44)
    { wch: 0.25, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // AT (45)
    { wch: 11, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // AU (46)
    { wch: 27.14, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // AV (47)
    { wch: 16.29, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // AW (48)
    { wch: 10.57, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // AX (49)
    { wch: 6.86, format: "General", align: "center", headerColor: "000000", headerTextColor: "FFFFFF" },
    // AY (50)
    { wch: 6.86, format: "General", align: "center", headerColor: "000000", headerTextColor: "FFFFFF" },
    // AZ (51)
    { wch: 9, format: "General", align: "center", headerColor: "000000", headerTextColor: "FFFFFF" },
    // BA (52)
    { wch: 9, format: "General", align: "center", headerColor: "000000", headerTextColor: "FFFFFF" },
    // BB (53)
    { wch: 12.71, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" },
    // BC (54)
    { wch: 7.86, format: "General", align: "left", headerColor: "000000", headerTextColor: "FFFFFF" }
  ];

  // Set column widths
  ws['!cols'] = colConfigs.map(c => ({ wch: c.wch }));

  // Define all-border style (black thin borders)
  const borderStyle = {
    top: { style: "thin", color: { rgb: "000000" } },
    bottom: { style: "thin", color: { rgb: "000000" } },
    left: { style: "thin", color: { rgb: "000000" } },
    right: { style: "thin", color: { rgb: "000000" } }
  };

  let maxRow = 0;
  if (ws['!ref']) {
    const range = XLSX.utils.decode_range(ws['!ref']);
    maxRow = range.e.r;
  }

  // Traverse all rows and columns from A (0) to BC (54)
  for (let r = 0; r <= maxRow; r++) {
    for (let c = 0; c <= 54; c++) {
      const cellId = XLSX.utils.encode_cell({ r, c });
      let cell = ws[cellId];
      
      // If cell is empty/not present, create it so we can style/border it
      if (!cell) {
        cell = { t: 's', v: '' };
        ws[cellId] = cell;
      }

      const colStyle = colConfigs[c];
      if (!colStyle) continue;

      const isHeader = r === 0;

      if (isHeader) {
        // First Row Header Style (custom fill pattern + Calibri size 10 font + alignment + borders)
        cell.s = {
          fill: {
            patternType: "solid",
            fgColor: { rgb: colStyle.headerColor }
          },
          font: {
            name: "Calibri",
            sz: 10,
            bold: true,
            color: { rgb: colStyle.headerTextColor }
          },
          alignment: {
            vertical: "center",
            horizontal: colStyle.align
          },
          border: borderStyle
        };
      } else {
        // Data Row Style (Sem cor background, font preta Calibri size 10, vertical alignment center + horizontal alignment + borders)
        cell.s = {
          font: {
            name: "Calibri",
            sz: 10,
            color: { rgb: "000000" }
          },
          alignment: {
            vertical: "center",
            horizontal: colStyle.align
          },
          border: borderStyle
        };

        // Format dates in Brazilian dd/mm/yyyy format (string value so Excel never flips it to American format based on regional OS locales)
        if (colStyle.format === "dd/mm/yyyy") {
          const val = cell.v;
          let dateStr = "";
          if (val instanceof Date) {
            const d = val.getDate().toString().padStart(2, '0');
            const m = (val.getMonth() + 1).toString().padStart(2, '0');
            const y = val.getFullYear();
            dateStr = `${d}/${m}/${y}`;
          } else if (val) {
            const trimmed = String(val).trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
              const parts = trimmed.split('-');
              dateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
            } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
              dateStr = trimmed;
            } else if (trimmed !== '') {
              const parsed = new Date(trimmed);
              if (parsed && !isNaN(parsed.getTime())) {
                const d = parsed.getDate().toString().padStart(2, '0');
                const m = (parsed.getMonth() + 1).toString().padStart(2, '0');
                const y = parsed.getFullYear();
                dateStr = `${d}/${m}/${y}`;
              } else {
                dateStr = trimmed;
              }
            }
          }
          if (dateStr) {
            cell.t = 's';
            cell.v = dateStr;
          }
        }
        // Financial R$ currency format or custom Accounting format
        else if (colStyle.format === "R$ #,##0.00" || colStyle.format.includes("#,##0.00")) {
          if (typeof cell.v === 'string') {
            const num = parseFloat(cell.v.replace(/[^\d.-]/g, ''));
            if (!isNaN(num)) {
              cell.t = 'n';
              cell.v = num;
            }
          }
          cell.z = colStyle.format;
        }
        // Other custom format
        else if (colStyle.format !== "General") {
          cell.z = colStyle.format;
        }
        // Default numeric logic for summability
        else if (cell.t === 'n') {
          const val = cell.v;
          if (typeof val === 'number') {
            if (Number.isInteger(val)) {
              cell.z = '0';
            } else {
              cell.z = '0.00';
            }
          }
        }
      }
    }
  }
  
  XLSX.utils.book_append_sheet(wb, ws, "Liberação");
  
  // Generate buffer
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** No celular abre o "Compartilhar"; no computador (ou se não der), baixa o arquivo. */
export async function shareOrDownload(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type });
  const isIframe = typeof window !== "undefined" && window.self !== window.top;

  if (!isIframe && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Exportação Liberação',
        text: 'Arquivo de liberação de pedidos'
      });
      return;
    } catch (error) {
      console.warn("Sharing not supported or permission denied, downloading file instead:", error);
    }
  }
  downloadFile(blob, filename);
}
