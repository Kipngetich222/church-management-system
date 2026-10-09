import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 25;
}

export function paginate(page = 1, limit = 25) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(200, Math.max(1, limit));
  const from = (safePage - 1) * safeLimit;
  return { from, to: from + safeLimit - 1, page: safePage, limit: safeLimit };
}