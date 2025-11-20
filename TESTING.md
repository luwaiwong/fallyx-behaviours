# Testing Guide

## Overview

This document describes the testing strategy for the chain-based home management system.

## Test Structure

### Backend API Tests

Located in `src/app/api/admin/__tests__/`:

1. **chains.test.ts** - Tests for chain management API
   - Chain creation
   - Chain retrieval
   - Validation

2. **users-create.test.ts** - Tests for user creation API
   - Admin user creation
   - HomeUser creation scenarios
   - Validation

### Running Tests

```bash
# Install test dependencies (if not already installed)
npm install --save-dev jest @types/jest ts-jest

# Run all tests
npm test

# Run specific test file
npm test chains.test.ts
npm test users-create.test.ts
```

## Test Scenarios

### Chain Management

1. ✅ Create new chain
2. ✅ Retrieve all chains
3. ✅ Reject duplicate chain creation
4. ✅ Validate chain name requirement

### User Creation

#### Admin Users
1. ✅ Create admin user (no home/chain required)
2. ✅ Validate admin user doesn't have home/chain

#### HomeUser Creation
1. ✅ Create with existing chain and home
2. ✅ Create with new chain (auto-creates home)
3. ✅ Create with new home in existing chain
4. ✅ Reject without chain
5. ✅ Reject without home (when not creating new)
6. ✅ Validate role (only admin/homeUser allowed)
7. ✅ Validate password strength

## Manual Testing Checklist

### User Management UI

- [ ] Create admin user
- [ ] Create homeUser with existing chain/home
- [ ] Create homeUser with new chain
- [ ] Create homeUser with new home in existing chain
- [ ] Verify chain dropdown shows existing chains
- [ ] Verify home dropdown filters by selected chain
- [ ] Verify new chain creation creates new home automatically
- [ ] Verify role dropdown only shows admin and homeUser
- [ ] Verify user table displays home and chain columns

### Chain Management

- [ ] Create new chain via API
- [ ] Retrieve chains via API
- [ ] Verify chain appears in user creation dropdown

### Python Extraction Logic

- [ ] Run extraction for Kindera chain home (Berkshire Care)
- [ ] Run extraction for Kindera chain home (Banwell Gardens)
- [ ] Run extraction for Responsive chain home (Mill Creek Care)
- [ ] Run extraction for Responsive chain home (The O'Neill)
- [ ] Verify files are processed correctly
- [ ] Verify output goes to correct home directories

## Integration Testing

### End-to-End User Creation Flow

1. Admin logs in
2. Navigate to User Management
3. Click "Add New User"
4. Select role: homeUser
5. Create new chain "Test Chain"
6. Verify new home is auto-created
7. Submit form
8. Verify user is created with correct home/chain
9. Verify chain appears in chain list
10. Verify home appears in home list

## Known Issues

None currently.

## Future Test Additions

- [ ] Test home deletion (should remove from chain)
- [ ] Test chain deletion (should handle orphaned homes)
- [ ] Test user role updates
- [ ] Test Python extraction script parameterization
- [ ] Test file upload with new home structure


