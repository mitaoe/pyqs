# GitHub Workflows

This directory contains GitHub Actions workflows for the mitaoe-pyqs project.

## Available Workflows

### ESLint Check (`eslint.yml`)

This workflow runs ESLint checks on the codebase to ensure code quality and adherence to coding standards.

- **Trigger**: Runs on push to main/develop branches, on pull requests to these branches, and can be manually triggered.
- **Actions**:
  - Checkout the repository
  - Set up Node.js and pnpm
  - Install dependencies
  - Run ESLint

## Adding a New Workflow

1. Create a new YAML file in the `.github/workflows` directory
2. Define the workflow according to GitHub Actions specifications
3. Update this README to document the new workflow 