import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { basename, extname } from 'path';
import { AppConfiguration } from '../../../common/config/configuration';
import { AppLoggerService } from '../../../common/logging/app-logger.service';
import { LocalFileStorageService } from '../../../common/upload/local-file-storage.service';
import { nowIso, ReceiptRecord } from '../../../data/store';
import { ReceiptRepository } from './receipt.repository';

type ReceiptExtension = '.jpg' | '.png' | '.pdf';

interface ValidatedReceipt {
  originalName: string;
  extension: ReceiptExtension;
  mimeType: string;
  size: number;
}

export interface StagedReceipt extends ValidatedReceipt {
  storageName: string;
}

export interface ReceiptDownload {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

const FILE_TYPES: Record<
  string,
  { extensions: string[]; storageExtension: ReceiptExtension; signature: Buffer }
> = {
  'image/jpeg': {
    extensions: ['.jpg', '.jpeg'],
    storageExtension: '.jpg',
    signature: Buffer.from([0xff, 0xd8, 0xff]),
  },
  'image/png': {
    extensions: ['.png'],
    storageExtension: '.png',
    signature: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  'application/pdf': {
    extensions: ['.pdf'],
    storageExtension: '.pdf',
    signature: Buffer.from('%PDF-', 'ascii'),
  },
};

@Injectable()
export class ReceiptUploadService {
  private readonly maxSizeBytes: number;

  constructor(
    private readonly storage: LocalFileStorageService,
    private readonly receipts: ReceiptRepository,
    private readonly logger: AppLoggerService,
    configService: ConfigService<AppConfiguration, true>,
  ) {
    this.maxSizeBytes = configService.get('upload.maxSizeBytes', { infer: true });
  }

  async stage(file: Express.Multer.File): Promise<StagedReceipt> {
    const validated = this.validate(file);
    const storageName = await this.storage.save(
      file.buffer,
      validated.extension,
    );
    this.logger.log(`Receipt stored as ${storageName}.`, 'ReceiptUpload');
    return { ...validated, storageName };
  }

  associate(expenseId: string, receipt: StagedReceipt): ReceiptRecord {
    return this.receipts.create({
      expenseId,
      originalName: receipt.originalName,
      storageName: receipt.storageName,
      mimeType: receipt.mimeType,
      size: receipt.size,
      uploadedAt: nowIso(),
    });
  }

  async getForExpense(expenseId: string): Promise<ReceiptDownload> {
    const receipt = this.receipts.findByExpenseId(expenseId);
    if (!receipt) {
      throw new NotFoundException('Receipt not found.');
    }

    try {
      return {
        buffer: await this.storage.read(receipt.storageName),
        mimeType: receipt.mimeType,
        fileName: receipt.originalName,
      };
    } catch (error) {
      if (this.isMissingFile(error)) {
        throw new NotFoundException('Receipt not found.');
      }
      this.logger.error(
        `Unable to read receipt storage object ${receipt.storageName}.`,
        error instanceof Error ? error.stack : undefined,
        'ReceiptUpload',
      );
      throw new InternalServerErrorException('Receipt could not be retrieved.');
    }
  }

  async deleteForExpense(expenseId: string): Promise<void> {
    const receipt = this.receipts.findByExpenseId(expenseId);
    if (!receipt) return;

    try {
      await this.storage.delete(receipt.storageName);
    } catch (error) {
      if (!this.isMissingFile(error)) {
        this.logger.error(
          `Receipt cleanup failed for ${receipt.storageName}.`,
          error instanceof Error ? error.stack : undefined,
          'ReceiptUpload',
        );
        throw new InternalServerErrorException('Receipt cleanup failed.');
      }
      this.logger.warn(
        `Receipt storage object ${receipt.storageName} was already missing.`,
        'ReceiptUpload',
      );
    }

    this.receipts.deleteByExpenseId(expenseId);
    this.logger.log(`Receipt deleted for expense ${expenseId}.`, 'ReceiptUpload');
  }

  async rollback(
    expenseId: string | undefined,
    receipt: StagedReceipt,
  ): Promise<void> {
    if (expenseId) {
      this.receipts.deleteByExpenseId(expenseId);
    }
    try {
      await this.storage.delete(receipt.storageName);
    } catch (error) {
      if (!this.isMissingFile(error)) {
        this.logger.error(
          `Receipt rollback cleanup failed for ${receipt.storageName}.`,
          error instanceof Error ? error.stack : undefined,
          'ReceiptUpload',
        );
      }
    }
  }

  private validate(file: Express.Multer.File): ValidatedReceipt {
    if (file.size > this.maxSizeBytes) {
      throw new PayloadTooLargeException(
        'Receipt exceeds the configured size limit.',
      );
    }

    const originalName = sanitizeOriginalFileName(file.originalname);
    const extension = extname(originalName).toLowerCase();
    const type = FILE_TYPES[file.mimetype];

    if (!type || !type.extensions.includes(extension)) {
      throw new BadRequestException(
        'Receipt must be a JPEG, PNG, or PDF with a matching file extension.',
      );
    }

    if (!file.buffer.subarray(0, type.signature.length).equals(type.signature)) {
      throw new BadRequestException(
        'Receipt contents do not match the declared file type.',
      );
    }

    return {
      originalName,
      extension: type.storageExtension,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  private isMissingFile(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    );
  }
}

export function sanitizeOriginalFileName(value: string): string {
  const normalized = value.replace(/\\/g, '/');
  const safeName = basename(normalized)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  return safeName || 'receipt';
}

export function contentDisposition(fileName: string): string {
  const safeName = sanitizeOriginalFileName(fileName);
  const asciiName = safeName
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_');
  const encodedName = encodeURIComponent(safeName).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`;
}
