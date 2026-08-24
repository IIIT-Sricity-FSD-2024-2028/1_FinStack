import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiHeader,
  ApiProduces,
  ApiResponse,
  ApiSecurity,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesService } from './expenses.service';
import { contentDisposition } from './receipt-upload/receipt-upload.service';

@ApiTags('expenses')
@ApiSecurity('role')
@ApiHeader({ name: 'role', enum: ['superuser', 'admin', 'user'], required: true })
@ApiExtraModels(CreateExpenseDto)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  findAll() {
    return this.expensesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.expensesService.findOne(id);
  }

  @Post()
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiBody({
    schema: {
      allOf: [
        { $ref: getSchemaPath(CreateExpenseDto) },
        {
          type: 'object',
          properties: {
            receipt: { type: 'string', format: 'binary' },
          },
        },
      ],
    },
  })
  @UseInterceptors(FileInterceptor('receipt'))
  create(
    @Body() dto: CreateExpenseDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: Request,
  ) {
    return this.expensesService.create(
      dto,
      file,
      Boolean(request.is('multipart/form-data')),
    );
  }

  @Get(':id/receipt')
  @ApiProduces('image/jpeg', 'image/png', 'application/pdf')
  @ApiResponse({ status: 200, description: 'Stored expense receipt file.' })
  async downloadReceipt(
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const receipt = await this.expensesService.getReceipt(id);
    response.setHeader('Content-Type', receipt.mimeType);
    response.setHeader(
      'Content-Disposition',
      contentDisposition(receipt.fileName),
    );
    return new StreamableFile(receipt.buffer);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateExpenseDto) {
    return this.expensesService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.expensesService.delete(id);
  }
}
