import dotenv from 'dotenv';

dotenv.config();

const environments = {
  dev: {
    baseUrl: 'https://www.saucedemo.com',
    defaultTimeout: 10000
  },
  staging: {
    baseUrl: process.env.STAGING_BASE_URL || 'https://www.saucedemo.com',
    defaultTimeout: 10000
  },
  prod: {
    baseUrl: process.env.PROD_BASE_URL || 'https://www.saucedemo.com',
    defaultTimeout: 15000
  }
};

export const testEnv = process.env.TEST_ENV || 'dev';
export const envConfig = environments[testEnv] || environments.dev;
export const credentials = {
  standardUser: process.env.STANDARD_USER || 'standard_user',
  lockedOutUser: process.env.LOCKED_OUT_USER || 'locked_out_user',
  password: process.env.PASSWORD || 'secret_sauce'
};
