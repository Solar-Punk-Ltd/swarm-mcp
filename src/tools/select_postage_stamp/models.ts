export interface SelectPostageStampArgs {
  label: string;
  selected: boolean;
}

export interface SelectPostageStampResult {
  success: boolean;
  label: string;
  selected: boolean;
  selectedStamps: string[];
}
