import {
	pgTable,
	serial,
	text,
	integer,
	timestamp,
	boolean,
	date,
	numeric,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Budget category types (Korean labels)
export const BUDGET_TYPES = {
	event: '경조사비',
	cultural: '문화/여행비',
	savings: '저축',
	living: '생활비'
} as const;

export type BudgetType = keyof typeof BUDGET_TYPES;

// Bank accounts for deposits
export const bankAccounts = pgTable('bank_accounts', {
	id: serial('id').primaryKey(),
	bankName: text('bank_name').notNull(), // 은행명 (신한, 국민, 카카오뱅크 등)
	accountNumber: text('account_number').notNull(), // 계좌번호
	accountHolder: text('account_holder').notNull(), // 예금주
	alias: text('alias'), // 별칭 (생활비 통장, 저축 통장 등)
	createdAt: timestamp('created_at').defaultNow()
});

export const users = pgTable('users', {
	id: serial('id').primaryKey(),
	kakaoId: text('kakao_id').unique().notNull(),
	username: text('username').notNull(),
	email: text('email'),
	role: text('role', { enum: ['admin', 'user'] }).default('user'),
	isApproved: boolean('is_approved').default(false).notNull(),
	defaultDeduction: numeric('default_deduction', { precision: 12, scale: 2 }).default('0'), // 기본 차감액 (카드값, 보험료 등)
	// 정산 입금받을 계좌 정보
	bankName: text('bank_name'),
	accountNumber: text('account_number'),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at').defaultNow()
});

export const budgetCategories = pgTable('budget_categories', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	type: text('type', { enum: ['event', 'cultural', 'savings', 'living'] }).notNull(),
	allocatedAmount: numeric('allocated_amount', { precision: 12, scale: 2 }).notNull().default('0'),
	initialBalance: numeric('initial_balance', { precision: 12, scale: 2 }).notNull().default('0'), // 초기 잔액 (기존 잔액 보정용)
	userId: integer('user_id').references(() => users.id),
	accountId: integer('account_id').references(() => bankAccounts.id), // 입금 계좌
	depositManager: text('deposit_manager'), // 입금 담당자
	createdAt: timestamp('created_at').defaultNow()
});

export const paymentMethods = pgTable('payment_methods', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(), // 'Cash', 'Card', custom names
	userId: integer('user_id').references(() => users.id),
	linkedAccount: text('linked_account').notNull(), // Required: linked bank account
	owner: text('owner'), // 소유자 (권혁상 or 이현경)
	isDefault: boolean('is_default').default(false),
	createdAt: timestamp('created_at').defaultNow()
});

export const expenses = pgTable('expenses', {
	id: serial('id').primaryKey(),
	description: text('description').notNull(),
	amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
	date: date('date').notNull(),
	userId: integer('user_id')
		.references(() => users.id)
		.notNull(),
	categoryId: integer('category_id').references(() => budgetCategories.id),
	paymentMethodId: integer('payment_method_id').references(() => paymentMethods.id),
	isOfflineSync: boolean('is_offline_sync').default(false), // Flag for offline-synced expenses
	createdAt: timestamp('created_at').defaultNow()
});

// Monthly deposits tracking
export const monthlyDeposits = pgTable(
	'monthly_deposits',
	{
		id: serial('id').primaryKey(),
		userId: integer('user_id')
			.references(() => users.id)
			.notNull(),
		month: date('month').notNull(), // First day of the month (e.g., 2024-01-01)
		salary: numeric('salary', { precision: 12, scale: 2 }).notNull(),
		totalBudget: numeric('total_budget', { precision: 12, scale: 2 }).notNull(),
		savingsAmount: numeric('savings_amount', { precision: 12, scale: 2 }).notNull(), // Auto-calculated: salary - totalBudget
		isCompleted: boolean('is_completed').default(false),
		depositedAt: timestamp('deposited_at'),
		createdAt: timestamp('created_at').defaultNow()
	},
	(table) => [uniqueIndex('monthly_deposits_user_month_idx').on(table.userId, table.month)]
);

// Individual deposit items per category
export const depositItems = pgTable('deposit_items', {
	id: serial('id').primaryKey(),
	depositId: integer('deposit_id')
		.references(() => monthlyDeposits.id)
		.notNull(),
	categoryId: integer('category_id')
		.references(() => budgetCategories.id)
		.notNull(),
	amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
	isCompleted: boolean('is_completed').default(false),
	completedAt: timestamp('completed_at'),
	createdAt: timestamp('created_at').defaultNow()
});

// Expense settlement items (지출 정산 - 계좌 담당자가 지출자에게 송금)
export const expenseSettlements = pgTable('expense_settlements', {
	id: serial('id').primaryKey(),
	month: date('month').notNull(), // 정산 대상월
	categoryId: integer('category_id')
		.references(() => budgetCategories.id)
		.notNull(),
	fromUser: text('from_user').notNull(), // 송금자 (예산 계좌 담당자)
	toUser: text('to_user').notNull(), // 수신자 (지출한 사람)
	amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
	isCompleted: boolean('is_completed').default(false),
	completedAt: timestamp('completed_at'),
	createdAt: timestamp('created_at').defaultNow()
});

// 사용자별 카테고리 입금 계좌 (지출 정산 시 받을 계좌)
export const userCategoryAccounts = pgTable(
	'user_category_accounts',
	{
		id: serial('id').primaryKey(),
		username: text('username').notNull(), // 사용자명
		categoryId: integer('category_id')
			.references(() => budgetCategories.id)
			.notNull(),
		accountId: integer('account_id')
			.references(() => bankAccounts.id)
			.notNull(), // 계좌 관리에서 등록된 계좌
		createdAt: timestamp('created_at').defaultNow(),
		updatedAt: timestamp('updated_at').defaultNow()
	},
	(table) => [uniqueIndex('user_category_accounts_idx').on(table.username, table.categoryId)]
);

// Offline pending expenses (for PWA sync)
export const pendingExpenses = pgTable('pending_expenses', {
	id: serial('id').primaryKey(),
	localId: text('local_id').notNull(), // Client-side UUID
	userId: integer('user_id')
		.references(() => users.id)
		.notNull(),
	description: text('description').notNull(),
	amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
	date: date('date').notNull(),
	categoryId: integer('category_id'),
	paymentMethodId: integer('payment_method_id'),
	syncedAt: timestamp('synced_at'),
	createdAt: timestamp('created_at').defaultNow()
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
	expenses: many(expenses),
	paymentMethods: many(paymentMethods),
	budgets: many(budgetCategories),
	monthlyDeposits: many(monthlyDeposits),
	pendingExpenses: many(pendingExpenses)
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
	user: one(users, {
		fields: [expenses.userId],
		references: [users.id]
	}),
	category: one(budgetCategories, {
		fields: [expenses.categoryId],
		references: [budgetCategories.id]
	}),
	paymentMethod: one(paymentMethods, {
		fields: [expenses.paymentMethodId],
		references: [paymentMethods.id]
	})
}));

export const bankAccountsRelations = relations(bankAccounts, ({ many }) => ({
	budgetCategories: many(budgetCategories)
}));

export const budgetCategoriesRelations = relations(budgetCategories, ({ one, many }) => ({
	user: one(users, {
		fields: [budgetCategories.userId],
		references: [users.id]
	}),
	account: one(bankAccounts, {
		fields: [budgetCategories.accountId],
		references: [bankAccounts.id]
	}),
	expenses: many(expenses),
	depositItems: many(depositItems)
}));

export const paymentMethodsRelations = relations(paymentMethods, ({ one, many }) => ({
	user: one(users, {
		fields: [paymentMethods.userId],
		references: [users.id]
	}),
	expenses: many(expenses)
}));

export const monthlyDepositsRelations = relations(monthlyDeposits, ({ one, many }) => ({
	user: one(users, {
		fields: [monthlyDeposits.userId],
		references: [users.id]
	}),
	items: many(depositItems)
}));

export const depositItemsRelations = relations(depositItems, ({ one }) => ({
	deposit: one(monthlyDeposits, {
		fields: [depositItems.depositId],
		references: [monthlyDeposits.id]
	}),
	category: one(budgetCategories, {
		fields: [depositItems.categoryId],
		references: [budgetCategories.id]
	})
}));

export const pendingExpensesRelations = relations(pendingExpenses, ({ one }) => ({
	user: one(users, {
		fields: [pendingExpenses.userId],
		references: [users.id]
	})
}));

export const expenseSettlementsRelations = relations(expenseSettlements, ({ one }) => ({
	category: one(budgetCategories, {
		fields: [expenseSettlements.categoryId],
		references: [budgetCategories.id]
	})
}));

export const userCategoryAccountsRelations = relations(userCategoryAccounts, ({ one }) => ({
	category: one(budgetCategories, {
		fields: [userCategoryAccounts.categoryId],
		references: [budgetCategories.id]
	}),
	account: one(bankAccounts, {
		fields: [userCategoryAccounts.accountId],
		references: [bankAccounts.id]
	})
}));
