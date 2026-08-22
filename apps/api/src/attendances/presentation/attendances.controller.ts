import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import type {
  AttendanceDto,
  CreateAttendanceDto,
  UpdateAttendanceDto,
  AttendanceListDto,
} from '@academy/contracts';

import { AttendancesService } from '../application/attendances.service';

@Controller('attendances')
export class AttendancesController {
  constructor(
    private readonly attendancesService: AttendancesService,
  ) {}

  @Post()
  async create(
    @Body() input: CreateAttendanceDto,
  ): Promise<AttendanceDto> {
    const attendance =
      await this.attendancesService.create({
        enrollmentId: input.enrollmentId,
        attendanceDate: new Date(input.attendanceDate),
        status: input.status,
        notes: input.notes ?? null,
      });

    return {
      id: attendance.id,
      enrollmentId: attendance.enrollmentId,
      attendanceDate:
        attendance.attendanceDate.toISOString(),
      status: attendance.status,
      notes: attendance.notes,
      createdAt: attendance.createdAt.toISOString(),
      updatedAt: attendance.updatedAt.toISOString(),
    };
  }
@Get()
async list(
  @Query('classId') classId?: string,
  @Query('date') date?: string,
): Promise<AttendanceListDto> {
  const attendances =
    await this.attendancesService.list({
      ...(classId ? { classId } : {}),
      ...(date
        ? { attendanceDate: new Date(date) }
        : {}),
    });

  return {
    items: attendances.map((attendance) => ({
      id: attendance.id,
      enrollmentId: attendance.enrollmentId,
      attendanceDate:
        attendance.attendanceDate.toISOString(),
      status: attendance.status,
      notes: attendance.notes,
      createdAt: attendance.createdAt.toISOString(),
      updatedAt: attendance.updatedAt.toISOString(),
    })),
    total: attendances.length,
  };
}
  @Get(':id')
  async findById(
    @Param('id') id: string,
  ): Promise<AttendanceDto> {
    const attendance =
      await this.attendancesService.findById(id);

    return {
      id: attendance.id,
      enrollmentId: attendance.enrollmentId,
      attendanceDate:
        attendance.attendanceDate.toISOString(),
      status: attendance.status,
      notes: attendance.notes,
      createdAt: attendance.createdAt.toISOString(),
      updatedAt: attendance.updatedAt.toISOString(),
    };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() input: UpdateAttendanceDto,
  ): Promise<AttendanceDto> {
    const attendance =
      await this.attendancesService.update(id, input);

    return {
      id: attendance.id,
      enrollmentId: attendance.enrollmentId,
      attendanceDate:
        attendance.attendanceDate.toISOString(),
      status: attendance.status,
      notes: attendance.notes,
      createdAt: attendance.createdAt.toISOString(),
      updatedAt: attendance.updatedAt.toISOString(),
    };
  }
}