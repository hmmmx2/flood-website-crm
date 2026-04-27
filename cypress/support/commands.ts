/// <reference types="cypress" />

// ─── Type declarations ────────────────────────────────────────────────────────
declare global {
  namespace Cypress {
    interface Chainable {
      loginAsAdmin(): Chainable<void>;
      loginAs(email: string, password: string): Chainable<void>;
      interceptAuth(): Chainable<void>;
      interceptNodes(): Chainable<void>;
      interceptAnalytics(): Chainable<void>;
      interceptDashboard(): Chainable<void>;
      interceptBlogs(): Chainable<void>;
      interceptBroadcasts(): Chainable<void>;
      interceptAdminUsers(): Chainable<void>;
      waitForPageLoad(): Chainable<void>;
    }
  }
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

Cypress.Commands.add('interceptAuth', () => {
  cy.intercept('POST', '/api/auth/login', { fixture: 'login-response.json' }).as('login');
  cy.intercept('POST', '/api/auth/refresh', { body: { accessToken: 'mock-access-token' } }).as('refresh');
});

Cypress.Commands.add('loginAsAdmin', () => {
  cy.interceptAuth();
  cy.interceptNodes();
  cy.interceptAnalytics();
  cy.interceptDashboard();

  cy.visit('/login');
  cy.get('input[type="email"], input[name="email"]').clear().type(Cypress.env('ADMIN_EMAIL'));
  cy.get('input[type="password"], input[name="password"]').clear().type(Cypress.env('ADMIN_PASSWORD'));
  cy.get('button[type="submit"]').click();
  cy.wait('@login');
  cy.url().should('not.include', '/login');
});

Cypress.Commands.add('loginAs', (email: string, password: string) => {
  cy.interceptAuth();
  cy.visit('/login');
  cy.get('input[type="email"], input[name="email"]').clear().type(email);
  cy.get('input[type="password"], input[name="password"]').clear().type(password);
  cy.get('button[type="submit"]').click();
  cy.wait('@login');
});

// ─── Intercept helpers ────────────────────────────────────────────────────────

Cypress.Commands.add('interceptNodes', () => {
  cy.intercept('GET', '/api/nodes', { fixture: 'mock-nodes.json' }).as('getNodes');
});

Cypress.Commands.add('interceptAnalytics', () => {
  cy.intercept('GET', '/api/analytics', { fixture: 'mock-analytics.json' }).as('getAnalytics');
});

Cypress.Commands.add('interceptDashboard', () => {
  cy.intercept('GET', '/api/nodes', { fixture: 'mock-nodes.json' }).as('getDashboardNodes');
});

Cypress.Commands.add('interceptBlogs', () => {
  cy.intercept('GET', '/api/blogs*', { fixture: 'mock-blogs.json' }).as('getBlogs');
});

Cypress.Commands.add('interceptBroadcasts', () => {
  cy.intercept('GET', '/api/broadcasts', { fixture: 'mock-broadcasts.json' }).as('getBroadcasts');
  cy.intercept('POST', '/api/broadcasts', (req) => {
    req.reply({ statusCode: 201, body: { id: 'new-broadcast-id', ...req.body } });
  }).as('createBroadcast');
});

Cypress.Commands.add('interceptAdminUsers', () => {
  cy.intercept('GET', '/api/admin/users', { fixture: 'mock-admin-users.json' }).as('getAdminUsers');
  cy.intercept('POST', '/api/admin/users', (req) => {
    req.reply({ statusCode: 200, body: { id: 'new-user-id', ...req.body } });
  }).as('createAdminUser');
  cy.intercept('PATCH', '/api/admin/users/*', (req) => {
    req.reply({ statusCode: 200, body: req.body });
  }).as('updateAdminUser');
  cy.intercept('DELETE', '/api/admin/users/*', { statusCode: 204 }).as('deleteAdminUser');
});

Cypress.Commands.add('waitForPageLoad', () => {
  cy.get('body').should('be.visible');
  cy.document().its('readyState').should('eq', 'complete');
});

export {};
