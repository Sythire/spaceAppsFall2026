/** Per-site series colours, shared by the comparison chips and the comparison charts/heatmap so a
 * module's tag matches its line, bar and heatmap row. Index = position in the comparison (max 3). */
export const SITE_SERIES_COLORS = ['#6b5bd3', '#e0883c', '#2f9e8f'];
export const siteColor = (i: number) => SITE_SERIES_COLORS[i % SITE_SERIES_COLORS.length];
