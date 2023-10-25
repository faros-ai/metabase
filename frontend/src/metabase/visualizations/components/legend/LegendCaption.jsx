import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import PropTypes from "prop-types";
import { iconPropTypes } from "metabase/components/Icon";
import Tooltip from "metabase/core/components/Tooltip";
import Ellipsified from "metabase/core/components/Ellipsified";
import PopoverWithTrigger from "metabase/components/PopoverWithTrigger";
import LegendActions from "./LegendActions";
import {
  LegendCaptionRoot,
  LegendDescriptionIcon,
  LegendLabel,
  LegendLabelIcon,
  LegendRightContent,
} from "./LegendCaption.styled";

const propTypes = {
  className: PropTypes.string,
  title: PropTypes.string,
  description: PropTypes.string,
  icon: PropTypes.shape(iconPropTypes),
  actionButtons: PropTypes.node,
  onSelectTitle: PropTypes.func,
  chartExtras: PropTypes.object,
};

const LegendCaption = ({
  className,
  title,
  description,
  icon,
  actionButtons,
  onSelectTitle,
  chartExtras = undefined,
}) => {
  const enableChartExplainer = useSelector(
    state => state.embed.options.enable_chart_explainer,
  );
  const defaultExplanation = "hang tight ...";
  const [explanation, setExplanation] = useState(defaultExplanation);
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);

  const explanationIconRef = React.createRef();

  const handlePopover = event => {
    if (window.parent !== window && explanation === defaultExplanation) {
      const messageData = {
        lighthouse: {
          type: "ChartExplainer",
          payload: { ...chartExtras, title },
        },
      };
      window.parent.postMessage(messageData, "*");
      console.log(`write to parent window: ${messageData}`);
    }
    setIsExplanationOpen(!isExplanationOpen);
  };

  const handleMessage = event => {
    if (
      event.source === window.parent &&
      event.data.lighthouse &&
      event.data.lighthouse.type === "ChartExplainer"
    ) {
      const {
        dashboard_id: dashboardId,
        id,
        explanation: chartExplanation,
      } = event.data.lighthouse.payload;

      if (
        chartExtras &&
        chartExtras["dashboard_id"] === dashboardId &&
        chartExtras["id"] === id
      ) {
        console.log(`Message from ${event.origin}: ${event.data}`);
        setExplanation(chartExplanation);
      }
    }
  };

  useEffect(() => {
    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  });

  const explanationPopover = (
    <div
      style={{
        display: "flex",
        padding: "16px",
        flexDirection: "column",
        alignItems: "flex-start",
        alignSelf: "stretch",
        borderRadius: "4px",
        background: "var(--background-dark, #023D67)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          width: "100%",
          alignItems: "baseline",
        }}
      >
        <span
          style={{
            flex: "1 0 0",
            color: "var(--text-dark-header, #FFF)",
            fontFamily: "Lato",
            fontSize: "19px",
            fontStyle: "normal",
            fontWeight: 600,
            lineHeight: "28.5px",
            marginBottom: "12px",
          }}
        >
          <img
            src="app/assets/img/faros.svg"
            alt="faros"
            style={{ width: "24px", height: "24px", marginRight: "12px" }}
          />
          <span style={{ verticalAlign: "text-bottom" }}>Chart Explainer</span>
        </span>
        <img
          src="app/assets/img/close.svg"
          alt="x"
          style={{ width: "20px", height: "20px" }}
          onClick={handlePopover}
        />
      </div>
      <span
        style={{
          alignSelf: "stretch",
          color: "var(--text-dark-body-subtle, #8EBFD6)",
          fontFamily: "Lato",
          fontSize: "16px",
          fontStyle: "normal",
          fontWeight: 400,
          lineHeight: "24px",
        }}
      >
        {explanation}
      </span>
    </div>
  );

  return (
    <LegendCaptionRoot className={className} data-testid="legend-caption">
      {icon && <LegendLabelIcon {...icon} />}
      <LegendLabel
        className="fullscreen-normal-text fullscreen-night-text"
        onClick={onSelectTitle}
      >
        <Ellipsified>{title}</Ellipsified>
      </LegendLabel>
      <LegendRightContent>
        {enableChartExplainer && (
          <PopoverWithTrigger
            isOpen={isExplanationOpen}
            triggerElement={
              <LegendDescriptionIcon
                name="faros"
                className="hover-child hover-child--smooth"
                onClick={handlePopover}
                ref={explanationIconRef}
                style={{ verticalAlign: "bottom", paddingBottom: "0.5px" }}
              />
            }
            pinInitialAttachment
            verticalAttachments={["bottom"]}
            alignVerticalEdge
            alignHorizontalEdge={false}
            targetOffsetX={20}
            targetOffsetY={30}
            hasArrow
          >
            {explanationPopover}
          </PopoverWithTrigger>
        )}
        {description && (
          <Tooltip tooltip={description} maxWidth="22em">
            <LegendDescriptionIcon className="hover-child hover-child--smooth" />
          </Tooltip>
        )}
        {actionButtons && <LegendActions>{actionButtons}</LegendActions>}
      </LegendRightContent>
    </LegendCaptionRoot>
  );
};

LegendCaption.propTypes = propTypes;

export default LegendCaption;
