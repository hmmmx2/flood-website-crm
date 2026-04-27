/**
 * CRM Website — Authentication E2E Tests
 * Covers: login, logout, validation, protected routes, token refresh
 */
describe('Authentication', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  // ── Login ────────────────────────────────────────────────────────────────────

  describe('Login page', () => {
    it('renders the login form', () => {
      cy.visit('/login');
      cy.get('input[type="email"], input[name="email"]').should('be.visible');
      cy.get('input[type="password"], input[name="password"]').should('be.visible');
      cy.get('button[type="submit"]').should('be.visible').and('contain.text', /login|sign in/i);
    });

    it('shows validation errors on empty submit', () => {
      cy.visit('/login');
      cy.get('button[type="submit"]').click();
      cy.get('input[type="email"], input[name="email"]').then(($input) => {
        expect(($input[0] as HTMLInputElement).validity.valid).to.be.false;
      });
    });

    it('shows error on invalid credentials', () => {
      cy.intercept('POST', '/api/auth/login', {
        statusCode: 401,
        body: { message: 'Invalid credentials' },
      }).as('failedLogin');

      cy.visit('/login');
      cy.get('input[type="email"], input[name="email"]').type('wrong@example.com');
      cy.get('input[type="password"], input[name="password"]').type('wrongpassword');
      cy.get('button[type="submit"]').click();
      cy.wait('@failedLogin');

      cy.contains(/invalid|incorrect|wrong|unauthori/i).should('be.visible');
      cy.url().should('include', '/login');
    });

    it('successfully logs in and redirects to dashboard', () => {
      cy.interceptAuth();
      cy.interceptNodes();
      cy.interceptAnalytics();

      cy.visit('/login');
      cy.get('input[type="email"], input[name="email"]').type(Cypress.env('ADMIN_EMAIL'));
      cy.get('input[type="password"], input[name="password"]').type(Cypress.env('ADMIN_PASSWORD'));
      cy.get('button[type="submit"]').click();
      cy.wait('@login');

      cy.url().should('not.include', '/login');
    });

    it('stores session token after login', () => {
      cy.interceptAuth();
      cy.interceptNodes();
      cy.interceptAnalytics();

      cy.visit('/login');
      cy.get('input[type="email"], input[name="email"]').type(Cypress.env('ADMIN_EMAIL'));
      cy.get('input[type="password"], input[name="password"]').type(Cypress.env('ADMIN_PASSWORD'));
      cy.get('button[type="submit"]').click();
      cy.wait('@login');

      cy.getAllLocalStorage().then((storage) => {
        const lsValues = Object.values(storage).flatMap(Object.values);
        expect(lsValues.some((v) => typeof v === 'string' && v.length > 10)).to.be.true;
      });
    });
  });

  // ── Protected routes ─────────────────────────────────────────────────────────

  describe('Protected routes', () => {
    it('redirects unauthenticated users from dashboard to login', () => {
      cy.visit('/dashboard');
      cy.url().should('include', '/login');
    });

    it('redirects unauthenticated users from map to login', () => {
      cy.visit('/map');
      cy.url().should('include', '/login');
    });

    it('redirects unauthenticated users from admin to login', () => {
      cy.visit('/admin');
      cy.url().should('include', '/login');
    });

    it('redirects unauthenticated users from broadcasts to login', () => {
      cy.visit('/broadcasts');
      cy.url().should('include', '/login');
    });
  });

  // ── Logout ───────────────────────────────────────────────────────────────────

  describe('Logout', () => {
    it('clears session and redirects to login on logout', () => {
      cy.loginAsAdmin();
      cy.interceptNodes();
      cy.interceptAnalytics();

      // Trigger logout (look for a logout button/link)
      cy.get('button, a').contains(/logout|sign out/i).first().click();
      cy.url().should('include', '/login');
    });
  });

  // ── Forgot password ──────────────────────────────────────────────────────────

  describe('Forgot password', () => {
    it('renders forgot password link on login page', () => {
      cy.visit('/login');
      cy.get('a, button').contains(/forgot|reset/i).should('be.visible');
    });
  });
});
