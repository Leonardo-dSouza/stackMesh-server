import { IsString } from 'class-validator';

export class RenameFolderDto {
  @IsString()
  name: string;
}
