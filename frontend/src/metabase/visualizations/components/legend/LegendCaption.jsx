import PropTypes from "prop-types";

import { Ellipsified } from "metabase/core/components/Ellipsified";
import { useSelector } from "metabase/lib/redux";

import { ChartDescriptionPopover } from "../ChartDescriptionPopover";
import {
  ChartExplainerPopover,
  ChartExplainerType,
} from "../ChartExplainerPopover";

import LegendActions from "./LegendActions";
import {
  LegendCaptionRoot,
  LegendLabel,
  LegendLabelIcon,
  LegendRightContent,
} from "./LegendCaption.styled";

const propTypes = {
  className: PropTypes.string,
  title: PropTypes.string,
  description: PropTypes.string,
  icon: PropTypes.object,
  actionButtons: PropTypes.node,
  onSelectTitle: PropTypes.func,
  width: PropTypes.number,
  chartExtras: PropTypes.object,
};

// eslint-disable-next-line no-unused-vars
function shouldHideDescription(width) {
  const HIDE_DESCRIPTION_THRESHOLD = 100;
  return width != null && width < HIDE_DESCRIPTION_THRESHOLD;
}

const LegendCaption = ({
  className,
  title,
  description,
  icon,
  actionButtons,
  onSelectTitle,
  width,
  chartExtras,
}) => {
  // eslint-disable-next-line no-unused-vars
  const enableChartExplainer = useSelector(
    state => state.embed.options.enable_chart_explainer,
  );

  return (
    <LegendCaptionRoot className={className} data-testid="legend-caption">
      {icon && <LegendLabelIcon {...icon} />}
      <LegendLabel
        className="fullscreen-normal-text fullscreen-night-text"
        onClick={onSelectTitle}
      >
        <Ellipsified data-testid="legend-caption-title">{title}</Ellipsified>
      </LegendLabel>
      <LegendRightContent>
        {enableChartExplainer && (
          <>
            <ChartExplainerPopover
              type={ChartExplainerType.SUMMARY}
              title={title}
              chartExtras={chartExtras}
            />

            {description && description.length > 0 ? (
              <ChartDescriptionPopover description={description} />
            ) : (
              <ChartExplainerPopover
                type={ChartExplainerType.DESCRIPTION}
                title={title}
                chartExtras={chartExtras}
              />
            )}
          </>
        )}

        {actionButtons && <LegendActions>{actionButtons}</LegendActions>}
      </LegendRightContent>
    </LegendCaptionRoot>
  );
};

LegendCaption.propTypes = propTypes;

export default LegendCaption;
