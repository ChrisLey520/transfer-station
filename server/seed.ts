import 'dotenv/config';
import { initDb } from './db.js';
import { seedDefaults } from './store.js';

initDb();
seedDefaults();
console.log('Seed data is ready.');
