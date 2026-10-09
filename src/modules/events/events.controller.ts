import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ChurchAdmin } from '../../common/decorators/roles.decorator';
import { ChurchGuard } from '../../common/guards/church.guard';
import type { AuthUser } from '../../common/interfaces/auth-user.interface';
import { buildEventQrPayload, generateQrDataUrl } from '../../common/utils/qr';
import {
  CreateEventDto,
  MarkAttendanceDto,
  QueryEventsDto,
  RegisterEventDto,
  UpdateEventDto,
} from './event.dto';
import { EventsService } from './events.service';

@ApiTags('events')
@ApiBearerAuth('supabase-jwt')
@UseGuards(ChurchGuard)
@Controller('churches/:churchId/events')
export class ChurchEventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'List events for a church' })
  list(@Param('churchId') churchId: string, @Query() query: QueryEventsDto) {
    return this.eventsService.list(churchId, query);
  }

  @ChurchAdmin()
  @Post()
  @ApiOperation({ summary: 'Create an event' })
  create(
    @Param('churchId') churchId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateEventDto,
  ) {
    return this.eventsService.create(churchId, dto, user.id);
  }

  @ChurchAdmin()
  @Patch(':eventId')
  @ApiOperation({ summary: 'Update an event' })
  update(
    @Param('churchId') churchId: string,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventsService.update(churchId, eventId, dto);
  }

  @ChurchAdmin()
  @Delete(':eventId')
  @ApiOperation({ summary: 'Delete an event' })
  remove(@Param('churchId') churchId: string, @Param('eventId') eventId: string) {
    return this.eventsService.remove(churchId, eventId);
  }

  @ChurchAdmin()
  @Get(':eventId/registrations')
  @ApiOperation({ summary: 'List event registrations (admin)' })
  registrations(@Param('churchId') churchId: string, @Param('eventId') eventId: string) {
    return this.eventsService.listRegistrations(churchId, eventId);
  }

  @Get(':eventId/attendance')
  @ApiOperation({ summary: 'List event attendance' })
  attendance(@Param('eventId') eventId: string) {
    return this.eventsService.listAttendance(eventId);
  }

  @ChurchAdmin()
  @Post(':eventId/attendance')
  @ApiOperation({ summary: 'Mark attendance for an event (admin)' })
  markAttendance(
    @Param('churchId') churchId: string,
    @Param('eventId') eventId: string,
    @Body() dto: MarkAttendanceDto,
  ) {
    return this.eventsService.markAttendance(eventId, dto);
  }
}

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Public()
  @Get('upcoming')
  @ApiOperation({ summary: 'Upcoming public events across all churches' })
  upcoming(@Query('limit') limit?: string) {
    return this.eventsService.upcomingPublic(limit ? parseInt(limit, 10) : 10);
  }

  @Public()
  @Get(':eventId')
  @ApiOperation({ summary: 'Get an event' })
  getById(@Param('eventId') eventId: string) {
    return this.eventsService.getById(eventId);
  }

  @Public()
  @Get(':eventId/qr')
  @ApiOperation({ summary: 'Generate the check-in QR code for an event' })
  async qr(@Param('eventId') eventId: string) {
    const event = await this.eventsService.getById(eventId);
    const payload = buildEventQrPayload(event.id, event.church_id);
    const dataUrl = await generateQrDataUrl(payload);
    return { payload, dataUrl };
  }

  @Public()
  @Post(':eventId/register')
  @ApiOperation({ summary: 'Register for an event' })
  register(@Param('eventId') eventId: string, @Body() dto: RegisterEventDto) {
    return this.eventsService.register(eventId, dto);
  }
}