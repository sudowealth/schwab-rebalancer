# Financial Planning Simulation - Technical Specification

## Overview

Create a comprehensive financial planning simulation page at "/planning" with real-time calculations and database persistence.

## Navigation

Add a "Planning" menu item to the top navigation bar linking to the planning page.

## Core Features

### Real-Time Updates

- Recalculate table immediately as users type in input fields
- Implement debouncing/throttling to prevent excessive requests during rapid typing
- Persist all inputs and calculations to database

### Display Components

- **Results Table**: Scrollable table showing year-by-year breakdown for all years in the simulation period
- **Summary Cards**: Display above table
  - Ending value (nominal)
  - Ending value (real/inflation-adjusted to today's equivalent)

## Initial Input Parameters

### User Information

- **Filing Status**: Dropdown (Single, Married Filing Jointly, Head of Household)
- **Primary User Age**: Number input (required for RMD calculations)
- **Spouse Age**: Number input (shown only if Married Filing Jointly selected)

### Account Balances

- **Taxable**: $100,000 (with configurable initial cost basis)
- **Tax Exempt (Roth)**: $100,000
- **Tax Deferred (401k)**: $100,000

### Investment Parameters

- **Simulation Period**: 50 years
- **Return**: 10% (not sure if this is pre-tax or post-tax)
- **Inflation Rate**: 2%
- **Expected Dividend Rate**: [User configurable] for taxable account dividend tax calculations

### Tax Configuration

**2025 Tax Brackets** (configurable via modal, stored in database):

**Federal Income Tax Brackets:**

- 10%: $0 - $11,925 (single) / $0 - $23,850 (married filing jointly)
- 12%: $11,926 - $48,350 (single) / $23,851 - $96,700 (married filing jointly)
- 22%: $48,351 - $103,350 (single) / $96,701 - $206,700 (married filing jointly)
- 24%: $103,351 - $197,300 (single) / $206,701 - $394,600 (married filing jointly)
- 32%: $197,301 - $250,525 (single) / $394,601 - $501,050 (married filing jointly)
- 35%: $250,526 - $626,350 (single) / $501,051 - $751,600 (married filing jointly)
- 37%: $626,351+ (single) / $751,601+ (married filing jointly)

**Federal Long-Term Capital Gains Tax:**

- 0%: $0 - $48,350 (single) / $0 - $96,700 (married filing jointly)
- 15%: $48,351 - $533,400 (single) / $96,701 - $600,050 (married filing jointly)
- 20%: $533,401+ (single) / $600,051+ (married filing jointly)

**Federal Qualified Dividend Tax:** Same rates as long-term capital gains

**California State Income Tax Brackets (2024 rates, global settings):**

_Single Filers:_

- 1%: $0 - $10,756
- 2%: $10,757 - $25,499
- 4%: $25,500 - $40,245
- 6%: $40,246 - $55,866
- 8%: $55,867 - $70,606
- 9.3%: $70,607 - $360,659
- 10.3%: $360,660 - $432,787
- 11.3%: $432,788 - $721,314
- 12.3%: $721,315+

_Married Filing Jointly:_

- 1%: $0 - $21,512
- 2%: $21,513 - $50,998
- 4%: $50,999 - $80,490
- 6%: $80,491 - $111,732
- 8%: $111,733 - $141,212
- 9.3%: $141,213 - $721,318
- 10.3%: $721,319 - $865,574
- 11.3%: $865,575 - $1,442,628
- 12.3%: $1,442,629+

_Head of Household:_ (Use single filer brackets with adjusted thresholds)

**California Additional Taxes:**

- Mental Health Services Tax: 1% on income over $1 million (total top rate 13.3%)
- State Disability Insurance (SDI): 1.1% on all wage income

**California Capital Gains Tax:**

- California taxes ALL capital gains (short-term and long-term) as ordinary income
- No distinction between short-term and long-term gains
- Same rates as California income tax brackets above
- No preferential rates for long-term holdings

**Federal Short-Term Capital Gains:** Taxed as ordinary income at federal rates

### Account Tax Treatment

- **Taxable Account**:
  - Subject to California and federal capital gains tax on withdrawals (growth portion only, based on cost basis)
  - Subject to annual dividend taxes based on expected dividend rate (federal preferential rates, California ordinary income rates)
  - Track cost basis separately
- **Roth Account**: Tax-free growth and withdrawals after age 59.5
- **401k Account**: Taxed as ordinary income on withdrawal (federal and California rates), subject to RMDs starting age 73

### Withdrawal Strategy

**Fixed Strategy** (only option): Taxable → Tax Deferred → Tax Exempt

- Apply Required Minimum Distributions (RMDs) automatically for 401k starting at age 73
- Calculate optimal withdrawal amounts based on strategy

## Goals System (Contributions & Withdrawals)

### Goal Structure

Each goal includes:

- **Purpose**: Optional text description
- **Type**: Dropdown with options:
  - Contribution
  - Fixed Withdrawal
  - [Other withdrawal types as needed]
- **Amount**: Dollar amount with inflation adjustment checkbox
- **Starts**: Dropdown for start timing options
- **Years**: Number input for duration
- **Frequency**: Dropdown (Annually, Monthly, etc.)
- **Repeats**: Dropdown for repetition pattern
- **Occurrences**: Number of times it repeats

### Goal Management

- Add/Remove goals dynamically
- Multiple goals can be active simultaneously
- Goals can overlap in time periods

## Year-by-Year Table Columns

1. **Year**: Sequential year number
2. **Starting Balance**: By account type (Taxable, Roth, 401k)
3. **Growth**: Investment returns by account
4. **Contributions**: By source/goal, by account type
5. **Withdrawals**: By source/goal, by account type
6. **Taxes Paid**: Broken down by:
   - Federal income tax
   - California state income tax
   - Federal capital gains tax (preferential rates)
   - California capital gains tax (ordinary income rates)
   - Federal dividend taxes (preferential rates)
   - California dividend taxes (ordinary income rates)
   - Total taxes
7. **Final Balance**: By account type
8. **Total Portfolio Value**: Sum of all accounts (nominal and real)

## Technical Implementation Notes

- Store tax brackets in database as global settings with ability to modify via modal
- Implement proper tax calculation logic for each type:
  - Federal preferential rates for capital gains and dividends
  - California ordinary income rates for all gains and dividends
  - Progressive bracket calculations for both federal and state
- Handle RMD calculations automatically based on user age(s) and 401k balances
- Calculate inflation adjustments throughout simulation period
- Debounce input changes to prevent excessive recalculations
- Save all user inputs and preferences to database
- Age-based logic for penalty-free Roth withdrawals (59.5+) and RMD requirements (73+)
- Conditional spouse age input based on filing status selection

## Schema Design

### New Tables

**financial_plan** - Main planning simulation container

- id (primary key)
- user_id (foreign key to user table)
- name (varchar) - user-defined plan name
- created_at (timestamp)
- updated_at (timestamp)

**financial_plan_input** - Core simulation parameters

- id (primary key)
- plan_id (foreign key to financial_plan)
- filing_status (enum: single, married_filing_jointly, head_of_household)
- primary_user_age (integer)
- spouse_age (integer, nullable)
- simulation_period (integer, default 50)
- return_rate (decimal, default 10.0)
- inflation_rate (decimal, default 2.0)
- dividend_rate (decimal)
- taxable_balance (decimal, default 100000)
- taxable_cost_basis (decimal)
- roth_balance (decimal, default 100000)
- deferred_balance (decimal, default 100000)
- updated_at (timestamp)

**financial_plan_goal** - Contribution and withdrawal goals

- id (primary key)
- plan_id (foreign key to financial_plan)
- purpose (text, nullable)
- type (enum: contribution, fixed_withdrawal)
- amount (decimal)
- inflation_adjusted (boolean, default true)
- start_timing (varchar)
- duration_years (integer)
- frequency (enum: annually, monthly)
- repeat_pattern (varchar)
- occurrences (integer)
- created_at (timestamp)

**tax_bracket** - Global tax bracket configurations

- id (primary key)
- bracket_type (enum: federal_income, federal_capital_gains, california_income)
- filing_status (enum: single, married_filing_jointly, head_of_household)
- min_income (decimal)
- max_income (decimal, nullable for top bracket)
- rate (decimal)
- year (integer, default 2025)
- created_at (timestamp)

**financial_plan_result** - Cached yearly calculation results

- id (primary key)
- plan_id (foreign key to financial_plan)
- year (integer)
- starting_taxable (decimal)
- starting_roth (decimal)
- starting_deferred (decimal)
- growth_taxable (decimal)
- growth_roth (decimal)
- growth_deferred (decimal)
- contributions_taxable (decimal)
- contributions_roth (decimal)
- contributions_deferred (decimal)
- withdrawals_taxable (decimal)
- withdrawals_roth (decimal)
- withdrawals_deferred (decimal)
- federal_income_tax (decimal)
- california_income_tax (decimal)
- federal_capital_gains_tax (decimal)
- california_capital_gains_tax (decimal)
- federal_dividend_tax (decimal)
- california_dividend_tax (decimal)
- total_taxes (decimal)
- ending_taxable (decimal)
- ending_roth (decimal)
- ending_deferred (decimal)
- total_portfolio_nominal (decimal)
- total_portfolio_real (decimal)
- calculated_at (timestamp)
