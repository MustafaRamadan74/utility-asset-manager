import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class WithinPolygonDto {
  @ApiProperty({
    example: 'Polygon',
    description: "GeoJSON geometry type (must be 'Polygon')",
  })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({
    example: [
      [
        [31.759, 30.019],
        [31.763, 30.019],
        [31.763, 30.023],
        [31.759, 30.023],
        [31.759, 30.019],
      ],
    ],
    description:
      'Array of linear rings. The outer ring must have >= 4 coordinates and be closed.',
  })
  @IsArray()
  @IsNotEmpty()
  coordinates: number[][][];
}
