class BasePage {
  /**
   * Navigate to a specific path
   */
  async open(path = '/') {
    await browser.url(path);
  }

  /**
   * Get current page title
   */
  async getPageTitle() {
    return browser.getTitle();
  }

  /**
   * Get current page URL
   */
  async getCurrentUrl() {
    return browser.getUrl();
  }

  /**
   * Wait until page is fully loaded
   */
  async waitForPageLoad(timeout = 10000) {
    await browser.waitUntil(
      async () => {
        const state = await browser.execute(() => document.readyState);
        return state === 'complete';
      },
      {
        timeout,
        timeoutMsg: `Page did not finish loading within ${timeout}ms`
      }
    );
  }

  /**
   * Scroll to top of page
   */
  async scrollToTop() {
    await browser.execute(() => window.scrollTo(0, 0));
  }

  /**
   * Scroll to bottom of page
   */
  async scrollToBottom() {
    await browser.execute(() =>
      window.scrollTo(0, document.body.scrollHeight)
    );
  }
}

export default BasePage;