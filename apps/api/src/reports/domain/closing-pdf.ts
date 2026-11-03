import type { CollectionClosingDto, PaymentMethodDto } from '@academy/contracts';
import PDFDocument from 'pdfkit';
import { formatDate, formatMoney } from './report-pdf';

const METHOD_LABELS: Readonly<Record<PaymentMethodDto, string>> = {
  CASH: 'Efectivo',
  MERCADO_PAGO: 'Mercado Pago',
  TRANSFER: 'Transferencia',
  CARD: 'Tarjeta',
};
const COLORS = { accent: '#7d1d35', text: '#1f1b18', muted: '#6f6a64', border: '#ddd9d4' };

/** PDF de un cierre semanal o mensual: la foto guardada y, aparte, lo que cambió después. */
export function renderClosingPdf(closing: CollectionClosingDto, timezone: string): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, bottom: 56, left: 48, right: 48 },
    info: { Title: 'Cierre de recaudación · Carmesí', Author: 'Carmesí' },
  });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const bottom = () => doc.page.height - doc.page.margins.bottom;

  const heading = (text: string) => {
    if (doc.y + 40 > bottom()) doc.addPage();
    doc.moveDown(0.6).font('Helvetica-Bold').fontSize(12).fillColor(COLORS.accent);
    doc.text(text, left, doc.y, { width });
    doc.moveDown(0.3);
  };
  const table = (headers: readonly string[], rows: readonly (readonly string[])[], first = 0.3) => {
    const rest = (1 - first) / (headers.length - 1);
    const widths = headers.map((_, index) => width * (index === 0 ? first : rest));
    const draw = (cells: readonly string[], bold: boolean) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 8 : 9);
      const height =
        Math.max(
          ...cells.map((cell, index) => doc.heightOfString(cell, { width: widths[index]! - 8 })),
        ) + 8;
      if (doc.y + height > bottom()) doc.addPage();
      const top = doc.y;
      let x = left;
      cells.forEach((cell, index) => {
        doc.fillColor(bold ? COLORS.muted : COLORS.text).text(cell, x + 4, top + 4, {
          width: widths[index]! - 8,
          align: index === 0 ? 'left' : 'right',
        });
        x += widths[index]!;
      });
      doc
        .moveTo(left, top + height)
        .lineTo(left + width, top + height)
        .lineWidth(0.5)
        .strokeColor(COLORS.border)
        .stroke();
      doc.y = top + height;
    };
    draw(headers, true);
    rows.forEach((row, index) => draw(row, index === rows.length - 1 && row[0] === 'Total'));
    doc.x = left;
  };

  const kind = closing.kind === 'WEEKLY' ? 'Cierre semanal' : 'Cierre mensual';
  doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.accent).text(`${kind} · Carmesí`);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text(
      `Del ${formatDate(closing.fromDate)} al ${formatDate(closing.toDate)} · cerrado por ${closing.createdBy.username} el ${new Intl.DateTimeFormat(
        'es-AR',
        { timeZone: timezone, dateStyle: 'short', timeStyle: 'short' },
      ).format(new Date(closing.createdAt))}`,
    );

  const { snapshot } = closing;
  const methods = snapshot.collections.byMethod.map((item) => item.method);
  heading('Recaudación por concepto y medio');
  table(
    ['Concepto', ...methods.map((method) => METHOD_LABELS[method]), 'Total'],
    [
      ...snapshot.collections.byConceptAndMethod.map((row) => [
        row.label,
        ...row.byMethod.map((item) => formatMoney(item.amount)),
        formatMoney(row.total),
      ]),
      [
        'Total',
        ...snapshot.collections.byMethod.map((item) => formatMoney(item.amount)),
        formatMoney(snapshot.collections.total),
      ],
    ],
    0.28,
  );
  if (Number(snapshot.refunds.total) > 0) {
    heading('Devoluciones de saldo a favor');
    table(
      ['Medio', 'Devuelto'],
      snapshot.refunds.byMethod
        .filter((item) => Number(item.amount) > 0)
        .map((item) => [METHOD_LABELS[item.method], formatMoney(item.amount)]),
      0.5,
    );
  }
  if (snapshot.students) {
    const s = snapshot.students;
    heading('Alumnos y deuda al cierre');
    table(
      ['Indicador', 'Valor'],
      [
        ['Alumnos activos', String(s.active)],
        ['Nuevos ingresos del mes', String(s.newStudents)],
        ['Bajas del mes', String(s.dropped)],
        ['Cuotas pendientes', String(s.pendingCharges)],
        ['Monto adeudado', formatMoney(s.pendingDebt)],
        ['Cuotas vencidas', String(s.overdueCharges)],
        ['Monto vencido', formatMoney(s.overdueDebt)],
      ],
      0.6,
    );
  }
  heading('Correcciones posteriores al cierre');
  if (closing.changes.length === 0)
    doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor(COLORS.muted)
      .text('No hubo cambios en los importes después del cierre.', left, doc.y, { width });
  else
    table(
      ['Concepto', 'Medio', 'En el cierre', 'Hoy', 'Diferencia'],
      closing.changes.map((change) => [
        change.label,
        METHOD_LABELS[change.method],
        formatMoney(change.original),
        formatMoney(change.current),
        formatMoney(change.difference),
      ]),
      0.3,
    );
  doc.end();
  return done;
}
