import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@wdio/globals';
import loginPage from '../pages/login.page.js';
import inventoryPage from '../pages/inventory.page.js';
import { getUsers } from '../../utils/test-data.js';

Given('user opens SauceDemo login page', async () => {
  await loginPage.open();
});

When('user logs in using {string} credential data', async (userAlias) => {

  const userData = getUsers();
  const user = userData[userAlias];
  if (!user) {
    throw new Error(`Tipe kredensial "${userAlias}" tidak dikenali!`);
  }
  await loginPage.login(user.username, user.password);

});

Then('login result should be {string} for {string}', async (expectedResult, userAlias) => {

  const userData = getUsers();
  if (expectedResult === 'success') {
    await expect(await inventoryPage.isLoaded()).toBe(true);
    return;
  }
  if (expectedResult === 'error') {
    await expect(await loginPage.getErrorMessage()).toContain(userData[userAlias].expectedError);
    return;
  }
  
});

Then('user should see inventory page', async () => {
  await expect(await inventoryPage.isLoaded()).toBe(true);
});
