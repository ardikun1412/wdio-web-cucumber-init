import dotenv from 'dotenv';
dotenv.config();

// Ambil status environment dari .env, default ke 'dev'
export const testEnv = process.env.TEST_ENV || 'dev';

const environments = {
  dev: {
    baseUrl: 'https://www.saucedemo.com/',
    defaultTimeout: 10000
  },
  staging: {
    baseUrl: 'https://www.saucedemo.com/',
    defaultTimeout: 10000
  }
};

// Ekspor config URL-nya saja
export const envConfig = environments[testEnv] || environments.dev;