/**
 * CRM Website — Broadcasts E2E Tests
 * Covers: list broadcasts, create broadcast, form validation
 */
describe('Broadcasts', () => {
  beforeEach(() => {
    cy.loginAsAdmin();
    cy.interceptBroadcasts();
  });

  describe('Broadcast list', () => {
    it('loads the broadcasts page', () => {
      cy.visit('/broadcasts');
      cy.waitForPageLoad();
      cy.wait('@getBroadcasts');
      cy.get('body').should('be.visible');
    });

    it('displays existing broadcasts from API', () => {
      cy.visit('/broadcasts');
      cy.wait('@getBroadcasts');
      cy.waitForPageLoad();

      cy.contains('Flood Warning - Sungai Sarawak').should('be.visible');
      cy.contains('Critical Alert - Sungai Tabuan').should('be.visible');
    });

    it('shows severity badges on broadcasts', () => {
      cy.visit('/broadcasts');
      cy.wait('@getBroadcasts');
      cy.waitForPageLoad();

      cy.contains(/warning|critical/i).should('exist');
    });

    it('shows recipient counts', () => {
      cy.visit('/broadcasts');
      cy.wait('@getBroadcasts');
      cy.waitForPageLoad();

      cy.contains('245').should('exist');
    });
  });

  describe('Create broadcast', () => {
    it('renders a create broadcast button or form trigger', () => {
      cy.visit('/broadcasts');
      cy.waitForPageLoad();

      cy.get('button').contains(/new|create|send|broadcast/i).should('be.visible');
    });

    it('opens create form on button click', () => {
      cy.visit('/broadcasts');
      cy.waitForPageLoad();

      cy.get('button').contains(/new|create|send|broadcast/i).first().click();
      cy.get('input, textarea, form').should('be.visible');
    });

    it('validates required fields on empty submit', () => {
      cy.visit('/broadcasts');
      cy.waitForPageLoad();

      cy.get('button').contains(/new|create|send|broadcast/i).first().click();
      cy.get('button[type="submit"]').filter(':visible').first().click();
      cy.contains(/required|cannot be empty|please fill/i).should('be.visible');
    });

    it('successfully submits a new broadcast', () => {
      cy.visit('/broadcasts');
      cy.waitForPageLoad();

      cy.get('button').contains(/new|create|send|broadcast/i).first().click();

      cy.get('input[name="title"], input[placeholder*="title" i]').first().type('Test Flood Alert');
      cy.get('textarea[name="body"], textarea[placeholder*="message" i], input[name="body"]')
        .first().type('This is a test broadcast message for flood warning.');
      cy.get('input[name="targetZone"], select[name="targetZone"]').first().then(($el) => {
        if ($el.is('select')) cy.wrap($el).select('Zone A');
        else cy.wrap($el).type('Zone A');
      });

      cy.get('button[type="submit"]').filter(':visible').first().click();
      cy.wait('@createBroadcast');

      cy.contains(/sent|success|created/i).should('be.visible');
    });
  });
});
