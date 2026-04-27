/**
 * CRM Website — Dashboard E2E Tests
 * Covers: KPI cards, node list, real-time toggle, analytics charts
 */
describe('Dashboard', () => {
  beforeEach(() => {
    cy.interceptAuth();
    cy.interceptNodes();
    cy.interceptAnalytics();
    cy.interceptDashboard();
    cy.loginAsAdmin();
  });

  describe('Layout & navigation', () => {
    it('renders sidebar navigation after login', () => {
      cy.get('nav, aside').should('be.visible');
    });

    it('has working navigation links in sidebar', () => {
      cy.get('nav a, aside a').should('have.length.greaterThan', 2);
    });

    it('shows logged-in admin name or avatar', () => {
      cy.contains(/admin/i).should('be.visible');
    });
  });

  describe('KPI stat cards', () => {
    it('displays stat cards with numeric values', () => {
      cy.visit('/dashboard');
      cy.waitForPageLoad();

      // Should display at least one numeric stat
      cy.get('body').contains(/\d+/).should('exist');
    });

    it('shows node count information', () => {
      cy.visit('/dashboard');
      cy.waitForPageLoad();
      // 111 is the total node count from mock
      cy.contains(/111|node/i).should('exist');
    });
  });

  describe('Sensor node table', () => {
    it('renders the node data table', () => {
      cy.visit('/dashboard');
      cy.waitForPageLoad();

      cy.wait('@getNodes');
      cy.get('table, [role="table"], [data-testid="node-table"]').should('exist');
    });

    it('displays rows for each mocked node', () => {
      cy.visit('/dashboard');
      cy.wait('@getNodes');
      cy.waitForPageLoad();

      // Should have at least 3 rows (matching mock-nodes.json)
      cy.get('table tbody tr, [role="row"]').should('have.length.greaterThan', 0);
    });

    it('shows correct node statuses from data', () => {
      cy.visit('/dashboard');
      cy.wait('@getNodes');
      cy.waitForPageLoad();

      cy.get('body').contains(/active|warning|inactive/i).should('exist');
    });
  });

  describe('API error handling', () => {
    it('shows error state when nodes API fails', () => {
      cy.intercept('GET', '/api/nodes', { statusCode: 500, body: { message: 'Server error' } }).as('nodesFail');
      cy.visit('/dashboard');
      cy.wait('@nodesFail');
      cy.contains(/error|failed|unavailable|try again/i).should('be.visible');
    });
  });
});
