import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AppConfiguration } from '../../common/config/configuration';
import { LocalFileStorageService } from '../../common/upload/local-file-storage.service';
import { AuditModule } from '../audit/audit.module';
import { CategoriesModule } from '../categories/categories.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesRepository } from './expenses.repository';
import { ExpensesService } from './expenses.service';
import { ReceiptRepository } from './receipt-upload/receipt.repository';
import { ReceiptUploadService } from './receipt-upload/receipt-upload.service';

@Module({
  imports: [
    AuditModule,
    CategoriesModule,
    NotificationsModule,
    UsersModule,
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfiguration, true>) => ({
        storage: memoryStorage(),
        limits: {
          fileSize: configService.get('upload.maxSizeBytes', { infer: true }),
        },
      }),
    }),
  ],
  controllers: [ExpensesController],
  providers: [
    ExpensesService,
    ExpensesRepository,
    LocalFileStorageService,
    ReceiptRepository,
    ReceiptUploadService,
  ],
  exports: [ExpensesService, ExpensesRepository, ReceiptRepository],
})
export class ExpensesModule {}
