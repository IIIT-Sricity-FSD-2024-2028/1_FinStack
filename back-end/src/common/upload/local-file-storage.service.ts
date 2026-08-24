import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { basename, join } from 'path';
import { AppConfiguration } from '../config/configuration';

const STORAGE_NAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|pdf)$/i;

@Injectable()
export class LocalFileStorageService implements OnModuleInit {
  private readonly directory: string;

  constructor(configService: ConfigService<AppConfiguration, true>) {
    this.directory = configService.get('upload.directory', { infer: true });
  }

  async onModuleInit(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
  }

  async save(
    buffer: Buffer,
    extension: '.jpg' | '.png' | '.pdf',
  ): Promise<string> {
    await mkdir(this.directory, { recursive: true });
    const storageName = `${randomUUID()}${extension}`;
    await writeFile(this.resolveStorageName(storageName), buffer, { flag: 'wx' });
    return storageName;
  }

  read(storageName: string): Promise<Buffer> {
    return readFile(this.resolveStorageName(storageName));
  }

  delete(storageName: string): Promise<void> {
    return rm(this.resolveStorageName(storageName));
  }

  private resolveStorageName(storageName: string): string {
    if (
      basename(storageName) !== storageName ||
      !STORAGE_NAME_PATTERN.test(storageName)
    ) {
      throw new Error('Invalid internal receipt storage name.');
    }

    return join(this.directory, storageName);
  }
}
