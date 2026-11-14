import type { LunarLocation } from '../types';
import { candidateSites } from '../constants/mockData';
import { apiClient, isMockMode } from './apiClient';
export const siteService = { getSites: async (): Promise<LunarLocation[]> => isMockMode ? candidateSites : apiClient('/sites') };

