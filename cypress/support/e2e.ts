// ─── Global E2E support file ──────────────────────────────────────────────────
import './commands';

// Suppress uncaught exceptions that are unrelated to the test
Cypress.on('uncaught:exception', (err) => {
  // Next.js hydration or third-party errors should not fail tests
  if (
    err.message.includes('hydrat') ||
    err.message.includes('ResizeObserver') ||
    err.message.includes('Non-Error promise rejection')
  ) {
    return false;
  }
  return true;
});

beforeEach(() => {
  // Clear local/session storage between tests for isolation
  cy.clearLocalStorage();
  cy.clearCookies();
});
