import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Public } from '../../common/decorators/public.decorator'
import { RegisterVisitorDto, VisitorCommentDto } from './visitor.dto'
import { VisitorsService } from './visitors.service'

@ApiTags('visitor-welcome')
@Public()
@Controller('visitor-welcome/:token')
export class VisitorWelcomeController {
  constructor(private readonly visitors: VisitorsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Public church welcome note for a visitor QR code' })
  welcome(@Param('token', ParseUUIDPipe) token: string) {
    return this.visitors.welcome(token)
  }

  @Post('registrations')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Register a visitor without an account' })
  register(
    @Param('token', ParseUUIDPipe) token: string,
    @Body() dto: RegisterVisitorDto
  ) {
    return this.visitors.register(token, dto)
  }

  @Get('programme')
  @Header('Cache-Control', 'no-store')
  @ApiHeader({ name: 'X-Visitor-Session', required: true })
  @ApiOperation({
    summary: 'Registered visitor public activities and own comments',
  })
  programme(
    @Param('token', ParseUUIDPipe) token: string,
    @Headers('x-visitor-session') session?: string
  ) {
    return this.visitors.programme(token, session)
  }

  @Post('comments')
  @Header('Cache-Control', 'no-store')
  @ApiHeader({ name: 'X-Visitor-Session', required: true })
  @ApiOperation({ summary: 'Leave a comment for the church super admins' })
  addComment(
    @Param('token', ParseUUIDPipe) token: string,
    @Body() dto: VisitorCommentDto,
    @Headers('x-visitor-session') session?: string
  ) {
    return this.visitors.addComment(token, dto, session)
  }
}
