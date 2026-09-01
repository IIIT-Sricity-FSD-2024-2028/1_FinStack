import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiHeader, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ReleasePaymentBatchDto } from './dto/release-payment-batch.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('transactions')
@ApiSecurity('role')
@ApiHeader({ name: 'role', enum: ['superuser', 'admin', 'user'], required: true })
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  findAll() {
    return this.transactionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.transactionsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(dto);
  }

  @Post('payment-batches/:batchId/release')
  releasePaymentBatch(@Param('batchId') batchId: string, @Body() dto: ReleasePaymentBatchDto = {}) {
    return this.transactionsService.releasePaymentBatch(batchId, dto.expenseIds);
  }

  @Post(':id/bank-sandbox/success')
  markProcessed(@Param('id') id: string) {
    return this.transactionsService.markProcessed(id);
  }

  @Post(':id/bank-sandbox/failure')
  markFailed(@Param('id') id: string) {
    return this.transactionsService.markFailed(id);
  }

  @Post(':id/reconcile')
  reconcile(@Param('id') id: string) {
    return this.transactionsService.reconcile(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTransactionDto) {
    return this.transactionsService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.transactionsService.delete(id);
  }
}
