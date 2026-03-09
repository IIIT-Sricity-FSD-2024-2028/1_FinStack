CREATE DATABASE expense_management;
USE expense_management;


CREATE TABLE Organization (
    org_id CHAR(36) PRIMARY KEY,
    org_name VARCHAR(255) NOT NULL,
    org_email VARCHAR(255) UNIQUE NOT NULL,
    org_country VARCHAR(100),

    default_currency VARCHAR(10) DEFAULT 'INR',
    timezone VARCHAR(50),

    org_status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Roles (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_mandatory BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE OrganizationRoles (
    org_id CHAR(36) NOT NULL,
    role_id INT NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (org_id, role_id),
    FOREIGN KEY (org_id) REFERENCES Organization(org_id),
    FOREIGN KEY (role_id) REFERENCES Roles(role_id)
);

CREATE TABLE Users (
    user_id CHAR(36) PRIMARY KEY,
    org_id CHAR(36) NOT NULL,

    employee_id VARCHAR(50),

    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,

    password_hash TEXT NOT NULL,

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (org_id) REFERENCES Organization(org_id),

    UNIQUE (org_id, email),
    
    UNIQUE (org_id, employee_id)
);

CREATE TABLE UserRoles (
    user_role_id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    role_id INT NOT NULL,

    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (role_id) REFERENCES Roles(role_id),

    UNIQUE (user_id, role_id)
);

CREATE TABLE UserHierarchy (
    user_id CHAR(36) PRIMARY KEY,
    manager_id CHAR(36),
    org_id CHAR(36),

    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (manager_id) REFERENCES Users(user_id),
    FOREIGN KEY (org_id) REFERENCES Organization(org_id)
);

CREATE TABLE ExpenseCategory (
    category_id CHAR(36) PRIMARY KEY,
    org_id CHAR(36) NOT NULL,

    category_name VARCHAR(100) NOT NULL,
    description TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (org_id) REFERENCES Organization(org_id),

    UNIQUE (org_id, category_name)
);

CREATE TABLE ExpensePolicy (
    policy_id CHAR(36) PRIMARY KEY,
    org_id CHAR(36) NOT NULL,
    category_id CHAR(36) NOT NULL,

    spending_limit DECIMAL(12,2),
    currency VARCHAR(10) DEFAULT 'INR',

    receipt_required BOOLEAN DEFAULT TRUE,
    approval_levels INT DEFAULT 1,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (org_id) REFERENCES Organization(org_id),
    FOREIGN KEY (category_id) REFERENCES ExpenseCategory(category_id),

    UNIQUE (org_id, category_id)
);

CREATE TABLE Expense (
    expense_id CHAR(36) PRIMARY KEY,
    org_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    category_id CHAR(36) NOT NULL,
    policy_id CHAR(36),

    reference_code VARCHAR(50) UNIQUE,

    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',

    description TEXT,
    expense_date DATE,

    status VARCHAR(50) DEFAULT 'SUBMITTED'
        CHECK (status IN (
            'SUBMITTED',
            'UNDER_REVIEW',
            'APPROVED',
            'REJECTED',
            'PAYMENT_INITIATED',
            'PAID'
        )),

    risk_score INT CHECK (risk_score BETWEEN 0 AND 100),

    is_exception BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,

    FOREIGN KEY (org_id) REFERENCES Organization(org_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (category_id) REFERENCES ExpenseCategory(category_id),
    FOREIGN KEY (policy_id) REFERENCES ExpensePolicy(policy_id)
);

CREATE TABLE Receipt (
    receipt_id CHAR(36) PRIMARY KEY,
    expense_id CHAR(36) UNIQUE NOT NULL,

    file_path TEXT NOT NULL,
    file_type VARCHAR(20),
    file_size INT,

    receipt_hash VARCHAR(255),

    extracted_vendor VARCHAR(255),
    extracted_invoice_no VARCHAR(255),
    extracted_amount DECIMAL(12,2),
    extracted_date DATE,

    extraction_confidence DECIMAL(5,2),

    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (expense_id) REFERENCES Expense(expense_id)
);

CREATE TABLE AIValidationResult (
    validation_id CHAR(36) PRIMARY KEY,
    expense_id CHAR(36) NOT NULL,

    amount_match BOOLEAN,
    date_match BOOLEAN,

    duplicate_invoice_detected BOOLEAN,
    duplicate_receipt_detected BOOLEAN,

    receipt_quality_valid BOOLEAN,

    validation_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (expense_id) REFERENCES Expense(expense_id),

    UNIQUE (expense_id)
);

CREATE TABLE ExpenseFlag (
    flag_id CHAR(36) PRIMARY KEY,
    expense_id CHAR(36) NOT NULL,

    flag_type VARCHAR(50)
        CHECK (flag_type IN (
            'LOW_OCR_CONFIDENCE',
            'AMOUNT_MISMATCH',
            'DATE_MISMATCH',
            'DUPLICATE_INVOICE',
            'DUPLICATE_RECEIPT',
            'POLICY_LIMIT_EXCEEDED',
            'MISSING_RECEIPT',
            'HIGH_RISK_SCORE',
            'MANUAL_COMPLIANCE_FLAG',
            'RECONCILIATION_MISMATCH'
        )),

    severity VARCHAR(20)
        CHECK (severity IN (
            'LOW',
            'MEDIUM',
            'HIGH'
        )),

    created_by CHAR(36),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (expense_id) REFERENCES Expense(expense_id),
    FOREIGN KEY (created_by) REFERENCES Users(user_id)
);


CREATE TABLE ExpenseApprovalHistory (
    approval_id CHAR(36) PRIMARY KEY,
    expense_id CHAR(36) NOT NULL,
    reviewer_id CHAR(36) NOT NULL,
    role_id INT NOT NULL,

    action VARCHAR(50)
        CHECK (action IN (
            'APPROVED',
            'REJECTED',
            'ESCALATED',
            'RETURNED'
        )),

    comments TEXT,

    previous_status VARCHAR(50)
        CHECK (previous_status IN (
            'SUBMITTED',
            'UNDER_REVIEW',
            'APPROVED',
            'REJECTED',
            'PAYMENT_INITIATED',
            'PAID'
        )),

    new_status VARCHAR(50)
        CHECK (new_status IN (
            'SUBMITTED',
            'UNDER_REVIEW',
            'APPROVED',
            'REJECTED',
            'PAYMENT_INITIATED',
            'PAID'
        )),

    reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (expense_id) REFERENCES Expense(expense_id),
    FOREIGN KEY (reviewer_id) REFERENCES Users(user_id),
    FOREIGN KEY (role_id) REFERENCES Roles(role_id)
);

CREATE TABLE UserBankAccount (
    bank_account_id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    org_id CHAR(36) NOT NULL,

    account_holder_name VARCHAR(255),
    account_number VARCHAR(50),
    ifsc_code VARCHAR(20),
    bank_name VARCHAR(255),

    is_primary BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (org_id) REFERENCES Organization(org_id)
);

CREATE TABLE BankTransaction (
    transaction_id CHAR(36) PRIMARY KEY,
    org_id CHAR(36) NOT NULL,

    bank_reference VARCHAR(255),
    amount DECIMAL(12,2),
    currency VARCHAR(10),

    transaction_date TIMESTAMP,

    payer_account VARCHAR(50),
    beneficiary_account VARCHAR(50),

    description TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (org_id) REFERENCES Organization(org_id)
);

CREATE TABLE Payment (
    payment_id CHAR(36) PRIMARY KEY,
    expense_id CHAR(36) UNIQUE NOT NULL,
    org_id CHAR(36) NOT NULL,
    initiated_by CHAR(36) NOT NULL,

    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(10),

    bank_account_id CHAR(36),

    payment_status VARCHAR(50) DEFAULT 'INITIATED'
        CHECK (payment_status IN (
            'INITIATED',
            'PROCESSING',
            'SUCCESS',
            'FAILED',
            'REVERSED'
        )),

    bank_transaction_id CHAR(36),

    initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,

    FOREIGN KEY (expense_id) REFERENCES Expense(expense_id),
    FOREIGN KEY (org_id) REFERENCES Organization(org_id),
    FOREIGN KEY (initiated_by) REFERENCES Users(user_id),
    FOREIGN KEY (bank_account_id) REFERENCES UserBankAccount(bank_account_id),
    FOREIGN KEY (bank_transaction_id) REFERENCES BankTransaction(transaction_id)
);

CREATE TABLE Reconciliation (
    reconciliation_id CHAR(36) PRIMARY KEY,
    payment_id CHAR(36) NOT NULL,
    bank_transaction_id CHAR(36),

    match_status VARCHAR(50)
        CHECK (match_status IN (
            'MATCHED',
            'UNMATCHED',
            'MANUAL_REVIEW'
        )),

    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,

    FOREIGN KEY (payment_id) REFERENCES Payment(payment_id),
    FOREIGN KEY (bank_transaction_id) REFERENCES BankTransaction(transaction_id)
);


CREATE TABLE AuditLog (
    log_id CHAR(36) PRIMARY KEY,
    org_id CHAR(36) NOT NULL,
    user_id CHAR(36),

    entity_type VARCHAR(100),
    entity_id CHAR(36),
	
    action VARCHAR(100),

    old_value JSON,
    new_value JSON,

    ip_address VARCHAR(45),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (org_id) REFERENCES Organization(org_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);
