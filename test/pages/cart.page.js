import BasePage from './base.page.js';

class CartPage extends BasePage {
  get title() {
    return $('.title');
  }

  get checkoutButton() {
    return $('#checkout');
  }

  get cartItems() {
    return $$('.cart_item');
  }

  async expectCartPageDisplayed() {
    await this.title.waitForDisplayed();
    await expect(this.title).toHaveText('Your Cart');
    await expect(browser).toHaveUrl(expect.stringContaining('/cart.html'));
  }

  async isProductDisplayed(productName) {
    await this.expectCartPageDisplayed();

    const items = await this.cartItems;

    for (const item of items) {
      const nameElement = await item.$('.inventory_item_name');
      const name = await nameElement.getText();

      if (name === productName) {
        return true;
      }
    }

    return false;
  }

  async proceedToCheckout() {
    await this.checkoutButton.waitForClickable();
    await this.checkoutButton.click();
  }
}

export default new CartPage();