import type { AnalysisRequest, AnalysisResult, LandingSiteComparison, Recommendation, TimelinePoint } from '../types';
import { mockAnalysis } from '../constants/mockData';
import { apiClient, isMockMode } from './apiClient';
export const analysisService = {
 analyze: async (request: AnalysisRequest): Promise<AnalysisResult> => isMockMode ? mockAnalysis(request) : apiClient('/analysis',request),
 timeline: async (request: AnalysisRequest): Promise<TimelinePoint[]> => isMockMode ? mockAnalysis(request).illumination.timeline : apiClient('/timeline',request),
 compare: async (requests: AnalysisRequest[]): Promise<LandingSiteComparison> => isMockMode ? {results:requests.map(mockAnalysis)} : apiClient('/comparisons',{requests}),
 recommendations: async (request: AnalysisRequest): Promise<Recommendation[]> => isMockMode ? [] : apiClient('/recommendations',request),
};

