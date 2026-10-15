import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { Permissions } from '../../auth/presentation/permissions.decorator';
import { businessDayAt } from '../../dashboard/application/business-day';
import { DomainError } from '../../shared/domain/domain-error';
import { parsePage, parseStatus, parseUuid } from '../../shared/presentation/request-validation';
import { ReportsService } from '../application/reports.service';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (value: string) => {
  if (!datePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};
const reportKinds = ['students', 'collections', 'debtors', 'attendance', 'cash'] as const;

@Controller('reports')
@Permissions('reports:operational')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('operational')
  operational(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('studentStatus') studentStatus?: string,
    @Query('q') q?: string,
    @Query('classId') classId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('debtSort') debtSort?: string,
  ) {
    return this.service.operational(
      this.input(from, to, studentStatus, q, classId, page, pageSize, debtSort),
    );
  }

  @Get('export/:kind')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="reporte-carmesi.csv"')
  async export(
    @Param('kind') kindValue: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('studentStatus') studentStatus?: string,
    @Query('q') q?: string,
    @Query('classId') classId?: string,
    @Query('debtSort') debtSort?: string,
  ) {
    if (!reportKinds.includes(kindValue as (typeof reportKinds)[number]))
      throw new DomainError('VALIDATION_ERROR', 'El tipo de exportación no es válido', {
        field: 'kind',
      });
    const kind = kindValue as (typeof reportKinds)[number];
    return this.service.export(
      kind,
      this.input(from, to, studentStatus, q, classId, '1', '25', debtSort),
    );
  }

  private input(
    fromValue?: string,
    toValue?: string,
    studentStatus?: string,
    q?: string,
    classId?: string,
    page?: string,
    pageSize?: string,
    debtSort?: string,
  ) {
    const timezone = process.env.BUSINESS_TIMEZONE ?? 'America/Buenos_Aires';
    const today = businessDayAt(new Date(), timezone).date;
    const [year, month] = today.split('-');
    const from = fromValue || `${year}-${month}-01`;
    const to = toValue || today;
    if (!validDate(from) || !validDate(to) || from > to)
      throw new DomainError('VALIDATION_ERROR', 'El rango de fechas no es válido', {
        field: 'from',
      });
    const toNext = new Date(`${to}T12:00:00.000Z`);
    toNext.setUTCDate(toNext.getUTCDate() + 1);
    const parsedStatus = parseStatus(studentStatus);
    return {
      from: businessDayAt(new Date(`${from}T12:00:00.000Z`), timezone).start,
      toExclusive: businessDayAt(toNext, timezone).start,
      fromDate: from,
      toDate: to,
      ...(parsedStatus ? { studentStatus: parsedStatus } : {}),
      ...(q?.trim() ? { q: q.slice(0, 100) } : {}),
      ...(classId ? { classId: parseUuid(classId, 'classId') } : {}),
      page: parsePage(page, 'page', 1, Number.MAX_SAFE_INTEGER),
      pageSize: parsePage(pageSize, 'pageSize', 20, 100),
      debtSort: debtSort === 'oldest' ? ('oldest' as const) : ('highest' as const),
    };
  }
}
