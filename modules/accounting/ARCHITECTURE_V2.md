# Accounting V2 Architecture

## Objective
Rebuild GymOS accounting so it behaves like an Odoo-style accounting ERP and not a setup-driven dashboard.

## Core Design
- double-entry bookkeeping
- journals -> entries -> entry lines
- invoices/bills -> posting -> journal entries
- payments/transfers -> liquidity journals -> journal entries
- localization is configuration-only
- cafeteria accounting is toggle-driven and forward-only

## Gym Revenue Lines
- memberships
- packages
- personal_training
- sessions
- freeze_fees
- retail
- cafeteria
- other

## Key Behavioral Changes
1. Dashboard no longer hosts localization setup after installation.
2. Configuration is split into:
   - Settings
   - Localization
   - Payment Methods
3. Reporting now includes:
   - trial balance
   - profit and loss
   - balance sheet
   - aged receivables
   - aged payables
   - customer ledger
   - vendor ledger
   - revenue by business line

## Data Model Additions
- accounting_invoices.document_kind
- accounting_invoices.business_line
- accounting_payments.payment_category
- accounting_payments.source_journal_id
- accounting_payments.destination_journal_id
- accounting_payment_methods
