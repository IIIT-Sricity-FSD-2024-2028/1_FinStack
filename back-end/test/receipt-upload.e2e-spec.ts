import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { configureHttpApplication } from '../src/common/config/configure-http-application';
import { ExpenseRecord, store } from '../src/data/store';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);
const PDF = Buffer.from('%PDF-1.7\nreceipt-data\n', 'ascii');
const STORAGE_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|pdf)$/i;

describe('Expense receipt upload (e2e)', () => {
  let app: INestApplication;
  let uploadDirectory: string;
  let logDirectory: string;
  let originalExpenseIds: Set<string>;
  let originalReceiptIds: Set<string>;

  beforeAll(async () => {
    uploadDirectory = mkdtempSync(join(tmpdir(), 'finstack-receipts-'));
    logDirectory = mkdtempSync(join(tmpdir(), 'finstack-receipt-logs-'));
    originalExpenseIds = new Set(store.expenses.map((expense) => expense.id));
    originalReceiptIds = new Set(store.receipts.map((receipt) => receipt.id));

    process.env.NODE_ENV = 'test';
    process.env.UPLOAD_DIRECTORY = uploadDirectory;
    process.env.UPLOAD_MAX_SIZE_MB = '5';
    process.env.LOG_DIRECTORY = logDirectory;
    process.env.THROTTLE_TTL_SECONDS = '60';
    process.env.THROTTLE_LIMIT = '120';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureHttpApplication(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    store.expenses.splice(
      0,
      store.expenses.length,
      ...store.expenses.filter((expense) => originalExpenseIds.has(expense.id)),
    );
    store.receipts.splice(
      0,
      store.receipts.length,
      ...store.receipts.filter((receipt) => originalReceiptIds.has(receipt.id)),
    );
    rmSync(uploadDirectory, { recursive: true, force: true });
    rmSync(logDirectory, { recursive: true, force: true });
    delete process.env.UPLOAD_DIRECTORY;
    delete process.env.UPLOAD_MAX_SIZE_MB;
    delete process.env.LOG_DIRECTORY;
    delete process.env.THROTTLE_TTL_SECONDS;
    delete process.env.THROTTLE_LIMIT;
  });

  it.each([
    ['JPEG', JPEG, 'receipt.jpeg', 'image/jpeg', '.jpg'],
    ['PNG', PNG, 'receipt.png', 'image/png', '.png'],
    ['PDF', PDF, 'Quarterly Invoice.pdf', 'application/pdf', '.pdf'],
  ])(
    'stores a valid %s under a UUID filename',
    async (_label, bytes, fileName, mimeType, storedExtension) => {
      const response = await multipartExpense()
        .attach('receipt', bytes, { filename: fileName, contentType: mimeType })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.receiptFileName).toBe(fileName);
      const receipt = store.receipts.find(
        (item) => item.expenseId === response.body.data.id,
      );
      expect(receipt).toMatchObject({
        originalName: fileName,
        mimeType,
        size: bytes.length,
      });
      expect(receipt?.storageName).toMatch(STORAGE_NAME);
      expect(receipt?.storageName.endsWith(storedExtension)).toBe(true);
      expect(receipt?.storageName).not.toBe(fileName);
      expect(existsSync(join(uploadDirectory, receipt!.storageName))).toBe(true);
    },
  );

  it('rejects an oversized receipt before final storage', async () => {
    const filesBefore = storedFiles();
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1, 0);
    JPEG.copy(oversized, 0);

    const response = await multipartExpense()
      .attach('receipt', oversized, {
        filename: 'oversized.jpg',
        contentType: 'image/jpeg',
      })
      .expect(413);

    expect(response.body.success).toBe(false);
    expect(response.body.requestId).toBe(response.headers['x-request-id']);
    expect(storedFiles()).toEqual(filesBefore);
  });

  it('rejects unsupported files without writing them', async () => {
    const filesBefore = storedFiles();
    await multipartExpense()
      .attach('receipt', Buffer.from('executable-content'), {
        filename: 'malware.exe',
        contentType: 'application/octet-stream',
      })
      .expect(400);
    expect(storedFiles()).toEqual(filesBefore);
  });

  it('rejects MIME, extension, and signature spoofing', async () => {
    const filesBefore = storedFiles();
    const response = await multipartExpense()
      .attach('receipt', Buffer.from('plain text'), {
        filename: 'invoice.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);

    expect(response.body.message).toContain('contents do not match');
    expect(storedFiles()).toEqual(filesBefore);
  });

  it('keeps legacy JSON expense creation compatible', async () => {
    const response = await request(app.getHttpServer())
      .post('/expenses')
      .set('role', 'user')
      .send(expensePayload())
      .expect(201);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        merchant: 'Receipt Test Merchant',
        amount: 1250.5,
        receiptFileName: '',
      },
    });
    expect(
      store.receipts.find((item) => item.expenseId === response.body.data.id),
    ).toBeUndefined();
  });

  it('requires a receipt for multipart Submitter creation', async () => {
    const response = await multipartExpense().expect(400);
    expect(response.body.message).toBe('Receipt upload is required.');
  });

  it('removes a staged file when expense business validation fails', async () => {
    const filesBefore = storedFiles();
    await multipartExpense({ employeeId: 'UNKNOWN-EMPLOYEE' })
      .attach('receipt', PDF, {
        filename: 'rollback.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);
    expect(storedFiles()).toEqual(filesBefore);
  });

  it('downloads the original bytes with safe response headers', async () => {
    const expense = findExpenseByReceiptName('Quarterly Invoice.pdf');
    const response = await request(app.getHttpServer())
      .get(`/expenses/${expense.id}/receipt`)
      .set('role', 'admin')
      .expect(200);

    expect(response.headers['content-type']).toMatch(/^application\/pdf/);
    expect(response.headers['content-disposition']).toContain(
      'filename="Quarterly Invoice.pdf"',
    );
    expect(response.headers['content-disposition']).not.toMatch(/[\r\n]/);
    expect(Buffer.from(response.body)).toEqual(PDF);
  });

  it('returns a correlated 404 for an existing expense without a receipt', async () => {
    const expense = store.expenses.find(
      (item) => item.receiptFileName === '' && !store.receipts.some((receipt) => receipt.expenseId === item.id),
    );
    expect(expense).toBeDefined();

    const response = await request(app.getHttpServer())
      .get(`/expenses/${expense!.id}/receipt`)
      .set('role', 'user')
      .expect(404);
    expect(response.body).toMatchObject({
      success: false,
      message: 'Receipt not found.',
      requestId: response.headers['x-request-id'],
    });
  });

  it('keeps suspicious original paths inside storage and sanitizes metadata', async () => {
    const response = await multipartExpense()
      .attach('receipt', PDF, {
        filename: '..\\..\\invoice.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const receipt = store.receipts.find(
      (item) => item.expenseId === response.body.data.id,
    );

    expect(response.body.data.receiptFileName).toBe('invoice.pdf');
    expect(receipt?.storageName).toMatch(STORAGE_NAME);
    expect(join(uploadDirectory, receipt!.storageName).startsWith(uploadDirectory)).toBe(
      true,
    );
    await request(app.getHttpServer())
      .delete(`/expenses/${response.body.data.id}`)
      .set('role', 'user')
      .expect(200);
  });

  it('deletes receipt metadata and physical storage with its expense', async () => {
    const expense = findExpenseByReceiptName('receipt.jpeg');
    const receipt = store.receipts.find((item) => item.expenseId === expense.id)!;
    const receiptPath = join(uploadDirectory, receipt.storageName);
    expect(existsSync(receiptPath)).toBe(true);

    await request(app.getHttpServer())
      .delete(`/expenses/${expense.id}`)
      .set('role', 'user')
      .expect(200);

    expect(existsSync(receiptPath)).toBe(false);
    expect(store.receipts.some((item) => item.expenseId === expense.id)).toBe(
      false,
    );
  });

  function multipartExpense(overrides: Partial<ExpenseRecord> = {}) {
    const payload = expensePayload(overrides);
    let testRequest = request(app.getHttpServer())
      .post('/expenses')
      .set('role', 'user');
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        testRequest = testRequest.field(key, String(value));
      }
    });
    return testRequest;
  }

  function expensePayload(overrides: Partial<ExpenseRecord> = {}) {
    const category = store.categories[0];
    return {
      employeeId: 'EMP-1001',
      organizationId: category.organizationId,
      managerEmployeeId: 'MGR-2001',
      amount: 1250.5,
      currency: 'INR',
      categoryId: category.id,
      merchant: 'Receipt Test Merchant',
      date: '2026-08-23',
      notes: 'Receipt upload e2e test',
      paymentMethod: 'personal-card',
      ...overrides,
    };
  }

  function storedFiles(): string[] {
    return readdirSync(uploadDirectory).sort();
  }

  function findExpenseByReceiptName(receiptFileName: string): ExpenseRecord {
    const expense = store.expenses.find(
      (item) => item.receiptFileName === receiptFileName,
    );
    if (!expense) throw new Error(`Missing test expense for ${receiptFileName}.`);
    return expense;
  }
});
