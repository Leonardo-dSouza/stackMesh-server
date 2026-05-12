import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { RequestUploadDto } from './dto/request-upload.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { RenameFileDto } from './dto/rename-file.dto';

@Injectable()
export class FilesService {
  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
  ) {}

  async requestUploadUrl(userId: string, dto: RequestUploadDto) {
    // Validate folder if provided
    if (dto.folderId) {
      const folder = await this.prisma.folder.findUnique({
        where: { id: dto.folderId },
      });

      if (!folder || folder.userId !== userId || folder.deletedAt) {
        throw new NotFoundException('Folder not found');
      }
    }

    // Validate file size limit
    const MAX_FILE_SIZE_BYTES = BigInt(
      process.env.MAX_FILE_SIZE_BYTES || '104857600',
    ); // 100MB
    if (BigInt(dto.sizeBytes) > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File size exceeds limit');
    }

    // Get user quota
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate user quota
    const MAX_TOTAL_BYTES = BigInt(
      process.env.MAX_TOTAL_BYTES_PER_USER || '1073741824',
    ); // 1GB
    if (user.totalBytes + BigInt(dto.sizeBytes) > MAX_TOTAL_BYTES) {
      throw new BadRequestException('Storage quota exceeded');
    }

    // Generate S3 key
    const fileId = uuidv4();
    const s3Key = `${userId}/${fileId}/${dto.name}`;

    // Get presigned upload URL
    const uploadUrl = await this.s3Service.getPresignedUploadUrl(
      s3Key,
      dto.mimeType,
      BigInt(dto.sizeBytes),
    );

    return { uploadUrl, s3Key, fileId };
  }

  async confirmUpload(userId: string, dto: ConfirmUploadDto) {
    // Validate folder if provided
    if (dto.folderId) {
      const folder = await this.prisma.folder.findUnique({
        where: { id: dto.folderId },
      });

      if (!folder || folder.userId !== userId || folder.deletedAt) {
        throw new NotFoundException('Folder not found');
      }
    }

    // Extract fileId from s3Key format: {userId}/{fileId}/{fileName}
    const keyParts = dto.s3Key.split('/');
    if (keyParts.length < 3 || keyParts[0] !== userId) {
      throw new BadRequestException('Invalid s3Key format or user mismatch');
    }

    const fileId = keyParts[1];
    const sizeBytes = BigInt(dto.sizeBytes);

    // Save file metadata to database
    const file = await this.prisma.file.create({
      data: {
        id: fileId,
        name: dto.name,
        s3Key: dto.s3Key,
        mimeType: dto.mimeType,
        sizeBytes,
        instanceId: process.env.INSTANCE_ID || 'backend-1',
        userId,
        folderId: dto.folderId || null,
      },
    });

    // Update user totalBytes
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totalBytes: {
          increment: sizeBytes,
        },
      },
    });

    return file;
  }

  async listRoot(userId: string) {
    const files = await this.prisma.file.findMany({
      where: {
        userId,
        folderId: null,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    return files;
  }

  async getDownloadUrl(userId: string, fileId: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file || file.userId !== userId || file.deletedAt) {
      throw new NotFoundException('File not found');
    }

    const downloadUrl = await this.s3Service.getPresignedDownloadUrl(
      file.s3Key,
    );

    return { downloadUrl };
  }

  async rename(userId: string, fileId: string, dto: RenameFileDto) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file || file.userId !== userId || file.deletedAt) {
      throw new NotFoundException('File not found');
    }

    const updated = await this.prisma.file.update({
      where: { id: fileId },
      data: { name: dto.name },
    });

    return updated;
  }

  async delete(userId: string, fileId: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file || file.userId !== userId || file.deletedAt) {
      throw new NotFoundException('File not found');
    }

    // Soft delete
    const updated = await this.prisma.file.update({
      where: { id: fileId },
      data: { deletedAt: new Date() },
    });

    // Update user quota
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totalBytes: {
          decrement: file.sizeBytes,
        },
      },
    });

    return { message: 'File deleted successfully' };
  }
}
