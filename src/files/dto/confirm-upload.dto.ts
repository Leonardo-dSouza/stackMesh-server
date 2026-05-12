import { IsString, IsNumber, IsOptional } from 'class-validator';

export class ConfirmUploadDto {
  @IsString()
  s3Key: string;

  @IsString()
  name: string;

  @IsString()
  mimeType: string;

  @IsNumber()
  sizeBytes: number;

  @IsOptional()
  @IsString()
  folderId?: string;
}
