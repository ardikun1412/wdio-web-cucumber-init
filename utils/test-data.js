import users from '../test/data/users.json' with { type: 'json' };
import products from '../test/data/products.json' with { type: 'json' };
import checkout from '../test/data/checkout.json' with { type: 'json' };
import { credentials } from '../config/env.config.js';

export const getUser = (alias) => {
  const user = users[alias];
  if (!user) throw new Error(`User data alias not found: ${alias}`);
  return {
    username: credentials[user.usernameKey],
    password: credentials[user.passwordKey],
    expectedError: user.expectedError
  };
};

export const getProduct = (alias) => {
  const product = products[alias];
  if (!product) throw new Error(`Product data alias not found: ${alias}`);
  return product;
};

export const getCheckoutData = (alias) => {
  const customer = checkout[alias];
  if (!customer) throw new Error(`Checkout data alias not found: ${alias}`);
  return customer;
};
