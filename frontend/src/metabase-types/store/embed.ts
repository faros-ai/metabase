export interface EmbedOptions {
  font?: string;
  top_nav?: boolean;
  search?: boolean;
  new_button?: boolean;
  breadcrumbs?: boolean;
  logo?: boolean;
  side_nav?: boolean | "default";
  header?: boolean;
  additional_info?: boolean;
  action_buttons?: boolean;
  enable_chart_explainer?: boolean;
  enable_dashboard_summarizer?: boolean;
}

export interface EmbedState {
  options: EmbedOptions;
}
