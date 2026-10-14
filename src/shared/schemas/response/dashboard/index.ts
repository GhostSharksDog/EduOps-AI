export interface CategoryDistributionItem {
  id: string;
  name: string;
  count: number;
  percentage: number;
  color: string;
}

export interface CategoryDistributionResponse {
  categories: CategoryDistributionItem[];
}
