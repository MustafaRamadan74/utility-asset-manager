import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'System and database health check' })
  @ApiResponse({
    status: 200,
    description: 'System is healthy and database is connected',
    schema: {
      example: {
        status: 'ok',
        database: 'connected',
        timestamp: '2026-10-14T19:00:00.000Z',
      },
    },
  })
  async checkHealth() {
    await this.dataSource.query('SELECT 1;');
    return {
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}
