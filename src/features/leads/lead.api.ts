import type { Lead, CreateLeadDto, UpdateLeadDto } from '@shared/types/lead.types';

/**
 * Service wrapper for leads Desktop Bridge API.
 * 
 * Provides a clean interface for React components to interact with the main process,
 * throwing standard Error objects on failure so React Query or Error Boundaries can catch them.
 */
export const leadApi = {
  async list(): Promise<Lead[]> {
    const res = await window.desktop.leads.list();
    if (!res.success) throw new Error(res.error?.message || 'Failed to fetch leads');
    return res.data;
  },

  async get(id: number): Promise<Lead> {
    const res = await window.desktop.leads.get(id);
    if (!res.success) throw new Error(res.error?.message || 'Failed to fetch lead');
    return res.data;
  },

  async create(dto: CreateLeadDto): Promise<Lead> {
    const res = await window.desktop.leads.create(dto);
    if (!res.success) throw new Error(res.error?.message || 'Failed to create lead');
    return res.data;
  },

  async update(dto: UpdateLeadDto): Promise<Lead> {
    const res = await window.desktop.leads.update(dto);
    if (!res.success) throw new Error(res.error?.message || 'Failed to update lead');
    return res.data;
  },

  async delete(id: number): Promise<void> {
    const res = await window.desktop.leads.delete(id);
    if (!res.success) throw new Error(res.error?.message || 'Failed to delete lead');
  },
};
