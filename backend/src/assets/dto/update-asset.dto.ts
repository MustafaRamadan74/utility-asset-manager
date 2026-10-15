import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateAssetDto } from './create-asset.dto';

/**
 * UpdateAssetDto:
 * Asset 'type' is immutable after creation, so it is omitted.
 * All other fields are optional.
 * When PATCHing, the service merges existing row values and re-validates the merged state.
 */
export class UpdateAssetDto extends PartialType(
  OmitType(CreateAssetDto, ['type'] as const),
) {}
