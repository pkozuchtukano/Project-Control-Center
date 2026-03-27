const { app } = require('electron');
const Database = require('better-sqlite3');
app.whenReady().then(() => {
  const db = new Database('baza_danych.db', { readonly: true });
  const rows = db.prepare('SELECT data FROM orders').all();
  const matches = rows.map(r => JSON.parse(r.data)).filter(o => String(o.orderNumber) === '62');
  console.log(JSON.stringify(matches, null, 2));
  app.exit(0);
});
