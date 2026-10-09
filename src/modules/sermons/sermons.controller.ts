import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ChurchAdmin } from '../../common/decorators/roles.decorator';
import { ChurchGuard } from '../../common/guards/church.guard';
import type { AuthUser } from '../../common/interfaces/auth-user.interface';
import { CreateSermonDto, UpdateSermonDto } from './sermon.dto';
import { SermonsService } from './sermons.service';

@ApiTags('sermons')
@Controller('churches/:churchId/sermons')
export class ChurchSermonsController {
  constructor(private readonly sermonsService: SermonsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List published sermons for a church' })
  list(@Param('churchId') churchId: string) {
    return this.sermonsService.list(churchId, true);
  }

  @ApiBearerAuth('supabase-jwt')
  @UseGuards(ChurchGuard)
  @Get('manage')
  @ApiOperation({ summary: 'List all sermons including drafts (admin)' })
  listAll(@Param('churchId') churchId: string) {
    return this.sermonsService.list(churchId, false);
  }

  @ApiBearerAuth('supabase-jwt')
  @UseGuards(ChurchGuard)
  @ChurchAdmin()
  @Post()
  @ApiOperation({ summary: 'Create a sermon' })
  create(
    @Param('churchId') churchId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSermonDto,
  ) {
    return this.sermonsService.create(churchId, dto, user.id);
  }

  @ApiBearerAuth('supabase-jwt')
  @UseGuards(ChurchGuard)
  @ChurchAdmin()
  @Patch(':sermonId')
  @ApiOperation({ summary: 'Update a sermon' })
  update(
    @Param('churchId') churchId: string,
    @Param('sermonId') sermonId: string,
    @Body() dto: UpdateSermonDto,
  ) {
    return this.sermonsService.update(churchId, sermonId, dto);
  }

  @ApiBearerAuth('supabase-jwt')
  @UseGuards(ChurchGuard)
  @ChurchAdmin()
  @Delete(':sermonId')
  @ApiOperation({ summary: 'Delete a sermon' })
  remove(@Param('churchId') churchId: string, @Param('sermonId') sermonId: string) {
    return this.sermonsService.remove(churchId, sermonId);
  }
}

@ApiTags('sermons')
@Controller('sermons')
export class SermonsController {
  constructor(private readonly sermonsService: SermonsService) {}

  @Public()
  @Get(':sermonId')
  @ApiOperation({ summary: 'Get a sermon' })
  getById(@Param('sermonId') sermonId: string) {
    return this.sermonsService.getById(sermonId);
  }
}