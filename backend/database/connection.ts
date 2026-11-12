import { AsyncLocalStorage } from 'node:async_hooks';
import type { MemoryDomainDb } from '../../src/sql-compat';
export const domainContext = new AsyncLocalStorage<MemoryDomainDb>();
export function getDb(): MemoryDomainDb { const db=domainContext.getStore(); if(!db) throw new Error('No request database context'); return db; }
export function isDatabaseInitialized() { return !!domainContext.getStore(); }
export function checkpointDatabase(_db?: any): void {}
export function reopenDatabase(_db?: any): void {}
export function verifyDatabaseIntegrity(_db?: any): { ok: boolean; message?: string } { return { ok: true }; }
