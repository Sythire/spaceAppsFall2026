import type { LunarLocation } from '../types';
import { candidateSites } from '../constants/mockData';
import { apiClient, isMockMode } from './apiClient';
import {loadSiteCatalogue} from './siteCatalogue';
export const siteService = { getSites: async (): Promise<LunarLocation[]> => isMockMode ? candidateSites : loadSiteCatalogue(()=>apiClient<LunarLocation[]>('/sites')) };

