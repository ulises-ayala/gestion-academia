import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { StudentsModule } from './students/students.module';
import { AuthModule } from './auth/auth.module';

@Module({ imports: [AuthModule, HealthModule, StudentsModule] })
export class AppModule {}
