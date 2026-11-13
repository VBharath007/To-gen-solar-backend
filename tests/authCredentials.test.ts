import { describe, it, expect } from 'vitest';
import { newDomainDb } from '../src/sql-compat';

describe('Auth Credentials & Dynamic Password', () => {
  it('reads default credentials when app_settings has no entry', () => {
    const db = newDomainDb();
    try {
      const row = db.prepare("SELECT value FROM app_settings WHERE key = 'auth_credentials'").get() as { value: string } | undefined;
      let email = 'alagupandi@gmail.com';
      let password = 'password123';
      if (row && row.value) {
        try {
          const parsed = JSON.parse(row.value);
          if (parsed.email) email = parsed.email;
          if (parsed.password) password = parsed.password;
        } catch (_) {}
      }
      expect(email).toBe('alagupandi@gmail.com');
      expect(password).toBe('password123');
    } finally {
      db.close();
    }
  });

  it('updates password dynamically and retrieves the new password', () => {
    const db = newDomainDb();
    try {
      const newCreds = JSON.stringify({ email: 'alagupandi@gmail.com', password: 'myNewSecurePassword123' });

      db.prepare(`
        INSERT INTO app_settings (key, value, updated_at)
        VALUES ('auth_credentials', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(newCreds);

      const row = db.prepare("SELECT value FROM app_settings WHERE key = 'auth_credentials'").get() as { value: string } | undefined;
      expect(row).toBeDefined();
      const parsed = JSON.parse(row!.value);
      expect(parsed.email).toBe('alagupandi@gmail.com');
      expect(parsed.password).toBe('myNewSecurePassword123');
    } finally {
      db.close();
    }
  });

  it('persists multiple password updates without data corruption', () => {
    const db = newDomainDb();
    try {
      const initial = JSON.stringify({ email: 'alagupandi@gmail.com', password: 'firstPassword' });
      db.prepare(`
        INSERT INTO app_settings (key, value, updated_at)
        VALUES ('auth_credentials', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(initial);

      const updated = JSON.stringify({ email: 'alagupandi@gmail.com', password: 'secondPassword' });
      db.prepare(`
        INSERT INTO app_settings (key, value, updated_at)
        VALUES ('auth_credentials', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(updated);

      const row = db.prepare("SELECT value FROM app_settings WHERE key = 'auth_credentials'").get() as { value: string };
      const parsed = JSON.parse(row.value);
      expect(parsed.password).toBe('secondPassword');
    } finally {
      db.close();
    }
  });
});
