import type { MapLayerDefinition } from '../types';
import { mapLayers } from '../constants/mockData';
import { apiClient, isMockMode } from './apiClient';
export const mapService = { getLayers: async (): Promise<MapLayerDefinition[]> => isMockMode ? mapLayers : apiClient('/map/layers') };

