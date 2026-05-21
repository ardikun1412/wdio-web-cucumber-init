import BasePage from './base.page.js';

class CheckoutPage extends BasePage {
  get title() {
    return $('.title');
  }

  get firstNameInput() {
    return $('#first-name');
  }

  get lastNameInput() {
    return $('#last-name');
  }

  get postalCodeInput() {
    return $('#postal-code');
  }

  get continueButton() {
    return $('#continue');
  }

  get finishButton() {
    return $('#finish');
  }

  get completeHeader() {
    return $('.complete-header');
  }

  get overviewItems() {
    return $$('.cart_item');
  }

  async fillCheckoutInformation(firstName, lastName, postalCode) {
    await this.firstNameInput.waitForDisplayed();
    await this.firstNameInput.setValue(firstName);
    await this.lastNameInput.setValue(lastName);
    await this.postalCodeInput.setValue(postalCode);
  }

  async continueCheckout() {
    await this.continueButton.waitForClickable();
    await this.continueButton.click();
  }

  async expectCheckoutOverviewDisplayed() {
    await this.title.waitForDisplayed();
    await expect(this.title).toHaveText('Checkout: Overview');
    await expect(browser).toHaveUrl(expect.stringContaining('/checkout-step-two.html'));
  }

  async isProductDisplayedInOverview(productName) {
    await this.expectCheckoutOverviewDisplayed();

    const items = await this.overviewItems;

    for (const item of items) {
      const nameElement = await item.$('.inventory_item_name');
      const name = await nameElement.getText();

      if (name === productName) {
        return true;
      }
    }

    return false;
  }

  async finishCheckout() {
    await this.finishButton.waitForClickable();
    await this.finishButton.click();
  }

  async getCompleteHeaderText() {
    await this.completeHeader.waitForDisplayed();
    return this.completeHeader.getText();
  }
}

export default new CheckoutPage();