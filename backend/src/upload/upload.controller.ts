import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PrismaService } from '../database/prisma.service';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname } from 'path';

const UPLOAD_DIR = './uploads';

@Controller('upload')
export class UploadController {
  constructor(private readonly prisma: PrismaService) {
    if (!existsSync(UPLOAD_DIR)) {
      mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          if (!existsSync(UPLOAD_DIR)) {
            mkdirSync(UPLOAD_DIR, { recursive: true });
          }
          cb(null, UPLOAD_DIR);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded or file parameter is missing.');
    }

    const metadata = {
      filename: file.filename,
      originalName: file.originalname,
      path: file.path.replace(/\\/g, '/'), // Standardize to forward slashes
      size: file.size,
      mimetype: file.mimetype,
    };

    let savedDocument: any = null;
    let savedInDb = false;

    if (this.prisma.isConnected) {
      try {
        savedDocument = await this.prisma.document.create({
          data: {
            filename: file.filename,
            originalName: file.originalname,
            path: file.path.replace(/\\/g, '/'),
            size: file.size,
            mimetype: file.mimetype,
          },
        });
        savedInDb = true;
      } catch (err) {
        // Fall back gracefully to local storage if DB query errors
      }
    }

    return {
      message: 'File uploaded successfully.',
      file: metadata,
      database: savedInDb ? 'saved' : 'skipped (offline/failed)',
      documentId: savedDocument ? savedDocument.id : null,
    };
  }
}
