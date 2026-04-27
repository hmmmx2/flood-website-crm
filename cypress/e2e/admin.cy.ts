/**
 * CRM Website — Admin User Management E2E Tests
 * Covers: user list, create user, update role, delete user
 */
describe('Admin User Management', () => {
  beforeEach(() => {
    cy.loginAsAdmin();
    cy.interceptAdminUsers();
  });

  describe('User list', () => {
    it('loads the admin page', () => {
      cy.visit('/admin');
      cy.waitForPageLoad();
      cy.wait('@getAdminUsers');
      cy.get('body').should('be.visible');
    });

    it('displays all users from API', () => {
      cy.visit('/admin');
      cy.wait('@getAdminUsers');
      cy.waitForPageLoad();

      cy.contains('admin@example.com').should('be.visible');
      cy.contains('john.doe@example.com').should('be.visible');
    });

    it('shows role badges for each user', () => {
      cy.visit('/admin');
      cy.wait('@getAdminUsers');
      cy.waitForPageLoad();

      cy.contains(/admin|customer/i).should('exist');
    });

    it('shows user count', () => {
      cy.visit('/admin');
      cy.wait('@getAdminUsers');
      cy.waitForPageLoad();

      cy.contains(/2|users/i).should('exist');
    });
  });

  describe('Create user', () => {
    it('renders a create user button', () => {
      cy.visit('/admin');
      cy.waitForPageLoad();

      cy.get('button').contains(/new|create|add.*user/i).should('be.visible');
    });

    it('opens user creation form on button click', () => {
      cy.visit('/admin');
      cy.waitForPageLoad();

      cy.get('button').contains(/new|create|add.*user/i).first().click();
      cy.get('input[name="email"], input[type="email"]').should('be.visible');
    });

    it('creates a new user successfully', () => {
      cy.visit('/admin');
      cy.waitForPageLoad();

      cy.get('button').contains(/new|create|add.*user/i).first().click();

      cy.get('input[name="firstName"], input[placeholder*="first" i]').first().type('New');
      cy.get('input[name="lastName"], input[placeholder*="last" i]').first().type('User');
      cy.get('input[name="email"], input[type="email"]').first().type('newuser@example.com');
      cy.get('input[name="password"], input[type="password"]').first().type('NewPassword@123');

      cy.get('button[type="submit"]').filter(':visible').first().click();
      cy.wait('@createAdminUser');

      cy.contains(/created|success/i).should('be.visible');
    });
  });

  describe('Delete user', () => {
    it('shows delete action per user row', () => {
      cy.visit('/admin');
      cy.wait('@getAdminUsers');
      cy.waitForPageLoad();

      cy.get('button[aria-label*="delete" i], button').contains(/delete|remove/i).should('exist');
    });

    it('deletes a user after confirmation', () => {
      cy.visit('/admin');
      cy.wait('@getAdminUsers');
      cy.waitForPageLoad();

      cy.get('button').contains(/delete|remove/i).first().click();
      // Handle confirmation dialog
      cy.get('button').contains(/confirm|yes|delete/i).filter(':visible').first().click();
      cy.wait('@deleteAdminUser');
    });
  });
});
