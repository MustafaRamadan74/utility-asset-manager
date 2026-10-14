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
      'Retrieves assets filtered by type, status, and/or bounding box (bbox).',
  })
  @ApiOkResponse({
    description: 'List of matching assets.',
  })
  async findAll(@Query() query: ListAssetsQueryDto): Promise<Asset[]> {
    return this.assetsService.findAll(query);
  }

  // Note: D5 route order requires :id routes to be defined after specific path routes
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
