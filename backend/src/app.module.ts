import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'path';
import { HealthController } from './health/health.controller';
import { AssetsModule } from './assets/assets.module';
import { ValidationModule } from './validation/validation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(__dirname, '../../../.env'),
        path.resolve(__dirname, '../../.env'),
        '.env',
      ],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: parseInt(configService.get<string>('DB_PORT', '5433'), 10),
        username: configService.get<string>('DB_USER', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_NAME', 'utility_assets'),
        synchronize: false,
        logging: configService.get<string>('NODE_ENV') === 'development',
        entities: [],
      }),
    }),
    AssetsModule,
    ValidationModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
