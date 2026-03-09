# Expense, Reconciliation & Compliance Management System

## Domain
**FinTech**

## 1. Problem Statement

In many organizations, employee expense handling is still partially manual and fragmented.  
Expenses are submitted through emails or spreadsheets, approvals vary across managers, payments are delayed, and tracking compliance or audit trails becomes difficult.

There is a need for a **centralized system** that manages the **complete expense lifecycle** in a structured, transparent, and auditable manner.

This project focuses on designing an **Expense, Reconciliation, and Compliance Management System** that covers expense submission, approval, payment processing, reconciliation, and audit logging.

The system also incorporates intelligent validation mechanisms such as receipt data extraction, duplicate detection, and risk-based evaluation of expenses. These capabilities assist users in identifying potential policy violations and reduce manual verification effort while keeping final decisions under human control.


## 2. Identified Actors

The system involves the following actors:

1. **Expense Submitter**
2. **Manager**
3. **Finance Officer**
4. **Compliance Officer**
5. **Configuration Manager**
6. **External Bank**


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
- Review cross validation results and risk scores flagged by the system  
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
- Assign roles to users (expense submitter, manager, finance officer, compliance officer)
- Enable or disable specific roles for the organization depending on operational needs.
- Configure organization-level policies and system settings
- Manage access permissions

---

### 3.6 External Bank 
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

## 5. System Architecture Overview

The system follows a multi-tenant architecture where multiple organizations can use the platform while maintaining complete data isolation.

Key characteristics:

- Each organization is assigned a unique **Organization ID (OrgID)**.
- All system data is associated with the organization identifier.
- Users, policies, and workflows are managed independently per organization.
- Role-based access control ensures that users only access functions relevant to their assigned roles.
- Organizational workflows adapt dynamically depending on which roles are enabled.

## 6. Intelligent Validation Features

To assist users and reduce manual verification effort, the system includes automated validation mechanisms:

- **Receipt Data Extraction**  
  Uploaded receipts are processed using OCR to extract structured information such as vendor name, invoice number, date, and amount.

- **Cross Validation** 
  Extracted receipt data is compared with user-entered expense details to identify inconsistencies.

- **Duplicate Detection**  
  The system checks for repeated invoice numbers and similar receipt images to detect duplicate submissions.

- **Risk Scoring**  
  Each expense is assigned a risk score based on detected anomalies, policy violations, and historical patterns.

These features assist managers and finance officers in identifying suspicious or non-compliant expenses while keeping the final decision under human control.

## 7. Expense Processing Workflow

The expense lifecycle in the system follows the sequence below:

         Expense Submission  
                  ↓  
Receipt Processing and OCR Data Extraction  
                  ↓  
Cross Validation and Duplicate Detection  
                  ↓  
         Policy Validation  
                  ↓  
            Risk Scoring  
                  ↓  
           Manager Review  
                  ↓  
      Compliance Review (if required)  
                  ↓  
         Finance Processing  
                  ↓  
    Payment Execution through Bank  
                  ↓  
         Bank Reconciliation  
                  ↓  
          Expense Closure

Each stage of the workflow is recorded in the audit log to ensure transparency and traceability.

---

