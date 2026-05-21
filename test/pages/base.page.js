class BasePage {
  async open(path = '/') {
    await browser.url(path);
  }
}

export default BasePage;