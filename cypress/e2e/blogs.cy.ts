/**
 * CRM Website — Blog Management E2E Tests
 * Covers: blog list, create, edit, delete, featured toggle
 */
describe('Blog Management', () => {
  beforeEach(() => {
    cy.loginAsAdmin();
    cy.interceptBlogs();
  });

  describe('Blog list', () => {
    it('loads the blog management page', () => {
      cy.visit('/blog');
      cy.waitForPageLoad();
      cy.wait('@getBlogs');
      cy.get('body').should('be.visible');
    });

    it('displays blog entries from API', () => {
      cy.visit('/blog');
      cy.wait('@getBlogs');
      cy.waitForPageLoad();

      cy.contains('Understanding Flood Risk Levels').should('be.visible');
      cy.contains('How to Prepare for Floods').should('be.visible');
    });

    it('shows featured badge on featured blogs', () => {
      cy.visit('/blog');
      cy.wait('@getBlogs');
      cy.waitForPageLoad();

      cy.contains(/featured/i).should('exist');
    });

    it('shows blog categories', () => {
      cy.visit('/blog');
      cy.wait('@getBlogs');
      cy.waitForPageLoad();

      cy.contains(/education|safety/i).should('exist');
    });
  });

  describe('Create blog', () => {
    beforeEach(() => {
      cy.intercept('POST', '/api/blogs', (req) => {
        req.reply({ statusCode: 201, body: { id: 'new-blog-id', ...req.body } });
      }).as('createBlog');
    });

    it('renders create blog button', () => {
      cy.visit('/blog');
      cy.waitForPageLoad();

      cy.get('button').contains(/new|create|add.*blog/i).should('be.visible');
    });

    it('opens blog creation form', () => {
      cy.visit('/blog');
      cy.waitForPageLoad();

      cy.get('button').contains(/new|create|add.*blog/i).first().click();
      cy.get('input[name="title"], input[placeholder*="title" i]').should('be.visible');
    });

    it('creates blog with title and body', () => {
      cy.visit('/blog');
      cy.waitForPageLoad();

      cy.get('button').contains(/new|create|add.*blog/i).first().click();

      cy.get('input[name="title"], input[placeholder*="title" i]').first()
        .type('New Flood Safety Guide');
      cy.get('textarea[name="body"], [contenteditable="true"]').first()
        .type('This guide covers essential safety tips during floods...');

      cy.get('button[type="submit"]').filter(':visible').first().click();
      cy.wait('@createBlog');
      cy.contains(/created|success/i).should('be.visible');
    });
  });

  describe('Edit & Delete blog', () => {
    beforeEach(() => {
      cy.intercept('PUT', '/api/blogs/*', (req) => {
        req.reply({ statusCode: 200, body: { id: 'blog-uuid-001', ...req.body } });
      }).as('updateBlog');
      cy.intercept('DELETE', '/api/blogs/*', { statusCode: 204 }).as('deleteBlog');
    });

    it('has edit action available per blog', () => {
      cy.visit('/blog');
      cy.wait('@getBlogs');
      cy.waitForPageLoad();

      cy.get('button, a').contains(/edit/i).should('exist');
    });

    it('has delete action available per blog', () => {
      cy.visit('/blog');
      cy.wait('@getBlogs');
      cy.waitForPageLoad();

      cy.get('button').contains(/delete/i).should('exist');
    });
  });
});
