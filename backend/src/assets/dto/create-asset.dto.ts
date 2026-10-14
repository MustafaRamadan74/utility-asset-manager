import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssetStatus, AssetType } from '../asset.types';

@ValidatorConstraint({ name: 'IsDiameterValid', async: false })
export class IsDiameterValidConstraint implements ValidatorConstraintInterface {
  validate(diameter: any, args: ValidationArguments): boolean {
    const obj = args.object as any;
    // When updating, 'type' is omitted in UpdateAssetDto; merge & re-validation is enforced in AssetsService (D5)
    if (obj.type === undefined) {
      return true;
    }
    if (obj.type === AssetType.PIPE) {
      return (
        typeof diameter === 'number' &&
        Number.isInteger(diameter) &&
        diameter > 0
      );
    }
    return diameter === null || diameter === undefined;
  }

  defaultMessage(args: ValidationArguments): string {
    const obj = args.object as any;
    if (obj.type === AssetType.PIPE) {
      return 'diameter_mm is required and must be a positive integer greater than 0 for PIPE';
    }
    return 'diameter_mm is only allowed for PIPE assets and must not be provided for VALVE or HYDRANT';
  }
}

export class CreateAssetDto {
  @ApiProperty({
    example: 'Trunk Line 01',
    description: 'Name of the utility asset (non-empty string)',
  })
  @IsString()
  @IsNotEmpty({ message: 'name must not be empty' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @ApiProperty({
    enum: AssetType,
    example: AssetType.PIPE,
    description: 'Asset type (PIPE, VALVE, HYDRANT). Immutable after creation.',
  })
  @IsEnum(AssetType, {
    message: 'type must be one of: PIPE, VALVE, HYDRANT',
  })
  type: AssetType;

  @ApiPropertyOptional({
    enum: AssetStatus,
    default: AssetStatus.ACTIVE,
    example: AssetStatus.ACTIVE,
    description: 'Operational status of the asset',
  })
  @IsOptional()
  @IsEnum(AssetStatus, {
    message: 'status must be one of: ACTIVE, MAINTENANCE, DECOMMISSIONED',
  })
  status?: AssetStatus = AssetStatus.ACTIVE;

  @ApiPropertyOptional({
    example: 300,
    description:
      'Diameter in millimetres. Mandatory and > 0 for PIPE; must be null or omitted for VALVE/HYDRANT.',
  })
  @IsOptional()
  @Validate(IsDiameterValidConstraint)
  diameter_mm?: number | null;

  @ApiProperty({
    description:
      'GeoJSON geometry object. LineString for PIPE, Point for VALVE or HYDRANT.',
    example: {
      type: 'LineString',
      coordinates: [
        [31.76, 30.02],
        [31.762, 30.02],
      ],
    },
  })
  @IsNotEmpty({ message: 'geometry is required' })
  @IsObject({ message: 'geometry must be a valid GeoJSON object' })
  geometry: any;
}
