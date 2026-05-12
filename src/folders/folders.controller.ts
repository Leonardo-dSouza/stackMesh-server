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
import { FoldersService } from './folders.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { RenameFolderDto } from './dto/rename-folder.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

@Controller('folders')
@UseGuards(JwtAuthGuard)
export class FoldersController {
  constructor(private foldersService: FoldersService) {}

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateFolderDto) {
    const user = req.user as any;
    return this.foldersService.create(user.userId, dto);
  }

  @Get()
  async listRoot(@Req() req: Request) {
    const user = req.user as any;
    return this.foldersService.listRoot(user.userId);
  }

  @Get(':id')
  async listContents(@Req() req: Request, @Param('id') folderId: string) {
    const user = req.user as any;
    return this.foldersService.listContents(user.userId, folderId);
  }

  @Patch(':id')
  async rename(
    @Req() req: Request,
    @Param('id') folderId: string,
    @Body() dto: RenameFolderDto,
  ) {
    const user = req.user as any;
    return this.foldersService.rename(user.userId, folderId, dto);
  }

  @Delete(':id')
  async delete(@Req() req: Request, @Param('id') folderId: string) {
    const user = req.user as any;
    return this.foldersService.delete(user.userId, folderId);
  }
}
