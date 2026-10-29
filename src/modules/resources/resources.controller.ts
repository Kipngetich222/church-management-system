import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import { ChurchAdmin } from '../../common/decorators/roles.decorator'
import { ChurchGuard } from '../../common/guards/church.guard'
import { CreateResourceDto, UpdateResourceDto } from './resource.dto'
import { MAX_RESOURCE_BYTES, ResourcesService } from './resources.service'
import type { ResourceUploadFile } from './resources.service'

@ApiTags('resources')
@ApiBearerAuth('supabase-jwt')
@UseGuards(ChurchGuard)
@Controller('churches/:churchId/resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Get()
  @ApiOperation({ summary: 'List downloadable documents, books and photos' })
  list(@Param('churchId') churchId: string) {
    return this.resourcesService.list(churchId)
  }

  @ChurchAdmin()
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_RESOURCE_BYTES, files: 1 },
    })
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'name', 'type'],
      properties: {
        file: { type: 'string', format: 'binary' },
        name: { type: 'string' },
        type: { type: 'string', enum: ['document', 'book', 'image'] },
        description: { type: 'string' },
        eventName: { type: 'string' },
        photoDate: { type: 'string', format: 'date' },
      },
    },
  })
  @ApiOperation({
    summary: 'Upload a document, book or photo (50 MB files, 10 MB photos)',
  })
  create(
    @Param('churchId') churchId: string,
    @Body() dto: CreateResourceDto,
    @UploadedFile() file?: ResourceUploadFile
  ) {
    return this.resourcesService.create(churchId, dto, file)
  }

  @Get(':resourceId/download')
  @ApiOperation({ summary: 'Get a short-lived download URL for a resource' })
  download(
    @Param('churchId') churchId: string,
    @Param('resourceId') resourceId: string
  ) {
    return this.resourcesService.fileUrl(churchId, resourceId)
  }

  @Get(':resourceId/preview')
  @ApiOperation({ summary: 'Get a short-lived photo preview URL' })
  preview(
    @Param('churchId') churchId: string,
    @Param('resourceId') resourceId: string
  ) {
    return this.resourcesService.fileUrl(churchId, resourceId, true)
  }

  @ChurchAdmin()
  @Patch(':resourceId')
  @ApiOperation({
    summary: 'Update a resource title, description or photo grouping',
  })
  update(
    @Param('churchId') churchId: string,
    @Param('resourceId') resourceId: string,
    @Body() dto: UpdateResourceDto
  ) {
    return this.resourcesService.update(churchId, resourceId, dto)
  }

  @ChurchAdmin()
  @Delete(':resourceId')
  @ApiOperation({ summary: 'Delete a resource and its uploaded file' })
  remove(
    @Param('churchId') churchId: string,
    @Param('resourceId') resourceId: string
  ) {
    return this.resourcesService.remove(churchId, resourceId)
  }
}
