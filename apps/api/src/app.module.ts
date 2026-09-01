import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { StudentsModule } from './students/students.module';
import { AuthModule } from './auth/auth.module';
import { TeachersModule } from './teachers/teachers.module';
import { OfferingModule } from './offering/offering.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { BillingModule } from './billing/billing.module';
import { UsersModule } from './users/users.module';
import { AttendancesModule } from './attendances/attendances.module';
import { AuditModule } from './audit/audit.module';
import { LeadsModule } from './leads/leads.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CashModule } from './cash/cash.module';

@Module({
  imports: [
    AuthModule,
    HealthModule,
    EnrollmentsModule,
    BillingModule,
    UsersModule,
    StudentsModule,
    TeachersModule,
    OfferingModule,
    AttendancesModule,
    AuditModule,
    LeadsModule,
    DashboardModule,
    CashModule,
  ],
})
export class AppModule {}
