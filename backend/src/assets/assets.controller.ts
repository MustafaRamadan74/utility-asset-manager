import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { ListAssetsQueryDto } from './dto/list-assets-query.dto';
import { NearestQueryDto } from './dto/nearest-query.dto';
import { WithinPolygonDto } from './dto/within-polygon.dto';
import { Asset } from './asset.types';

@ApiTags('Assets')
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new utility asset',
    description:
      'Creates a water utility asset (PIPE, VALVE, HYDRANT). Validates geometry and diameter rules.',
  })
  @ApiCreatedResponse({
    description: 'The asset has been successfully created.',
  })
  @ApiBadRequestResponse({
    description:
      'Validation failure (e.g. invalid geometry, missing diameter for PIPE, diameter provided for VALVE/HYDRANT).',
  })
  async create(@Body() createDto: CreateAssetDto): Promise<Asset> {
    return this.assetsService.create(createDto);
  }

  @Get()
  @ApiOperation({
    summary: 'List assets with optional filters',
    description:
      'Retrieves assets filtered by type, status, and/or bounding box (bbox: minX,minY,maxX,maxY).',
  })
  @ApiOkResponse({
    description: 'List of matching assets.',
  })
  async findAll(@Query() query: ListAssetsQueryDto): Promise<Asset[]> {
    return this.assetsService.findAll(query);
  }

  // --- Spatial Query Routes (Declared BEFORE :id routes per D5) ---

  @Get('nearest')
  @ApiOperation({
    summary: 'Find nearest assets to a geographic coordinate (D4)',
    description:
      'Finds nearest assets to [lng, lat] with geodesic distance calculated in metres on the spheroid.',
  })
  @ApiOkResponse({
    description: 'List of nearest assets ordered by geodesic distance in metres.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid coordinates or limit parameter.',
  })
  async findNearest(
    @Query() query: NearestQueryDto,
  ): Promise<(Asset & { distance_m: number })[]> {
    return this.assetsService.findNearest(query.lng, query.lat, query.limit);
  }

  @Post('query/within')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Query assets within a GeoJSON Polygon (D4)',
    description:
      'The request body is the GeoJSON Polygon itself. Returns all intersecting utility assets.',
  })
  @ApiBody({
    type: WithinPolygonDto,
    description: 'GeoJSON Polygon geometry object',
    examples: {
      polygonExample: {
        summary: 'Bounding Polygon in New Capital',
        value: {
          type: 'Polygon',
          coordinates: [
            [
              [31.759, 30.019],
              [31.765, 30.019],
              [31.765, 30.023],
              [31.759, 30.023],
              [31.759, 30.019],
            ],
          ],
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Assets intersecting the provided polygon.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid GeoJSON polygon structure.',
  })
  async findWithin(@Body() polygon: any): Promise<Asset[]> {
    return this.assetsService.findWithin(polygon);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get network summary statistics (B4)',
    description:
      'Returns aggregate counts by type and status, along with total pipe network length calculated in metres via PostGIS geography.',
  })
  async getSummary() {
    return this.assetsService.getSummary();
  }

  // --- Undo Routes (Declared BEFORE :id routes per D5) ---

  @Get('undo/status')
  @ApiOperation({
    summary: 'Check if there is an action that can be undone',
    description: 'Returns the status and last action available in asset_undo_logs.',
  })
  async getUndoStatus() {
    return this.assetsService.getUndoStatus();
  }

  @Post('undo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Undo the last operation (CREATE, UPDATE, DELETE)',
    description:
      'Reverts the most recent asset operation using the audit history log.',
  })
  async undo() {
    return this.assetsService.undo();
  }

  // --- ID Routes (Declared AFTER specific routes per D5) ---

  @Get(':id')
  @ApiOperation({
    summary: 'Get asset by ID',
    description: 'Retrieves a single utility asset by its UUID.',
  })
  @ApiParam({ name: 'id', description: 'Asset UUID' })
  @ApiOkResponse({ description: 'Asset found and returned.' })
  @ApiNotFoundResponse({ description: 'Asset with specified ID was not found.' })
  async findOne(@Param('id') id: string): Promise<Asset> {
    return this.assetsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an existing asset',
    description:
      'Partially updates an asset. Merges values with existing state and enforces validation rules (type is immutable).',
  })
  @ApiParam({ name: 'id', description: 'Asset UUID' })
  @ApiOkResponse({ description: 'Asset successfully updated.' })
  @ApiBadRequestResponse({
    description:
      'Invalid update payload (e.g. attempting to change immutable type, invalid diameter, invalid geometry).',
  })
  @ApiNotFoundResponse({ description: 'Asset with specified ID was not found.' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAssetDto,
  ): Promise<Asset> {
    return this.assetsService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete an asset',
    description: 'Deletes an asset permanently from the database by its UUID.',
  })
  @ApiParam({ name: 'id', description: 'Asset UUID' })
  @ApiOkResponse({ description: 'Asset successfully deleted.' })
  @ApiNotFoundResponse({ description: 'Asset with specified ID was not found.' })
  async remove(
    @Param('id') id: string,
  ): Promise<{ deleted: boolean; id: string }> {
    return this.assetsService.remove(id);
  }
}
