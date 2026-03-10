# Finstack --- Figma Prototype Design Documentation

## 1. Introduction

This document describes the UI/UX prototype design of **Finstack**, an
Expense Reconciliation and Compliance Management Platform. The prototype
was designed in **Figma** to represent the full workflow and interfaces
used by different actors in the system.

The goal of the prototype is to demonstrate: - Application structure -
Interaction flow between actors - Page layouts and components - Overall
user experience

The design follows modern SaaS dashboard principles inspired by tools
like **Ramp, Expensify, Stripe Dashboard, and Brex**.

------------------------------------------------------------------------

## 2. Design Goals

### Clarity

Users should easily understand navigation and available actions.

### Consistency

All actors share the same: - layout - typography - spacing - color
palette - component system

### Role-Based Interface

Each actor sees only the pages relevant to their responsibilities.

### Efficient Workflow

Expense lifecycle flow:

Expense Submission → Manager Approval → Finance Verification →
Compliance Review → Payment

------------------------------------------------------------------------

## 3. Actors in the System

  -----------------------------------------------------------------------
  Actor                               Role
  ----------------------------------- -----------------------------------
  Expense Submitter                   Submits and tracks expenses

  Manager                             Reviews and approves team expenses

  Finance Officer                     Verifies receipts and performs
                                      financial reconciliation

  Compliance Officer                  Ensures policy compliance

  Configuration Manager               Manages users, policies, and
                                      workflow

  External Bank                       Processes reimbursement payments
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 4. Global Design System

### Color Palette

  Purpose              Color
  -------------------- ---------
  Primary Background   #0B1F3A
  Primary Accent       #3B82F6
  Secondary Accent     #1E3A8A
  Success              #22C55E
  Warning              #F59E0B
  Error                #EF4444
  Card Background      #FFFFFF
  Page Background      #F5F7FB
  Primary Text         #111827
  Secondary Text       #6B7280

### Typography

Font: **Inter**

  Element          Size   Weight
  ---------------- ------ -----------
  Heading Large    24px   Bold
  Heading Medium   20px   Semi Bold
  Heading Small    18px   Medium
  Body Text        14px   Medium
  Labels           13px   Regular

### Spacing System

Spacing scale used:

4px, 8px, 12px, 16px, 24px, 32px, 48px

Layout rules: - Sidebar width: 260px - Card padding: 24px - Page margin:
32px - Grid spacing: 24px

------------------------------------------------------------------------

## 5. Expense Submitter Interface

Pages: - Dashboard - Submit Expense - My Expenses - Notifications -
Settings

### Dashboard

Components: - Summary cards (Total Expenses, Approved, Rejected,
Reimbursed) - Expense trend charts - Recent expenses table - Quick
action buttons

### Submit Expense

Features: - Receipt upload (drag and drop) - AI receipt extraction -
Editable expense fields - Policy violation alerts - Submit or exception
request

### My Expenses

Allows employees to: - View all submitted expenses - Filter by
status/date/category - Open expense details and receipt preview

------------------------------------------------------------------------

## 6. Manager Interface

Pages: - Dashboard - Submit Expense - My Expenses - Approvals - Team
Expenses - Notifications - Settings

### Approvals Page

Managers can: - Approve expenses - Reject expenses - Request corrections

### Team Expenses

Displays spending analytics for employees under the manager.

------------------------------------------------------------------------

## 7. Finance Officer Interface

Pages: - Dashboard - Expense Verification - Expense Review -
Reconciliation - Payments - Expense History - Submit Expense -
Notifications - Settings

### Expense Verification

Finance officers verify manager-approved expenses.

### Expense Review

Includes: - Receipt preview - AI extracted data - fraud detection
alerts - reconciliation information

### Payments

Handles reimbursement processing.

Statuses: Ready for Payment → Processing → Paid → Failed

------------------------------------------------------------------------

## 8. Compliance Officer Interface

Pages: - Dashboard - Compliance Review - Policy Violations - Audit
Trail - Reports - Submit Expense - My Expenses - Notifications -
Settings

Compliance officers monitor: - policy violations - high-risk expenses -
suspicious transactions

------------------------------------------------------------------------

## 9. Configuration Manager Interface

Pages: - Dashboard - User Management - Role Management - Department
Management - Policy Configuration - Workflow Configuration - System
Activity - Reports - Notifications - Settings

Responsible for managing: - users - roles - departments - expense
policies - workflow rules

------------------------------------------------------------------------

## 10. External Bank Integration

Payment flow:

Finance Officer initiates payment → Request sent to bank → Bank
processes transaction → Status returned to system

Payment statuses: Processing, Paid, Failed

------------------------------------------------------------------------

## 11. Prototype Navigation Flow

Expense Submitter → Manager Approval → Finance Verification → Compliance
Review → Payment Processing

------------------------------------------------------------------------

## 12. Conclusion

The Figma prototype demonstrates the complete interface and workflow for
the **Finstack Expense Management Platform**.

The design ensures: - role-based dashboards - clear workflow
navigation - consistent UI components - scalable enterprise design

**Please find the figma designs here**: [Figma Link](https://www.figma.com/design/QRKQ4oQMv7yYfVkYWccLrW/ffsd---fimga?node-id=72-68&p=f)
