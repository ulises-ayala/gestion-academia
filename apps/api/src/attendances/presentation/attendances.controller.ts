import type {
  AttendanceDto,
  AttendanceDayDto,
  AttendanceListDto,
  AttendanceQuickSearchDto,
  AttendanceRosterDto,
  CreateAttendanceDto,
  SaveAttendanceRosterDto,
  SaveAttendanceRosterResultDto,
  UpdateAttendanceDto,
} from '@academy/contracts';
import { Body, Controller, Get, Inject, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { Permissions } from '../../auth/presentation/permissions.decorator';
import { DomainError } from '../../shared/domain/domain-error';
import { parseUuid } from '../../shared/presentation/request-validation';
import { AttendancesService } from '../application/attendances.service';
import type { AttendanceData } from '../domain/attendance';
import { parseAttendanceDate } from '../domain/attendance';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import type { PublicAuthUser } from '../../auth/application/auth.repository';

const toDto = (attendance: AttendanceData): AttendanceDto => ({
  id: attendance.id,
  enrollmentId: attendance.enrollmentId,
  attendanceDate: attendance.attendanceDate.toISOString().slice(0, 10),
  status: attendance.status,
  notes: attendance.notes,
  createdAt: attendance.createdAt.toISOString(),
  updatedAt: attendance.updatedAt.toISOString(),
});

@Controller('attendances')
@Permissions('attendance:manage')
export class AttendancesController {
  constructor(@Inject(AttendancesService) private readonly service: AttendancesService) {}

  @Post()
  async create(@Body() input: CreateAttendanceDto): Promise<AttendanceDto> {
    return toDto(
      await this.service.create({
        ...input,
        enrollmentId: parseUuid(input.enrollmentId, 'enrollmentId'),
      }),
    );
  }

  @Get('roster')
  async roster(
    @Query('classId') classId: string,
    @Query('date') date: string,
  ): Promise<AttendanceRosterDto> {
    const attendanceDate = parseAttendanceDate(date, 'date');
    const items = await this.service.roster(parseUuid(classId, 'classId'), attendanceDate);
    return {
      classId,
      date,
      items: items.map((item) => ({
        enrollmentId: item.enrollmentId,
        student: item.student,
        attendance: item.attendance ? toDto(item.attendance) : null,
      })),
    };
  }

  @Put('roster')
  async saveRoster(@Body() input: SaveAttendanceRosterDto): Promise<SaveAttendanceRosterResultDto> {
    if (!Array.isArray(input.attendances))
      throw new DomainError('VALIDATION_ERROR', 'attendances debe ser una lista', {
        field: 'attendances',
      });
    const classId = parseUuid(input.classId, 'classId');
    const attendanceDate = parseAttendanceDate(input.date, 'date');
    const attendances = await this.service.saveRoster(
      {
        ...input,
        classId,
        attendances: input.attendances.map((item) => ({
          ...item,
          enrollmentId: parseUuid(item.enrollmentId, 'enrollmentId'),
        })),
      },
      attendanceDate,
    );
    return {
      classId,
      date: input.date,
      items: attendances.map(toDto),
    };
  }

  @Get('day')
  async day(@Query('date') date: string): Promise<AttendanceDayDto> {
    const attendanceDate = parseAttendanceDate(date, 'date');
    return { date, items: await this.service.dayClasses(attendanceDate) };
  }

  @Get('quick-search')
  async quickSearch(
    @Query('q') query: string,
    @Query('date') date: string,
    @Query('includeOtherDays') includeOtherDays?: string,
  ): Promise<AttendanceQuickSearchDto> {
    const attendanceDate = parseAttendanceDate(date, 'date');
    const normalizedQuery = query?.trim() ?? '';
    const items = await this.service.quickSearch(
      normalizedQuery,
      attendanceDate,
      includeOtherDays === 'true',
    );
    return {
      query: normalizedQuery,
      date,
      items: items.map((item) => ({
        student: item.student,
        enrollments: item.enrollments.map((enrollment) => ({
          ...enrollment,
          attendance: enrollment.attendance ? toDto(enrollment.attendance) : null,
        })),
      })),
    };
  }

  @Get()
  async list(
    @Query('classId') classId?: string,
    @Query('date') date?: string,
  ): Promise<AttendanceListDto> {
    const attendances = await this.service.list({
      ...(classId ? { classId: parseUuid(classId, 'classId') } : {}),
      ...(date ? { attendanceDate: parseAttendanceDate(date, 'date') } : {}),
    });
    return { items: attendances.map(toDto), total: attendances.length };
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<AttendanceDto> {
    return toDto(await this.service.findById(parseUuid(id)));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() input: UpdateAttendanceDto,
    @CurrentUser() user: PublicAuthUser,
  ): Promise<AttendanceDto> {
    return toDto(await this.service.update(parseUuid(id), input, user.id));
  }
}
