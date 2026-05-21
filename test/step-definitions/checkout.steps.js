import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@wdio/globals';

import LoginPage from '../pages/login.page.js';
import InventoryPage from '../pages/inventory.page.js';
import CartPage from '../pages/cart.page.js';
import CheckoutPage from '../pages/checkout.page.js';

Given('user is on the login page', async () => {
  await LoginPage.open();
});

Given(
  'user logs in with username {string} and password {string}',
  async (username, password) => {
    await LoginPage.login(username, password);
  }
);

Then('user should be redirected to the inventory page', async () => {
  await InventoryPage.expectInventoryPageDisplayed();
});

When('user adds product {string} to the cart', async (productName) => {
  await InventoryPage.addProductToCart(productName);
});

When('user opens the cart page', async () => {
  await InventoryPage.openCart();
});

Then('user should see product {string} in the cart', async (productName) => {
  const isDisplayed = await CartPage.isProductDisplayed(productName);
  await expect(isDisplayed).toBe(true);
});

When('user proceeds to checkout', async () => {
  await CartPage.proceedToCheckout();
});

When(
  'user fills checkout information with first name {string}, last name {string}, and postal code {string}',
  async (firstName, lastName, postalCode) => {
    await CheckoutPage.fillCheckoutInformation(firstName, lastName, postalCode);
  }
);

When('user continues checkout', async () => {
  await CheckoutPage.continueCheckout();
});

Then('user should see checkout overview', async () => {
  await CheckoutPage.expectCheckoutOverviewDisplayed();
});

Then('user should see product {string} in checkout overview', async (productName) => {
  const isDisplayed = await CheckoutPage.isProductDisplayedInOverview(productName);
  await expect(isDisplayed).toBe(true);
});

When('user finishes the checkout', async () => {
  await CheckoutPage.finishCheckout();
});

Then('user should see order confirmation message {string}', async (expectedMessage) => {
  const actualMessage = await CheckoutPage.getCompleteHeaderText();
  await expect(actualMessage).toBe(expectedMessage);
});