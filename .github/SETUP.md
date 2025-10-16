# GitHub Actions Setup Guide

This guide will help you set up GitHub Actions to automatically run tests on every push.

## 🔧 Required Secrets

You need to add the following secrets to your GitHub repository:

### 1. Database URL

- **Secret Name**: `DATABASE_URL`
- **Value**: Your Render PostgreSQL database URL
- **How to get it**: Copy from your Render dashboard or `.env` file

### 2. Optional: Render Deployment Secrets

- **Secret Name**: `RENDER_SERVICE_ID`
- **Value**: Your Render service ID (for auto-deployment)
- **Secret Name**: `RENDER_API_KEY`
- **Value**: Your Render API key (for auto-deployment)

## 📋 How to Add Secrets

1. Go to your GitHub repository
2. Click on **Settings** tab
3. Click on **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Add each secret with the name and value above

## 🚀 Workflows Included

### 1. `test-only.yml` (Recommended)

- **Triggers**: Every push and pull request
- **What it does**: Runs all tests (Python + JavaScript)
- **Requirements**: Only needs `DATABASE_URL` secret

### 2. `ci.yml` (Full CI/CD)

- **Triggers**: Push to main/develop branches, pull requests
- **What it does**: Tests + Security checks + Deployment
- **Requirements**: All secrets above

### 3. `test.yml` (Basic)

- **Triggers**: Push to main/develop branches, pull requests
- **What it does**: Basic test suite with coverage
- **Requirements**: Only needs `DATABASE_URL` secret

## ✅ Test What's Included

### Python Tests:

- ✅ Database connection tests
- ✅ User creation/deletion tests
- ✅ Password hashing tests
- ✅ PostgreSQL integration tests

### JavaScript Tests:

- ✅ DOM manipulation tests
- ✅ Event handling tests
- ✅ Async operation tests
- ✅ Fetch API mocking tests

## 🔍 Coverage Reports

The workflows generate coverage reports that you can view:

- **Python**: Uploaded to Codecov (if configured)
- **JavaScript**: Uploaded to Codecov (if configured)

## 🚨 Troubleshooting

### Common Issues:

1. **"DATABASE_URL not found"**

   - Make sure you added the `DATABASE_URL` secret
   - Check that the URL is correct and accessible

2. **"Tests failing"**

   - Check the Actions tab for detailed logs
   - Make sure your Render database is accessible from GitHub Actions

3. **"Build failing"**
   - Check that all dependencies are in `requirements.txt` and `package.json`
   - Make sure the build commands work locally

## 🎯 Next Steps

1. Add the required secrets to your repository
2. Push a commit to trigger the workflow
3. Check the **Actions** tab to see the results
4. Set up branch protection rules to require tests to pass

## 📊 Example Workflow Run

When you push code, you'll see:

```
✅ All tests completed successfully!
📊 Test Summary:
  - Python backend tests: PASSED
  - JavaScript frontend tests: PASSED
  - Database integration tests: PASSED
🎉 Ready for deployment!
```
