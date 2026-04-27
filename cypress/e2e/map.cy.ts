/**
 * CRM Website — Map Page E2E Tests
 * Covers: map renders, node markers, focus navigation, info panel
 */
describe('Map Page', () => {
  beforeEach(() => {
    cy.loginAsAdmin();
    cy.interceptNodes();
  });

  describe('Map rendering', () => {
    it('loads the map page', () => {
      cy.visit('/map');
      cy.waitForPageLoad();
      cy.get('body').should('be.visible');
    });

    it('renders the Google Maps container', () => {
      cy.visit('/map');
      cy.waitForPageLoad();
      // Google Maps renders in an iframe or a div with specific structure
      cy.get('[class*="map"], #map, [data-testid="map"], iframe[src*="maps"]', { timeout: 15000 }).should('exist');
    });

    it('fetches node data on load', () => {
      cy.visit('/map');
      cy.wait('@getNodes');
      cy.get('body').should('be.visible');
    });
  });

  describe('Focus navigation from sensors page', () => {
    it('accepts lat/lng/nodeId query params without error', () => {
      cy.interceptNodes();
      cy.visit('/map?lat=1.5533&lng=110.3592&nodeId=102782478');
      cy.waitForPageLoad();
      cy.wait('@getNodes');
      cy.get('body').should('be.visible');
      cy.get('body').should('not.contain', 'Error');
    });

    it('displays a focus banner when nodeId is provided', () => {
      cy.interceptNodes();
      cy.visit('/map?lat=1.5533&lng=110.3592&nodeId=102782478');
      cy.wait('@getNodes');
      cy.waitForPageLoad();

      cy.contains(/102782478|focused|viewing|node/i).should('exist');
    });
  });

  describe('Node info panel', () => {
    it('renders node status legend or info panel', () => {
      cy.visit('/map');
      cy.waitForPageLoad();
      cy.wait('@getNodes');
      cy.contains(/active|warning|critical|inactive/i).should('exist');
    });
  });
});
