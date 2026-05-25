import fs from 'fs';
import path from 'path';
import { testEnv } from '../config/env.config.js';

export function getUsers() {
  const usersDataPath = path.resolve('./test/data/users.json');
  const usersData = JSON.parse(fs.readFileSync(usersDataPath, 'utf8'));
  return usersData[testEnv];
}
