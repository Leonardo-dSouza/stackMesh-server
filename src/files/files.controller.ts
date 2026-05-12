import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { RequestUploadDto } from './dto/request-upload.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { RenameFileDto } from './dto/rename-file.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private filesService: FilesService) {}

  @Post('upload-url')
  async requestUploadUrl(@Req() req: Request, @Body() dto: RequestUploadDto) {
    const user = req.user as any;
    return this.filesService.requestUploadUrl(user.userId, dto);
  }

  @Post('confirm')
  async confirmUpload(@Req() req: Request, @Body() dto: ConfirmUploadDto) {
    const user = req.user as any;
    return this.filesService.confirmUpload(user.userId, dto);
  }

  @Get()
  async listRoot(@Req() req: Request) {
    const user = req.user as any;
    return this.filesService.listRoot(user.userId);
  }

  @Get(':id/download-url')
  async getDownloadUrl(@Req() req: Request, @Param('id') fileId: string) {
    const user = req.user as any;
    return this.filesService.getDownloadUrl(user.userId, fileId);
  }

  @Patch(':id')
  async rename(
    @Req() req: Request,
    @Param('id') fileId: string,
    @Body() dto: RenameFileDto,
  ) {
    const user = req.user as any;
    return this.filesService.rename(user.userId, fileId, dto);
  }

  @Delete(':id')
  async delete(@Req() req: Request, @Param('id') fileId: string) {
    const user = req.user as any;
    return this.filesService.delete(user.userId, fileId);
  }
}
