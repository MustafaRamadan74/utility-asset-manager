import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ValidationService } from './validation.service';
import { ValidationReport } from './validation.types';

@ApiTags('Validation')
@Controller('validation')
export class ValidationController {
  constructor(private readonly validationService: ValidationService) {}

  @Get('report')
  @ApiOperation({
    summary: 'Generate network topological validation report',
    description:
      'Evaluates water utility network topological rules directly in PostGIS: 1. VALVE_NOT_ON_PIPE, 2. DANGLING_PIPE_END. Returns a GeoJSON FeatureCollection containing all detected issues.',
  })
  @ApiOkResponse({
    description:
      'GeoJSON FeatureCollection containing topological issue features with affected asset IDs and human-readable messages.',
    schema: {
      example: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [31.761, 30.020045],
            },
            properties: {
              rule: 'VALVE_NOT_ON_PIPE',
              asset_ids: ['4958b31f-8ac2-476d-8899-28f9a0429d2d'],
              message: 'Valve "V-ERR-01" is more than 1 m from any pipe',
            },
          },
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [31.758, 30.022],
            },
            properties: {
              rule: 'DANGLING_PIPE_END',
              asset_ids: ['d6830ac7-bbe7-4480-a6e0-a8824d8a3edd'],
              message: 'Pipe "P-04" has an unconnected start',
            },
          },
        ],
      },
    },
  })
  async getValidationReport(): Promise<ValidationReport> {
    return this.validationService.getValidationReport();
  }
}
