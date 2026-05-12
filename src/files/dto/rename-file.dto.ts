import { IsString } from 'class-validator';

export class RenameFileDto {
  @IsString()
  name: string;
}
