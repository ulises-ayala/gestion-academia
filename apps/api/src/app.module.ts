import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { StudentsModule } from './students/students.module';
import { AuthModule } from './auth/auth.module';
import { TeachersModule } from './teachers/teachers.module';
import { OfferingModule } from './offering/offering.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';

@Module({
  imports: [
    AuthModule,
    HealthModule,
    EnrollmentsModule,
    StudentsModule,
    TeachersModule,
    OfferingModule,
  ],
})
export class AppModule {}
