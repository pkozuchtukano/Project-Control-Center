import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'baza_danych.db');
const db = new Database(dbPath);

const projects = db.prepare('SELECT data FROM projects').all().map(r => JSON.parse(r.data));
console.log(JSON.stringify(projects, null, 2));

const workItemsCount = db.prepare('SELECT count(*) as count FROM work_items').get();
console.log('Work items:', workItemsCount.count);
