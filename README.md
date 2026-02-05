# Expense, Reconciliation & Compliance Management System

## Domain
**FinTech**

## 1. Problem Statement

In many organizations, employee expense handling is still partially manual and fragmented.  
Expenses are submitted through emails or spreadsheets, approvals vary across managers, payments are delayed, and tracking compliance or audit trails becomes difficult.

There is a need for a **centralized system** that manages the **complete expense lifecycle** in a structured, transparent, and auditable manner.

This project focuses on designing an **Expense, Reconciliation, and Compliance Management System** that covers expense submission, approval, payment processing, reconciliation, and audit logging.


## 2. Identified Actors

The system involves the following actors:

1. **Expense Submitter**
2. **Manager**
3. **Finance Officer**
4. **Compliance Officer**
5. **Configuration Manager**
6. **Bank (External System)**


## 3. Planned Features by Actors

### 3.1 Expense Submitter  
The expense submitter is responsible for submitting and tracking expenses.

**Planned Features:**
- Log in using organization ID, employee ID, and password.  
- Submit expenses with required details and receipts  
- View submitted expenses  
- Track expense status (submitted, approved, rejected, paid)  
- Receive notifications related to expense progress  

---

### 3.2 Manager  
The manager performs **business-level review** of expenses.

**Planned Features:**
- View expenses submitted by team members  
- Review expense details and attached receipts  
- Approve expenses that are business-relevant  
- Reject expenses with a clear reason  

---

### 3.3 Finance Officer  
The finance officer handles **payment initiation and reconciliation**.

**Planned Features:**
- View approved and compliant expenses  
- Initiate payment requests for reimbursements  
- Monitor payment status  
- Handle payment failures or mismatches  
- Resolve reconciliation issues when expense and payment data do not match  

---

### 3.4 Compliance Officer  
The compliance officer ensures adherence to **organizational expense policies**.

**Planned Features:**
- Define and update expense policies (limits, eligibility rules)  
- Review audit logs and compliance reports  
- Identify policy violations or misuse patterns  
- Trigger corrective actions or policy updates when required  

---

### 3.5 Configuration Manager
The configuration manager is responsible for **system setup and access control**.

**Planned Features:**
- Add, update, or deactivate employee accounts
- Assign roles (expense submitter, manager, finance officer, compliance officer)  
- Manage access permissions  
- Configure organization-level system settings  

---

### 3.6 Bank (External System)  
The bank is an external entity responsible for executing payments.

**Planned Interaction:**
- Receive payment instructions initiated by the system  
- Execute fund transfers  
- Return payment status and transaction details  
- Act as the source of truth for payment execution  

---

## 4. Key System Capabilities

- End-to-end expense lifecycle management  
- Clear separation of responsibilities between actors  
- Automated enforcement of compliance policies  
- Payment handling with reconciliation to manage uncertainty  
- Immutable audit logs for traceability and review  

---


