import type { OperationalReportsDto, PaymentMethodDto } from '@academy/contracts';
import PDFDocument from 'pdfkit';

/** Cantidad de deudores que entran en el PDF; la lista completa sale por CSV. */
export const PDF_DEBTOR_LIMIT = 20;

const METHOD_LABELS: Readonly<Record<PaymentMethodDto, string>> = {
  CASH: 'Efectivo',
  MERCADO_PAGO: 'Mercado Pago',
  CARD: 'Tarjeta',
};
const COLORS = {
  accent: '#7d1d35',
  text: '#1c1917',
  secondary: '#44403c',
  muted: '#6f6a64',
  border: '#ddd9d4',
  soft: '#f8f5f3',
} as const;
const FONT = { regular: 'Helvetica', bold: 'Helvetica-Bold', italic: 'Helvetica-Oblique' } as const;

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
export const formatMoney = (value: string) => money.format(Number(value));
export const formatDate = (value: string) => value.slice(0, 10).split('-').reverse().join('/');
const formatDateTime = (value: string, timezone: string) =>
  new Intl.DateTimeFormat('es-AR', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
export const formatDateInZone = (value: string, timezone: string) =>
  new Intl.DateTimeFormat('es-AR', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
const percent = (part: string, total: string) =>
  Number(total) > 0 ? `${Math.round((Number(part) / Number(total)) * 100)} %` : '—';

export const reportPdfFileName = (from: string, to: string) => `reporte-carmesi-${from}_${to}.pdf`;

type Column = Readonly<{ header: string; width: number; align?: 'left' | 'right' }>;
type Cell = string | number;
export type ReportPdfOptions = Readonly<{
  timezone: string;
  debtSort: 'highest' | 'oldest';
  classFiltered: boolean;
}>;

export function renderOperationalReportPdf(
  report: OperationalReportsDto,
  options: ReportPdfOptions,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 52, bottom: 60, left: 48, right: 48 },
    bufferPages: true,
    info: { Title: 'Reporte operativo · Carmesí', Author: 'Carmesí', Subject: 'Reporte operativo' },
  });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const left = doc.page.margins.left;
  const contentWidth = () => doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bottomLimit = () => doc.page.height - doc.page.margins.bottom;
  const ensureSpace = (height: number) => {
    if (doc.y + height > bottomLimit()) doc.addPage();
  };
  const period = `${formatDate(report.from)} — ${formatDate(report.to)}`;

  // Encabezado del documento.
  doc.font(FONT.bold).fontSize(18).fillColor(COLORS.accent).text('Carmesí', left, doc.y);
  doc
    .font(FONT.regular)
    .fontSize(7)
    .fillColor(COLORS.muted)
    .text('ACADEMIA DE DANZA', { characterSpacing: 2 });
  doc.moveDown(1.2);
  doc.font(FONT.bold).fontSize(20).fillColor(COLORS.text).text('Reporte operativo');
  doc.moveDown(0.2);
  doc.font(FONT.regular).fontSize(10).fillColor(COLORS.secondary).text(`Período: ${period}`);
  doc
    .fontSize(8.5)
    .fillColor(COLORS.muted)
    .text(`Generado el ${formatDateTime(report.generatedAt, options.timezone)} (hora local)`);
  doc.moveDown(0.8);
  doc
    .moveTo(left, doc.y)
    .lineTo(left + contentWidth(), doc.y)
    .lineWidth(1.5)
    .strokeColor(COLORS.accent)
    .stroke();
  doc.moveDown(0.6);

  const section = (eyebrow: string, title: string) => {
    ensureSpace(90);
    doc.moveDown(0.8);
    doc
      .font(FONT.bold)
      .fontSize(7.5)
      .fillColor(COLORS.accent)
      .text(eyebrow.toUpperCase(), left, doc.y, { characterSpacing: 1 });
    doc.moveDown(0.15);
    doc.font(FONT.bold).fontSize(14).fillColor(COLORS.text).text(title, left);
    doc.moveDown(0.5);
  };

  const subheading = (title: string) => {
    ensureSpace(60);
    doc.moveDown(0.5);
    doc.font(FONT.bold).fontSize(10.5).fillColor(COLORS.text).text(title, left);
    doc.moveDown(0.35);
  };

  const note = (text: string) => {
    ensureSpace(24);
    doc
      .font(FONT.italic)
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(text, left, doc.y, { width: contentWidth() });
    doc.moveDown(0.4);
  };

  const paragraph = (text: string) => {
    ensureSpace(20);
    doc
      .font(FONT.regular)
      .fontSize(9.5)
      .fillColor(COLORS.secondary)
      .text(text, left, doc.y, { width: contentWidth() });
    doc.moveDown(0.4);
  };

  const metrics = (items: readonly (readonly [string, Cell])[], columns = 3) => {
    const gap = 8;
    const boxWidth = (contentWidth() - gap * (columns - 1)) / columns;
    const boxHeight = 44;
    for (let index = 0; index < items.length; index += columns) {
      ensureSpace(boxHeight + gap);
      const top = doc.y;
      items.slice(index, index + columns).forEach(([label, value], column) => {
        const x = left + column * (boxWidth + gap);
        doc
          .roundedRect(x, top, boxWidth, boxHeight, 4)
          .lineWidth(0.75)
          .fillAndStroke(COLORS.soft, COLORS.border);
        doc
          .font(FONT.regular)
          .fontSize(7.5)
          .fillColor(COLORS.muted)
          .text(label, x + 10, top + 8, { width: boxWidth - 20, lineBreak: false, ellipsis: true });
        doc
          .font(FONT.bold)
          .fontSize(12.5)
          .fillColor(COLORS.text)
          .text(String(value), x + 10, top + 21, {
            width: boxWidth - 20,
            lineBreak: false,
            ellipsis: true,
          });
      });
      doc.x = left;
      doc.y = top + boxHeight + gap;
    }
  };

  const table = (columns: readonly Column[], rows: readonly (readonly Cell[])[]) => {
    const totalWidth = contentWidth();
    const widths = columns.map((column) => column.width * totalWidth);
    const padX = 5;
    const padY = 5;
    const drawRow = (cells: readonly Cell[], header: boolean) => {
      doc.font(header ? FONT.bold : FONT.regular).fontSize(header ? 7.5 : 8.5);
      const heights = cells.map((cell, index) =>
        doc.heightOfString(String(cell), { width: widths[index]! - padX * 2 }),
      );
      const rowHeight = Math.max(...heights) + padY * 2;
      if (doc.y + rowHeight > bottomLimit()) {
        doc.addPage();
        if (!header)
          drawRow(
            columns.map((column) => column.header),
            true,
          );
      }
      const top = doc.y;
      if (header) doc.rect(left, top, totalWidth, rowHeight).fill(COLORS.soft);
      let x = left;
      cells.forEach((cell, index) => {
        doc
          .font(header ? FONT.bold : FONT.regular)
          .fontSize(header ? 7.5 : 8.5)
          .fillColor(header ? COLORS.muted : COLORS.text)
          .text(String(cell), x + padX, top + padY, {
            width: widths[index]! - padX * 2,
            align: columns[index]!.align ?? 'left',
          });
        x += widths[index]!;
      });
      doc
        .moveTo(left, top + rowHeight)
        .lineTo(left + totalWidth, top + rowHeight)
        .lineWidth(0.5)
        .strokeColor(COLORS.border)
        .stroke();
      doc.x = left;
      doc.y = top + rowHeight;
    };
    ensureSpace(48);
    drawRow(
      columns.map((column) => column.header),
      true,
    );
    rows.forEach((row) => drawRow(row, false));
    doc.moveDown(0.6);
  };

  // 1. Resumen
  const summary = report.summary;
  section('Resumen', 'Indicadores principales');
  metrics([
    ['Alumnos activos', summary.activeStudents],
    ['Alumnos inactivos', summary.inactiveStudents],
    ['Altas del período', summary.newStudents],
    ['Deuda pendiente actual', formatMoney(summary.pendingDebt)],
    ['Cuotas vencidas actuales', summary.overdueCharges],
    ['Cobrado en el período', formatMoney(summary.collectedAmount)],
    ['Pagos confirmados', summary.confirmedPayments],
    ['Cierres de caja', summary.closedCashShifts],
    ['Diferencia de caja corregida', formatMoney(summary.cashDifference)],
  ]);
  note(
    'Deuda, vencidas y estado de alumnos son una fotografía actual. Cobros, altas y cierres corresponden al período elegido.',
  );

  // 2. Cobros
  const collections = report.collections;
  section('Flujo del período', 'Cobros registrados');
  metrics([
    ['Total cobrado', formatMoney(collections.total)],
    ['Pagos confirmados', collections.count],
    ...collections.byMethod.map(
      (item) => [METHOD_LABELS[item.method], formatMoney(item.amount)] as const,
    ),
  ]);
  metrics([
    ['Cuotas', formatMoney(collections.byConcept.charges)],
    ['Clases sueltas', formatMoney(collections.byConcept.singleClass)],
    ['Otros cobros', formatMoney(collections.byConcept.other)],
  ]);
  if (collections.byTeacher.length > 0) {
    subheading('Ingresos por profesor');
    table(
      [
        { header: 'Profesor', width: 0.3 },
        { header: 'Cuotas', width: 0.18, align: 'right' },
        { header: 'Deuda anterior', width: 0.18, align: 'right' },
        { header: 'Clases sueltas', width: 0.16, align: 'right' },
        { header: 'Total', width: 0.18, align: 'right' },
      ],
      collections.byTeacher.map((item) => [
        item.teacherName,
        formatMoney(item.charges),
        formatMoney(item.historicalDebt),
        formatMoney(item.singleClass),
        formatMoney(item.total),
      ]),
    );
  }
  if (collections.singleClasses.length > 0) {
    subheading('Clases sueltas por profesor');
    table(
      [
        { header: 'Profesor', width: 0.32 },
        { header: 'Clase', width: 0.36 },
        { header: 'Clases', width: 0.12, align: 'right' },
        { header: 'Monto', width: 0.2, align: 'right' },
      ],
      collections.singleClasses.map((item) => [
        item.teacherName,
        item.className,
        item.count,
        formatMoney(item.amount),
      ]),
    );
  }
  const paidDays = collections.byDay.filter((item) => Number(item.amount) > 0);
  if (paidDays.length === 0) paragraph('No hubo cobros en este período.');
  else {
    subheading('Cobros por día');
    table(
      [
        { header: 'Fecha', width: 0.4 },
        { header: 'Monto', width: 0.35, align: 'right' },
        { header: '% del total', width: 0.25, align: 'right' },
      ],
      paidDays.map((item) => [
        formatDate(item.date),
        formatMoney(item.amount),
        percent(item.amount, collections.total),
      ]),
    );
  }

  // 3. Deudores
  const debtors = report.debtors;
  section('Situación actual', 'Deudores');
  if (debtors.items.length === 0) paragraph('No hay cuotas pendientes.');
  else {
    const shown = debtors.items.slice(0, PDF_DEBTOR_LIMIT);
    table(
      [
        { header: 'Alumno', width: 0.27 },
        { header: 'DNI', width: 0.13 },
        { header: 'Cuotas abiertas', width: 0.1, align: 'right' },
        { header: 'Vencidas', width: 0.1, align: 'right' },
        { header: 'Deuda', width: 0.14, align: 'right' },
        { header: 'Deuda vencida', width: 0.14, align: 'right' },
        { header: 'Más antigua', width: 0.12, align: 'right' },
      ],
      shown.map((item) => [
        `${item.lastName}, ${item.firstName}`,
        item.dni,
        item.openCharges,
        item.overdueCharges,
        formatMoney(item.totalDebt),
        formatMoney(item.overdueDebt),
        formatDate(item.oldestDueDate),
      ]),
    );
    const order = options.debtSort === 'oldest' ? 'deuda más antigua' : 'mayor deuda';
    note(
      debtors.total > shown.length
        ? `Se muestran ${shown.length} de ${debtors.total} alumnos con deuda, ordenados por ${order}. La lista completa está en "Exportar deudores CSV".`
        : `${debtors.total} ${debtors.total === 1 ? 'alumno' : 'alumnos'} con deuda, ordenados por ${order}. Los valores reflejan la situación actual, no una deuda histórica del período.`,
    );
  }

  // 4. Asistencia
  const attendance = report.attendance;
  section('Registros reales', 'Asistencia');
  metrics(
    [
      ['Total registros', attendance.records],
      ['Presentes', attendance.present],
      ['Ausentes', attendance.absent],
      ['Justificados', attendance.justified],
    ],
    4,
  );
  if (attendance.records === 0) paragraph('No hay registros de asistencia en este período.');
  else
    table(
      [
        { header: 'Clase', width: 0.3 },
        { header: 'Profesor actual', width: 0.26 },
        { header: 'Registros', width: 0.11, align: 'right' },
        { header: 'Presentes', width: 0.11, align: 'right' },
        { header: 'Ausentes', width: 0.11, align: 'right' },
        { header: 'Justificados', width: 0.11, align: 'right' },
      ],
      attendance.byClass.map((item) => [
        item.className,
        item.teacherName,
        item.records,
        item.present,
        item.absent,
        item.justified,
      ]),
    );
  note(
    `${options.classFiltered ? 'Filtrado por la clase elegida en Reportes. ' : ''}Sólo se cuentan asistencias registradas; no se estiman sesiones ni concurrencia esperada.`,
  );

  // 5. Caja
  const cash = report.cash;
  section('Cierres del período', 'Caja');
  paragraph(
    `${cash.closedShifts} ${cash.closedShifts === 1 ? 'turno cerrado' : 'turnos cerrados'} · ${cash.openShifts} ${cash.openShifts === 1 ? 'abierto' : 'abiertos'} actualmente.`,
  );
  if (cash.closedShifts > 0) {
    subheading('Por medio de pago');
    table(
      [
        { header: 'Medio', width: 0.19 },
        { header: 'Esperado', width: 0.135, align: 'right' },
        { header: 'Declarado', width: 0.135, align: 'right' },
        { header: 'Diferencia', width: 0.135, align: 'right' },
        { header: 'Declarado corregido', width: 0.2, align: 'right' },
        { header: 'Diferencia corregida', width: 0.205, align: 'right' },
      ],
      cash.byMethod.map((item) => [
        METHOD_LABELS[item.method],
        formatMoney(item.expected),
        formatMoney(item.declared),
        formatMoney(item.difference),
        formatMoney(item.correctedDeclared),
        formatMoney(item.correctedDifference),
      ]),
    );
  }
  if (cash.byOperator.length > 0) {
    subheading('Por operador');
    table(
      [
        { header: 'Operador', width: 0.24 },
        { header: 'Turnos', width: 0.1, align: 'right' },
        { header: 'Esperado', width: 0.16, align: 'right' },
        { header: 'Declarado', width: 0.16, align: 'right' },
        { header: 'Diferencia', width: 0.16, align: 'right' },
        { header: 'Dif. corregida', width: 0.18, align: 'right' },
      ],
      cash.byOperator.map((item) => [
        item.username,
        item.shifts,
        formatMoney(item.expected),
        formatMoney(item.declared),
        formatMoney(item.difference),
        formatMoney(item.correctedDifference),
      ]),
    );
  }
  subheading('Cierres con diferencia');
  if (cash.differences.length === 0) paragraph('No hay cierres con diferencias.');
  else
    table(
      [
        { header: 'Fecha de cierre', width: 0.25 },
        { header: 'Operador', width: 0.29 },
        { header: 'Diferencia original', width: 0.23, align: 'right' },
        { header: 'Diferencia corregida', width: 0.23, align: 'right' },
      ],
      cash.differences.map((item) => [
        formatDateInZone(item.closedAt, options.timezone),
        item.username,
        formatMoney(item.difference),
        formatMoney(item.correctedDifference),
      ]),
    );

  // Pie de página en todas las hojas.
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const y = doc.page.height - 36;
    const width = contentWidth();
    doc
      .moveTo(left, y - 8)
      .lineTo(left + width, y - 8)
      .lineWidth(0.5)
      .strokeColor(COLORS.border)
      .stroke();
    doc
      .font(FONT.regular)
      .fontSize(7.5)
      .fillColor(COLORS.muted)
      .text(`Carmesí · Reporte operativo · ${period}`, left, y, { width, lineBreak: false });
    doc.text(`Página ${index - range.start + 1} de ${range.count}`, left, y, {
      width,
      align: 'right',
      lineBreak: false,
    });
    doc.page.margins.bottom = bottomMargin;
  }

  doc.end();
  return done;
}
