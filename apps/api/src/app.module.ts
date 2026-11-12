import { Global, Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerModule } from "@nestjs/throttler";
import { JwtAuthGuard, MedcoreThrottlerGuard, PermissionsGuard } from "./common/guards";
import { AllExceptionsFilter, ResponseEnvelopeInterceptor } from "./common/http";
import { PrismaModule } from "./prisma/prisma.service";
import { AuditController } from "./modules/audit/audit.controller";
import { AuditService } from "./modules/audit/audit.service";
import { AuthModule } from "./modules/auth/auth.module";
import { DirectoryModule } from "./modules/directory/directory.controller";
import { HealthModule } from "./modules/health/health.controller";
import { HospitalsModule } from "./modules/hospitals/hospitals.controller";
import { MailModule } from "./modules/mail/mail.service";
import { PatientsModule } from "./modules/patients/patients.controller";
import { StaffModule } from "./modules/staff/staff.controller";
import { UsersModule } from "./modules/users/users.controller";
import { ScheduleModule } from "@nestjs/schedule";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { AppointmentsModule } from "./modules/appointments/appointments.module";
import { BillingModule } from "./modules/billing/billing.module";
import { LabModule } from "./modules/lab/lab.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { PharmacyModule } from "./modules/pharmacy/pharmacy.module";
import { RecordsModule } from "./modules/records/records.module";
import { WardsModule } from "./modules/wards/wards.module";

/** Audit logging is available to every module. */
@Global()
@Module({ controllers: [AuditController], providers: [AuditService], exports: [AuditService] })
class AuditModule {}

@Module({
  imports: [
    // Secrets are passed per call (see TokenService / JwtAuthGuard).
    JwtModule.register({ global: true }),
    // Default: 600 requests/min per IP (a whole hospital may share one IP).
    // Credential and OTP routes are limited per IP + email (see auth.controller).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 600 }]),
    PrismaModule,
    MailModule,
    AuditModule,
    HealthModule,
    AuthModule,
    UsersModule,
    HospitalsModule,
    DirectoryModule,
    PatientsModule,
    StaffModule,
    ScheduleModule.forRoot(),
    NotificationsModule,
    AppointmentsModule,
    RecordsModule,
    PharmacyModule,
    LabModule,
    BillingModule,
    WardsModule,
    AnalyticsModule,
  ],
  providers: [
    // Order matters: rate limit → authenticate → authorize.
    { provide: APP_GUARD, useClass: MedcoreThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
