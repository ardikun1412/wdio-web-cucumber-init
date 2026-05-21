import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@wdio/globals';
import loginPage from '../pages/login.page.js';
import inventoryPage from '../pages/inventory.page.js';
import { getUser } from '../../utils/test-data.js';

Given('user opens SauceDemo login page', async () => {
  await loginPage.open();
});

When('user logs in using {string} credential data', async (userAlias) => {
  const user = getUser(userAlias);
  await loginPage.login(user.username, user.password);
});

Then('login result should be {string} for {string}', async (expectedResult, userAlias) => {
  if (expectedResult === 'success') {
    await expect(await inventoryPage.isLoaded()).toBe(true);
    return;
  }

  const user = getUser(userAlias);
  await expect(await loginPage.getErrorMessage()).toContain(user.expectedError);
});

Then('user should see inventory page', async () => {
  await expect(await inventoryPage.isLoaded()).toBe(true);
});
