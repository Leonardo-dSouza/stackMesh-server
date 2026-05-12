import { IsString, IsNumber, IsOptional } from 'class-validator';

export class RequestUploadDto {
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
