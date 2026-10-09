import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: "Internal server error" };

    if (status >= 500) {
      this.logger.error(exception instanceof Error ? exception.message : String(exception));
    }

    const body =
      typeof payload === "string" ? { message: payload } : (payload as Record<string, unknown>);

    response.status(status).json({
      statusCode: status,
      ...body,
    });
  }
}