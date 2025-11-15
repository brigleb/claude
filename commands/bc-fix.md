Please analyze and fix the Basecamp card or todo: $ARGUMENTS.

Follow these steps exactly:

1. Use `bc4 card view $ARGUMENTS` to get the card details, or `bc4 issue view $ARGUMENTS` for todos (we may not know which it is)
2. Understand the problem described in the card or todo
3. ALWAYS create a new branch for the work
4. Ask the user for any additional information if needed
5. Search the codebase for relevant files
6. Ensure you are not duplicating existing code and are following framework best practices
7. Implement the necessary changes to fix the issue
8. Write and run tests to verify the fix, if applicable
9. Ensure code passes linting and type checking, if applicable
10. Create a descriptive commit message
11. Push and create a PR for user to review

Remember to use the Basecamp CLI (`bc4`) for all Basecamp-related tasks.