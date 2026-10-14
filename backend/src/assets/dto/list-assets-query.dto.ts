import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AssetStatus, AssetType } from '../asset.types';

export class ListAssetsQueryDto {
  @ApiPropertyOptional({
    enum: AssetType,
    description: 'Filter assets by type (PIPE, VALVE, HYDRANT)',
  })
  @IsOptional()
  @IsEnum(AssetType, {
    message: 'type filter must be one of: PIPE, VALVE, HYDRANT',
  })
  type?: AssetType;

  @ApiPropertyOptional({
    enum: AssetStatus,
    description:
      'Filter assets by operational status (ACTIVE, MAINTENANCE, DECOMMISSIONED)',
  })
  @IsOptional()
  @IsEnum(AssetStatus, {
    message: 'status filter must be one of: ACTIVE, MAINTENANCE, DECOMMISSIONED',
  })
  status?: AssetStatus;

  @ApiPropertyOptional({
    example: '31.75,30.01,31.77,30.03',
    description:
      'Bounding box filter in WGS84 coordinates: minX,minY,maxX,maxY (lngMin,latMin,lngMax,latMax)',
  })
  @IsOptional()
  @IsString()
  bbox?: string;
}
