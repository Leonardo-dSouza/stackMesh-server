import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { RenameFolderDto } from './dto/rename-folder.dto';

@Injectable()
export class FoldersService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateFolderDto) {
    if (dto.parentId) {
      const parent = await this.prisma.folder.findUnique({
        where: { id: dto.parentId },
      });

      if (!parent || parent.userId !== userId || parent.deletedAt) {
        throw new NotFoundException('Parent folder not found');
      }
    }

    const folder = await this.prisma.folder.create({
      data: {
        name: dto.name,
        userId,
        parentId: dto.parentId || null,
      },
    });

    return folder;
  }

  async listRoot(userId: string) {
    const folders = await this.prisma.folder.findMany({
      where: {
        userId,
        parentId: null,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    return folders;
  }

  async listContents(userId: string, folderId: string) {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder || folder.userId !== userId || folder.deletedAt) {
      throw new NotFoundException('Folder not found');
    }

    const [childFolders, files] = await Promise.all([
      this.prisma.folder.findMany({
        where: {
          parentId: folderId,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.file.findMany({
        where: {
          folderId,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      folder,
      folders: childFolders,
      files,
    };
  }

  async rename(userId: string, folderId: string, dto: RenameFolderDto) {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder || folder.userId !== userId || folder.deletedAt) {
      throw new NotFoundException('Folder not found');
    }

    const updated = await this.prisma.folder.update({
      where: { id: folderId },
      data: { name: dto.name },
    });

    return updated;
  }

  async delete(userId: string, folderId: string) {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder || folder.userId !== userId || folder.deletedAt) {
      throw new NotFoundException('Folder not found');
    }

    // Soft delete this folder and all descendants recursively
    await this.softDeleteFolderRecursive(folderId);

    // Get all files in this tree to update user quota
    const allFilesInTree = await this.getAllFilesInFolderTree(folderId);
    const totalSizesToSubtract = allFilesInTree.reduce((sum, file) => sum + file.sizeBytes, 0n);

    // Update user totalBytes
    if (totalSizesToSubtract > 0n) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          totalBytes: {
            decrement: totalSizesToSubtract,
          },
        },
      });
    }

    return { message: 'Folder deleted successfully' };
  }

  private async softDeleteFolderRecursive(folderId: string) {
    // Get all children folders
    const children = await this.prisma.folder.findMany({
      where: { parentId: folderId },
    });

    // Recursively delete children first
    for (const child of children) {
      await this.softDeleteFolderRecursive(child.id);
    }

    // Soft delete this folder
    await this.prisma.folder.update({
      where: { id: folderId },
      data: { deletedAt: new Date() },
    });

    // Soft delete all files in this folder
    await this.prisma.file.updateMany({
      where: { folderId },
      data: { deletedAt: new Date() },
    });
  }

  private async getAllFilesInFolderTree(folderId: string): Promise<any[]> {
    const allFiles = [];

    // Get files in this folder
    const filesHere = await this.prisma.file.findMany({
      where: { folderId, deletedAt: null },
    });
    allFiles.push(...filesHere);

    // Get all child folders
    const children = await this.prisma.folder.findMany({
      where: { parentId: folderId, deletedAt: null },
    });

    // Recursively get files from child folders
    for (const child of children) {
      const filesInChild = await this.getAllFilesInFolderTree(child.id);
      allFiles.push(...filesInChild);
    }

    return allFiles;
  }
}
