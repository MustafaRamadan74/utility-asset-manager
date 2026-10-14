import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NearestQueryDto {
  @ApiProperty({
    example: 31.761,
    description: 'Longitude of the query point in WGS84 degrees (-180 to 180)',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'lng must be a valid number' })
  @Min(-180, { message: 'lng must be >= -180' })
  @Max(180, { message: 'lng must be <= 180' })
  lng: number;

  @ApiProperty({
    example: 30.02,
    description: 'Latitude of the query point in WGS84 degrees (-90 to 90)',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'lat must be a valid number' })
  @Min(-90, { message: 'lat must be >= -90' })
  @Max(90, { message: 'lat must be <= 90' })
  lat: number;

  @ApiPropertyOptional({
    default: 5,
    minimum: 1,
    maximum: 50,
    example: 5,
    description: 'Maximum number of nearest assets to return (1 to 50)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'limit must be a valid number' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(50, { message: 'limit must be at most 50' })
  limit?: number = 5;
}
