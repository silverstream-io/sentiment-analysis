# Contributing to Sentiment Checker

We welcome contributions to the Sentiment Checker project! This document provides guidelines for contributing to the project.

## Getting Started

1. Fork the repository on GitHub.
2. Clone your fork locally:

   ```bash
   git clone https://github.com/your-username/sentiment-checker.git
   cd sentiment-checker
   ```

3. Create a new branch for your feature or bug fix:

   ```bash
   git checkout -b feature/your-feature-name
   ```

## Making Changes

1. Make your changes in your feature branch.
2. Add or update tests as necessary.
3. Ensure your code follows the project's coding standards.
4. Run the test suite to make sure all tests pass.

## Submitting Changes

1. Before submitting a pull request, make sure an issue exists in the GitHub repository describing the problem you're solving or the feature you're adding. If an issue doesn't exist, please create one.

2. To create an issue:
   - Go to the [Issues page](https://github.com/silverstream-io/sentiment-checker/issues) of the repository.
   - Click on "New Issue".
   - Choose the appropriate issue template if available, or start from scratch.
   - Provide a clear title and description of the issue.
   - Add relevant labels if you have permission.

3. Push your changes to your fork:

   ```bash
   git push origin feature/your-feature-name
   ```

4. Submit a pull request from your fork to the main repository:
   - Go to your fork on GitHub.
   - Click on "Pull request".
   - Ensure the base repository is `silverstream-io/sentiment-checker` and the base branch is `main`.
   - Provide a clear title and description for your pull request.
   - Reference the related issue in the pull request description using the syntax: "Closes #123" or "Fixes #123".

## Code Review Process

1. Maintainers will review your pull request.
2. They may request changes or ask questions.
3. Make any requested changes in your feature branch and push the changes.
4. Once approved, a maintainer will merge your pull request.

## Coding Standards

Please adhere to the coding standards used throughout the project. Key points include:

- Use 4 spaces for indentation in Python files.
- Use 2 spaces for indentation in JavaScript/TypeScript files.
- Follow PEP 8 style guide for Python code.
- Use ESLint and Prettier for JavaScript/TypeScript code.

## Testing

- Ensure all tests pass before submitting a pull request.
- Add new tests for new functionality or bug fixes.

## Documentation

- Update the README.md if your changes require it.
- Comment your code where necessary.
- Update or add documentation for any user-facing changes.

Thank you for contributing to Sentiment Checker!
