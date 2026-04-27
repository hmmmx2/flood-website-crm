/**
 * CRM Website — Sensors/Nodes Page E2E Tests
 * Covers: node table, filtering, status badges, pin/star, view on map
 */
describe('Sensors Page', () => {
  beforeEach(() => {
    cy.loginAsAdmin();
    cy.interceptNodes();
  });

  describe('Node table', () => {
    it('loads and renders the sensors page', () => {
      cy.visit('/sensors');
      cy.waitForPageLoad();
      cy.wait('@getNodes');
      cy.get('body').should('be.visible');
    });

    it('displays node rows from API', () => {
      cy.visit('/sensors');
      cy.wait('@getNodes');
      cy.waitForPageLoad();

      cy.get('table tbody tr, [data-testid="node-row"]').should('have.length.greaterThan', 0);
    });

    it('shows node IDs and names', () => {
      cy.visit('/sensors');
      cy.wait('@getNodes');
      cy.waitForPageLoad();

      cy.contains('102782478').should('exist');
    });

    it('displays status badges for each node', () => {
      cy.visit('/sensors');
      cy.wait('@getNodes');
      cy.waitForPageLoad();

      cy.contains(/active|warning|inactive/i).should('exist');
    });

    it('shows water level information', () => {
      cy.visit('/sensors');
      cy.wait('@getNodes');
      cy.waitForPageLoad();

      cy.contains(/level|m\b|\d+\.\d+/i).should('exist');
    });
  });

  describe('Filtering', () => {
    it('renders filter controls', () => {
      cy.visit('/sensors');
      cy.waitForPageLoad();

      cy.get('select, input[type="search"], [role="combobox"]').should('exist');
    });

    it('filters nodes by search input', () => {
      cy.visit('/sensors');
      cy.wait('@getNodes');
      cy.waitForPageLoad();

      const searchInput = cy.get('input[type="search"], input[placeholder*="search" i]').first();
      searchInput.type('102782478');
      cy.contains('102782478').should('be.visible');
    });

    it('filters nodes by status', () => {
      cy.visit('/sensors');
      cy.wait('@getNodes');
      cy.waitForPageLoad();

      const select = cy.get('select').first();
      select.select('warning').then(() => {
        cy.contains(/warning/i).should('exist');
      });
    });
  });

  describe('Pin/Star functionality', () => {
    it('renders star/pin buttons on node rows', () => {
      cy.visit('/sensors');
      cy.wait('@getNodes');
      cy.waitForPageLoad();

      cy.get('button').filter((_, el) => {
        return el.textContent?.includes('★') || el.getAttribute('aria-label')?.includes('pin') || false;
      }).should('have.length.greaterThan', 0);
    });

    it('toggles pin state on click', () => {
      cy.visit('/sensors');
      cy.wait('@getNodes');
      cy.waitForPageLoad();

      cy.get('button[aria-label*="pin" i], button[title*="pin" i]').first().as('pinBtn');
      cy.get('@pinBtn').click();
      // Verify localStorage persists pinned state
      cy.window().then((win) => {
        const pinned = win.localStorage.getItem('crm_pinned_nodes');
        expect(pinned).to.not.be.null;
      });
    });
  });

  describe('View on Map navigation', () => {
    it('has "View on Map" buttons for each node', () => {
      cy.visit('/sensors');
      cy.wait('@getNodes');
      cy.waitForPageLoad();

      cy.contains(/view.*map|map/i).should('exist');
    });

    it('navigates to map page with node coordinates in URL', () => {
      cy.visit('/sensors');
      cy.wait('@getNodes');
      cy.waitForPageLoad();

      cy.contains(/view.*map|map/i).first().click();
      cy.url().should('include', '/map');
      cy.url().should('match', /lat=|lng=|nodeId=/);
    });
  });
});
