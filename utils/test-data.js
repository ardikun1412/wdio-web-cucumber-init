import fs from 'fs';
import path from 'path';
import { testEnv } from '../config/env.config.js';

export function getUsers() {
    const usersDataPath = path.resolve('./test/data/users.json');
    const usersData = JSON.parse(fs.readFileSync(usersDataPath, 'utf8'));
    return usersData[testEnv]; 
}

export function getProducts() {
    const productsDataPath = path.resolve('./test/data/products.json');
    const productsData = JSON.parse(fs.readFileSync(productsDataPath, 'utf8'));
    return productsData[testEnv];
}

export function getCheckoutData() {
    const checkoutDataPath = path.resolve('./test/data/checkout.json');
    const checkoutData = JSON.parse(fs.readFileSync(checkoutDataPath, 'utf8'));
    return checkoutData[testEnv];
}
