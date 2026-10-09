import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthGuard } from './common/guards/auth.guard';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ChurchesModule } from './modules/churches/churches.module';
import { MembersModule } from './modules/members/members.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { SmallGroupsModule } from './modules/small-groups/small-groups.module';
import { EventsModule } from './modules/events/events.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { SermonsModule } from './modules/sermons/sermons.module';
import { FinanceModule } from './modules/finance/finance.module';
import { GivingModule } from './modules/giving/giving.module';
import { PrayerRequestsModule } from './modules/prayer-requests/prayer-requests.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { MessagesModule } from './modules/messages/messages.module';
import { VolunteersModule } from './modules/volunteers/volunteers.module';
import { ResourcesModule } from './modules/resources/resources.module';
import { VisitorsModule } from './modules/visitors/visitors.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ContactModule } from './modules/contact/contact.module';
import { AuditModule } from './modules/audit/audit.module';
import { CronModule } from './modules/cron/cron.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    SupabaseModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ChurchesModule,
    MembersModule,
    DepartmentsModule,
    SmallGroupsModule,
    EventsModule,
    AttendanceModule,
    SermonsModule,
    FinanceModule,
    GivingModule,
    PrayerRequestsModule,
    AnnouncementsModule,
    MessagesModule,
    VolunteersModule,
    ResourcesModule,
    VisitorsModule,
    ReportsModule,
    ContactModule,
    AuditModule,
    CronModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}