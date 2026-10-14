import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Expense, Prisma } from '@prisma/client';
import { ExpenseRecord, nowIso } from '../../data/store';
import { PrismaService } from '../../database/prisma.service';
import { appendAudit } from '../audit/tenant-audit-write';
import { auditActor } from '../audit/tenant-audit-context';
import { expenseWorkflowContext } from './expense-workflow-context';

@Injectable()
export class PersistentExpensesRepository {
  constructor(private readonly prisma: PrismaService) {}
  get db(): Prisma.TransactionClient {
    return expenseWorkflowContext.getStore()?.tx ?? this.prisma;
  }
  private context() {
    const context = expenseWorkflowContext.getStore();
    if (!context)
      throw new Error('Expense writes require an authenticated transaction.');
    return context;
  }
  async findAll(organizationId: string): Promise<ExpenseRecord[]> {
    const rows = await this.db.expense.findMany({
      where: { organizationId, deletedAt: null },
      include: { history: { orderBy: { sequence: 'asc' } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map((row) => this.dto(row));
  }
  async findById(
    id: string,
    organizationId: string,
  ): Promise<ExpenseRecord | null> {
    const row = await this.db.expense.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { history: { orderBy: { sequence: 'asc' } } },
    });
    return row ? this.dto(row) : null;
  }
  private dto(
    row: Expense & {
      history: Array<{ code: string; label: string; note: string; at: Date }>;
    },
  ): ExpenseRecord {
    const {
      details,
      deletedAt,
      submissionKey,
      submissionFingerprint,
      ...projection
    } = row;
    void deletedAt;
    void submissionKey;
    void submissionFingerprint;
    const dateInput = (details as Prisma.JsonObject).dateInput;
    return {
      ...(details as unknown as Partial<ExpenseRecord>),
      ...projection,
      amount: Number(row.amount),
      amountExact: row.amount.toFixed(2),
      date: typeof dateInput === 'string' ? dateInput : row.date.toISOString(),
      status: row.status as ExpenseRecord['status'],
      workflowStatus: row.workflowStatus as ExpenseRecord['workflowStatus'],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      history: row.history.map(({ code, label, note, at }) => ({
        code,
        label,
        note,
        at: at.toISOString(),
      })),
    } as ExpenseRecord;
  }
  private data(record: Omit<ExpenseRecord, 'id' | 'createdAt' | 'updatedAt'>) {
    const {
      employeeId,
      organizationId,
      managerEmployeeId,
      assignedFinanceOfficerId,
      categoryId,
      amount,
      currency,
      merchant,
      date,
      status,
      workflowStatus,
      notes,
      paymentMethod,
      receiptFileName,
      history,
      ...ignored
    } = record;
    void history;
    void ignored;
    // Explicit compatibility fields; never recursively store DB projections or request keys.
    const details = {
      dateInput: record.date,
      extraction_confidence: record.extraction_confidence,
      flag: record.flag,
      risk_score: record.risk_score,
      managerDecision: record.managerDecision,
      managerDecisionAt: record.managerDecisionAt,
      managerDecisionNote: record.managerDecisionNote,
      financeDecision: record.financeDecision,
      financeDecisionAt: record.financeDecisionAt,
      financeDecisionNote: record.financeDecisionNote,
      complianceDecision: record.complianceDecision,
      complianceDecisionAt: record.complianceDecisionAt,
      complianceDecisionNote: record.complianceDecisionNote,
      escalatedByManager: record.escalatedByManager,
      paidAt: record.paidAt,
    };
    const exact = new Prisma.Decimal(amount);
    if (
      !exact.isFinite() ||
      exact.lte(0) ||
      exact.decimalPlaces() > 2 ||
      exact.gt('999999999999.99')
    )
      throw new BadRequestException(
        'Amount must be positive, at most 999999999999.99, with at most two decimal places.',
      );
    if (
      !merchant.trim() ||
      merchant.length > 500 ||
      paymentMethod.length > 100 ||
      receiptFileName.length > 500
    )
      throw new BadRequestException('Invalid expense text fields.');
    if (!/^[A-Z]{3}$/.test(currency))
      throw new BadRequestException('Currency must be a three-letter code.');
    return {
      employeeId,
      organizationId,
      managerEmployeeId,
      assignedFinanceOfficerId,
      categoryId,
      amount: exact,
      currency,
      merchant,
      date: new Date(date),
      status,
      workflowStatus,
      notes,
      paymentMethod,
      receiptFileName,
      details: JSON.parse(JSON.stringify(details)) as Prisma.InputJsonObject,
    };
  }
  async create(record: Omit<ExpenseRecord, 'id' | 'createdAt' | 'updatedAt'>) {
    const { actor } = this.context();
    if (
      actor.organizationId !== record.organizationId ||
      actor.user.employeeId !== record.employeeId
    )
      throw new Error('Expense ownership mismatch.');
    const row = await this.db.expense.create({ data: this.data(record) });
    await this.history(row.id, record, null, 0);
    return (await this.findById(row.id, actor.organizationId))!;
  }
  async update(id: string, updates: Partial<ExpenseRecord>) {
    const { actor } = this.context();
    const before = await this.findById(id, actor.organizationId);
    if (!before) throw new NotFoundException('Expense not found.');
    const next = { ...before, ...updates };
    await this.db.expense.update({
      where: {
        organizationId_id: { organizationId: actor.organizationId, id },
      },
      data: this.data(next),
    });
    await this.history(id, next, before.workflowStatus, before.history.length);
    if (next.history.length === before.history.length)
      await appendAudit(
        this.db,
        actor.organizationId,
        'expense.updated',
        'expense',
        id,
        {
          workflowStatus: next.workflowStatus,
          before: {
            amount:
              before.amountExact ??
              new Prisma.Decimal(before.amount).toFixed(2),
            currency: before.currency,
            categoryId: before.categoryId,
          },
          after: {
            amount: new Prisma.Decimal(next.amount).toFixed(2),
            currency: next.currency,
            categoryId: next.categoryId,
          },
        },
        auditActor(actor),
      );
    return (await this.findById(id, actor.organizationId))!;
  }
  private async history(
    id: string,
    record: Omit<ExpenseRecord, 'id' | 'createdAt' | 'updatedAt'>,
    previous: string | null,
    offset: number,
  ) {
    const { actor } = this.context();
    for (let sequence = offset; sequence < record.history.length; sequence++) {
      const entry = record.history[sequence];
      await this.db.expenseStatusHistory.create({
        data: {
          organizationId: actor.organizationId,
          expenseId: id,
          sequence,
          actorUserId: actor.user.id,
          actorRole: actor.user.role,
          previousStatus: previous,
          newStatus: record.workflowStatus,
          ...entry,
          at: new Date(entry.at),
        },
      });
      await appendAudit(
        this.db,
        actor.organizationId,
        'expense.' + entry.code,
        'expense',
        id,
        {
          previousStatus: previous,
          newStatus: record.workflowStatus,
          sequence,
          amount: new Prisma.Decimal(record.amount).toFixed(2),
          currency: record.currency,
          managerEmployeeId: record.managerEmployeeId,
          assignedFinanceOfficerId: record.assignedFinanceOfficerId,
        },
        auditActor(actor),
      );
    }
  }
  async delete(id: string) {
    const { actor } = this.context();
    await this.db.expense.update({
      where: {
        organizationId_id: { organizationId: actor.organizationId, id },
      },
      data: { deletedAt: new Date() },
    });
    await appendAudit(
      this.db,
      actor.organizationId,
      'expense.deleted',
      'expense',
      id,
      { deletedAt: nowIso() },
      auditActor(actor),
    );
  }
}
