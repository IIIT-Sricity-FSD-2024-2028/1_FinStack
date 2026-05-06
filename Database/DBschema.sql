CREATE DATABASE FinStack;
USE FinStack;


CREATE TABLE Organizations (
    org_id INT AUTO_INCREMENT PRIMARY KEY,
    org_name VARCHAR(100) NOT NULL,
    org_email VARCHAR(100) UNIQUE NOT NULL,
    org_country VARCHAR(100),
    default_currency VARCHAR(10) DEFAULT 'INR',
    timezone VARCHAR(50),
    org_status VARCHAR(30) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Roles (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(80) NOT NULL UNIQUE,
    description TEXT,
    is_mandatory BOOLEAN DEFAULT FALSE,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    department VARCHAR(100),
    phone VARCHAR(20),
    location VARCHAR(100),
    password_hash VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (org_id) REFERENCES Organizations(org_id),
    UNIQUE (org_id, email)
);

CREATE TABLE Account_Requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    requested_role_id INT NOT NULL,
    message TEXT,
    status VARCHAR(30) DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    decided_at TIMESTAMP NULL,

    FOREIGN KEY (org_id) REFERENCES Organizations(org_id),
    FOREIGN KEY (requested_role_id) REFERENCES Roles(role_id)
);

CREATE TABLE Expense_Categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (org_id) REFERENCES Organizations(org_id)
);

CREATE TABLE Expense_Policies (
    policy_id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    category_id INT NOT NULL,
    policy_name VARCHAR(100) NOT NULL,
    spending_limit DECIMAL(12,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    receipt_required BOOLEAN DEFAULT TRUE,
    approval_levels INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (org_id) REFERENCES Organizations(org_id),
    FOREIGN KEY (category_id) REFERENCES Expense_Categories(category_id)
);

CREATE TABLE Expenses (
    expense_id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    user_id INT NOT NULL,
    category_id INT,
    policy_id INT,
    assigned_finance_officer_id INT,
    merchant VARCHAR(100) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    description TEXT,
    expense_date DATE NOT NULL,
    risk_score INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Submitted',
    workflow_status VARCHAR(50) DEFAULT 'Manager Review',
    is_exception BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (assigned_finance_officer_id) REFERENCES Users(user_id),
    FOREIGN KEY (org_id) REFERENCES Organizations(org_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (category_id) REFERENCES Expense_Categories(category_id),
    FOREIGN KEY (policy_id) REFERENCES Expense_Policies(policy_id),

    CHECK (amount > 0),
    CHECK (risk_score BETWEEN 0 AND 100)
);

CREATE TABLE Payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    expense_id INT NOT NULL,
    org_id INT NOT NULL,
    initiated_by INT,
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    payment_status VARCHAR(50) DEFAULT 'Pending',
    initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (expense_id) REFERENCES Expenses(expense_id),
    FOREIGN KEY (org_id) REFERENCES Organizations(org_id),
    FOREIGN KEY (initiated_by) REFERENCES Users(user_id)
);

CREATE TABLE Bank_Transactions (
    transaction_id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    bank_reference VARCHAR(100),
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    transaction_date DATE,
    payer_account VARCHAR(100),
    beneficiary_account VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (org_id) REFERENCES Organizations(org_id)
);


CREATE TABLE Organization_Roles (
    org_id INT NOT NULL,
    role_id INT NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (org_id, role_id),

    FOREIGN KEY (org_id) REFERENCES Organizations(org_id),
    FOREIGN KEY (role_id) REFERENCES Roles(role_id)
);

CREATE TABLE User_Roles (
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, role_id),

    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (role_id) REFERENCES Roles(role_id)
);

CREATE TABLE User_Hierarchy (
    user_id INT NOT NULL,
    manager_id INT NOT NULL,
    org_id INT NOT NULL,

    PRIMARY KEY (user_id, manager_id),

    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (manager_id) REFERENCES Users(user_id),
    FOREIGN KEY (org_id) REFERENCES Organizations(org_id)
);


CREATE TABLE Receipts (
    receipt_id INT AUTO_INCREMENT PRIMARY KEY,
    expense_id INT NOT NULL,
    file_path VARCHAR(255),
    file_type VARCHAR(50),
    file_size INT,
    extracted_vendor VARCHAR(100),
    extracted_amount DECIMAL(12,2),
    extracted_date DATE,
    extraction_confidence INT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (expense_id) REFERENCES Expenses(expense_id),

    CHECK (extraction_confidence BETWEEN 0 AND 100)
);

CREATE TABLE AI_Validation_Results (
    validation_id INT AUTO_INCREMENT PRIMARY KEY,
    expense_id INT NOT NULL,
    amount_match BOOLEAN DEFAULT TRUE,
    date_match BOOLEAN DEFAULT TRUE,
    duplicate_invoice_detected BOOLEAN DEFAULT FALSE,
    duplicate_receipt_detected BOOLEAN DEFAULT FALSE,
    receipt_quality_valid BOOLEAN DEFAULT TRUE,
    validation_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (expense_id) REFERENCES Expenses(expense_id)
);

CREATE TABLE Expense_Flags (
    flag_id INT AUTO_INCREMENT PRIMARY KEY,
    expense_id INT NOT NULL,
    flag_type VARCHAR(50) NOT NULL,
    severity VARCHAR(30),
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (expense_id) REFERENCES Expenses(expense_id),
    FOREIGN KEY (created_by) REFERENCES Users(user_id)
);

CREATE TABLE Expense_Approval_History (
    approval_id INT AUTO_INCREMENT PRIMARY KEY,
    expense_id INT NOT NULL,
    reviewer_id INT NOT NULL,
    role_id INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    comments TEXT,
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (expense_id) REFERENCES Expenses(expense_id),
    FOREIGN KEY (reviewer_id) REFERENCES Users(user_id),
    FOREIGN KEY (role_id) REFERENCES Roles(role_id)
);

CREATE TABLE Expense_Status_History (
    status_history_id INT AUTO_INCREMENT PRIMARY KEY,
    expense_id INT NOT NULL,
    status_label VARCHAR(100) NOT NULL,
    note TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (expense_id) REFERENCES Expenses(expense_id)
);

CREATE TABLE Reconciliations (
    reconciliation_id INT AUTO_INCREMENT PRIMARY KEY,
    payment_id INT NOT NULL,
    transaction_id INT NOT NULL,
    match_status VARCHAR(50) DEFAULT 'Pending',
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,

    FOREIGN KEY (payment_id) REFERENCES Payments(payment_id),
    FOREIGN KEY (transaction_id) REFERENCES Bank_Transactions(transaction_id)
);

CREATE TABLE Audit_Logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT NOT NULL,
    user_id INT,
    entity_type VARCHAR(80),
    entity_id VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (org_id) REFERENCES Organizations(org_id),
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);
