export type StepItem = {
  label: string;
};

export const CALENDAR_REAUTH_MARKER = "REAUTH_REQUIRED_CALENDAR_SCOPE:";
export const DEFAULT_USER_TIMEZONE = "Asia/Tokyo";

export const STEP_ITEMS: StepItem[] = [
  { label: "認証" },
  { label: "入力" },
  { label: "実行" },
  { label: "結果" },
];
