# Summary of the Interaction

## Basic Information

* **Domain:** Fintech  
* **Problem Statement:** Expense, Reconciliation & Compliance Management Platform  
* **Date of Interaction:** 31/01/2026  
* **Mode of Interaction:** Video call  
* **Duration:** 31 mins 58 secs  
* **Publicly Accessible Link:** [Dropbox Video Link](https://www.dropbox.com/scl/fi/tyg94mcu13zdvbhdeyh1e/video1680760946.mp4?rlkey=6wf9v2mlauujuk39ecxhf9u0b&st=m1ldbqkk&dl=0)

## Domain Expert Details

* **Role/Designation:** Backend Engineer(Fintech Domain)
* **Experience in the Domain:** Has professional experience as a Backend Engineer and hands-on exposure as a stock broker, where he worked with market transactions, financial instruments, and compliance-driven processes.
* **Nature of Work:** : Technical and operational involvement in financial processes, transaction handling, and compliance-related activities.

## Domain Context and Terminology

**Overall Purpose:** Our goal is to make expense reporting effortless for everyone—whether you're running a small startup or a large enterprise. We are moving beyond the headache of manual spreadsheets and endless forms to build a smart, automated platform that handles the rules for you, making the whole process truly frictionless.

**Primary Goals:**

1. **Automate Workflow:** Reduce human intervention in the submission and reconciliation loop.  
2. **Reduce Friction:** Eliminate the "pain" of filling out complex forms (like BHLC) for employees.  
3. **Scalability:** Ensure the platform works for companies with flat hierarchies (Startups) and complex hierarchies (MNCs).

**Key Domain Terms:**

| Term | Meaning as explained by the expert |
| :---- | :---- |
| **Expense/Fund** | A business-related cost paid by an employee that needs to be paid back by the company. |
| **Payment Gateway** | The external system (like a Bank API) that actually transfers the money from the company to the employee. |
| **Audit Log** | A history record of every action taken in the system, like who clicked what and when. |
| **Management** | The step where the manager looks at the expense and decides whether it should be approved. |
| **Reconciliation** | Matching the company's internal expense records with the bank statement to make sure the payment was actually made. |
| **Compliance** | Ensuring that all expenses follow the company's rules and spending limits. |
| **HR/Compliance Manager** | The person who sets the rules and limits for spending to prevent fraud. |
| **Receipts** | A photo or digital copy of the bill that proves the employee actually spent the money. |
| **BHLC** | **Boarding, Hoarding, and Lodging Charges**. A specific category of business expenses covering accommodation, food, and daily allowances during official travel. |
| **Transaction Proof** | A unique code given by the bank after a payment is successful. |

## Actors and Responsibilities

| Actor / Role | Responsibilities |
| :---- | :---- |
| **Expense Submitter** | A person in organization who submits expenses. |
| **Manager** | The supervisor who reviews and approves employee's expense requests. |
| **Financial Officer** | The finance staff member who makes the final payment after reconciliation. |
| **Compliance Officer** | The person who sets the rules and limits for spending to prevent fraud. |
| **Configuration Manager** | The admin who manages user accounts and general system settings and also updates the policies given by Compliance Officer. |
| **External Bank** | The bank's system that handles the real money transfer. |

## Core Workflows

*Real-world scenarios identified during the discussion.*

**Workflow 1: "Startup Mode" (Direct-to-Finance)**

* **Trigger:** An employee in a small company incurs a travel expense.  
* **Steps:**  
  1. User logs in via mobile app.  
  2. User captures receipt image and selects category (e.g., Food).  
  3. **Bypass Step:** The system detects "Small Company" configuration and skips the "Reporting Manager" approval layer.  
  4. Request goes directly to the Financial Officer/HR queue.  
* **Outcome:** The company maintains speed and simplicity in expense handling, matching its flat organizational structure.

**Workflow 2: "Enterprise Mode" (Standard Hierarchy)**

* **Trigger:** An employee in a large MNC submits a high-value BHLC claim.  
* **Steps:**  
  1. User submits claim with attached invoices.  
  2. System validates amount against "Daily Allowance" policies defined by Compliance Officer.  
  3. Reporting Manager receives notification and performs operational review (Business Validity).  
  4. Financial Officer receives "Approved" claim and adds it to the Payment Batch.  
* **Outcome:** The claim is carefully reviewed at multiple levels, ensuring it is genuine, policy-compliant, and ready for reimbursement without unnecessary risk.

**Workflow 3: "Reconciliation & Error Handling"**

* **Trigger:** Financial Officer initiates a batch payment, but the bank API times out.  
* **Steps:**  
  1. System calls External Bank API.  
  2. Bank returns a "Failure" or "Pending" status.  
  3. System updates internal record to "Payment Failed."  
  4. Financial Officer triggers the "Reconciliation" module to fetch the latest Bank Feed.  
  5. System compares Bank Feed vs. Internal Logs to verify if money actually left the account.  
* **Outcome:** Issues are flagged immediately, preventing double payments or lost funds.

## Rules, Constraints, and Exceptions

**Mandatory Rules:**

* **Policy Config:** Compliance rules must be explicitly defined and enforceable. The system cannot be vague about limits (e.g., "Max ₹2000/day for food").  
* **Digital Proof:** No expense can be processed without an attached digital receipt.

**Constraints & Limitations:**

* **Banking API Fragmentation:** Integrating with legacy banks (specifically premium banks like HDFC) is difficult due to poor documentation and restricted API access.  
* **Latency:** The system must handle delays from external payment gateways without freezing the user interface.

**Exceptions & Edge Cases:**

* **Dynamic Actor Disabling:** The system must support "Layer Toggling." Small companies should be able to disable the "Manager" actor/layer entirely.  
* **Mobile responsiveness:** The submission interface must be fully functional on mobile devices to support on-the-go employees.

## Current Challenges and Pain Points

* **Integration Complexity:** Establishing direct connections with multiple banks is a major engineering hurdle.  
* **Submission Friction:** The current manual process involves filling out time-taking forms (like BHLC) and updating Excel sheets, which leads to user frustration and data entry errors.  
* **Audit Visibility:** Existing solutions present Audit Logs in messy, technical formats that are hard for non-technical Compliance Officers to read or track.

## Assumptions & Clarifications

**Confirmed Assumptions:**

* The Use Case definitions and Actor divisions (User vs. Manager vs. Finance) are accurate and align with industry standards.

**Corrected Assumptions:**

* **One Size Does Not Fit All:** We initially designed for MNCs (Multi-National Companies). The expert clarified that small startups have different needs (e.g., direct submission to HR). We must implement a "Configurable Hierarchy" feature to support this.

**Open Questions / Future Work:**

* **Aggregator Strategy:** Given the difficulty of integrating individual banks (like HDFC), should we pivot to using a Banking Aggregator (e.g., RazorpayX, Stripe Connect) for the prototype?  
* **BHLC Automation:** To what extent can information from boarding and lodging receipts be automatically extracted to reduce manual entry during expense claim submission?

