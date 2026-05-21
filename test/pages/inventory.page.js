import BasePage from './base.page.js';

class InventoryPage extends BasePage {
  get title() {
    return $('.title');
  }

  get cartLink() {
    return $('.shopping_cart_link');
  }

  get inventoryItems() {
    return $$('.inventory_item');
  }

  async isLoaded() {
    await this.title.waitForDisplayed();
    return (await this.title.getText()) === 'Products';
  }

  async expectInventoryPageDisplayed() {
    await this.title.waitForDisplayed();
    await expect(this.title).toHaveText('Products');
    await expect(browser).toHaveUrl(expect.stringContaining('/inventory.html'));
  }

  async addProductToCart(productName) {
    const product = await this.getProductCardByName(productName);
    const addToCartButton = await product.$('button');

    await addToCartButton.waitForClickable();
    await addToCartButton.click();
  }

  async openCart() {
    await this.cartLink.waitForClickable();
    await this.cartLink.click();
  }

  async getProductCardByName(productName) {
    const items = await this.inventoryItems;

    for (const item of items) {
      const nameElement = await item.$('.inventory_item_name');
      const name = await nameElement.getText();

      if (name === productName) {
        return item;
      }
    }

    throw new Error(`Product "${productName}" was not found on inventory page`);
  }
}

export default new InventoryPage();