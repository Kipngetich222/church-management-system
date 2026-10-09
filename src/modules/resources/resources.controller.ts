import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentMembership, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChurchAdmin } from '../../common/decorators/roles.decorator';
import { ChurchGuard } from '../../common/guards/church.guard';
import type { AuthUser, MembershipSummary } from '../../common/interfaces/auth-user.interface';
import { CreateBookingDto, CreateResourceDto, UpdateResourceDto } from './resource.dto';
import { ResourcesService } from './resources.service';

@ApiTags('resources')
@ApiBearerAuth('supabase-jwt')
@UseGuards(ChurchGuard)
@Controller('churches/:churchId/resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Get()
  @ApiOperation({ summary: 'List bookable resources' })
  list(@Param('churchId') churchId: string) {
    return this.resourcesService.list(churchId);
  }

  @ChurchAdmin()
  @Post()
  @ApiOperation({ summary: 'Create a resource' })
  create(@Param('churchId') churchId: string, @Body() dto: CreateResourceDto) {
    return this.resourcesService.create(churchId, dto);
  }

  @ChurchAdmin()
  @Patch(':resourceId')
  @ApiOperation({ summary: 'Update a resource' })
  update(
    @Param('churchId') churchId: string,
    @Param('resourceId') resourceId: string,
    @Body() dto: UpdateResourceDto,
  ) {
    return this.resourcesService.update(churchId, resourceId, dto);
  }

  @ChurchAdmin()
  @Delete(':resourceId')
  @ApiOperation({ summary: 'Delete a resource' })
  remove(@Param('churchId') churchId: string, @Param('resourceId') resourceId: string) {
    return this.resourcesService.remove(churchId, resourceId);
  }

  @Get('bookings')
  @ApiOperation({ summary: 'List resource bookings' })
  listBookings(@Param('churchId') churchId: string) {
    return this.resourcesService.listBookings(churchId);
  }

  @Post('bookings')
  @ApiOperation({ summary: 'Request a resource booking' })
  createBooking(
    @Param('churchId') churchId: string,
    @CurrentMembership() membership: MembershipSummary,
    @Body() dto: CreateBookingDto,
  ) {
    return this.resourcesService.createBooking(churchId, dto, membership.id);
  }

  @ChurchAdmin()
  @Patch('bookings/:bookingId')
  @ApiOperation({ summary: 'Approve / update a booking status' })
  updateBooking(
    @Param('churchId') churchId: string,
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: AuthUser,
    @Body('status') status: string,
  ) {
    return this.resourcesService.updateBookingStatus(churchId, bookingId, status, user.id);
  }

  @ChurchAdmin()
  @Delete('bookings/:bookingId')
  @ApiOperation({ summary: 'Delete a booking' })
  removeBooking(@Param('churchId') churchId: string, @Param('bookingId') bookingId: string) {
    return this.resourcesService.removeBooking(churchId, bookingId);
  }
}