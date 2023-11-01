/*
 * Shared component for Scalar and SmartScalar to make sure our number presentation stays in sync
 */
/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";

import Icon from "metabase/components/Icon";
import Tooltip from "metabase/core/components/Tooltip";
import PopoverWithTrigger from "metabase/components/PopoverWithTrigger";
import Ellipsified from "metabase/core/components/Ellipsified";
import {
  ScalarRoot,
  ScalarValueWrapper,
  ScalarTitleContainer,
  ScalarDescriptionContainer,
  ScalarDescriptionPlaceholder,
  ScalarTitleContent,
} from "./ScalarValue.styled";

import { findSize, getMaxFontSize } from "./utils";

const HORIZONTAL_PADDING = 32;

export const ScalarWrapper = ({ children }) => (
  <ScalarRoot>{children}</ScalarRoot>
);

const ScalarValue = ({
  value,
  width,
  gridSize,
  totalNumGridCols,
  fontFamily,
}) => {
  const fontSize = useMemo(
    () =>
      findSize({
        text: value,
        targetWidth: width - HORIZONTAL_PADDING,
        fontFamily: fontFamily ?? "Lato",
        fontWeight: 900,
        unit: "rem",
        step: 0.2,
        min: 2.2,
        max: gridSize ? getMaxFontSize(gridSize.width, totalNumGridCols) : 4,
      }),
    [fontFamily, gridSize, totalNumGridCols, value, width],
  );

  return (
    <ScalarValueWrapper
      className="ScalarValue"
      fontSize={fontSize}
      data-testid="scalar-value"
    >
      {value}
    </ScalarValueWrapper>
  );
};

export const ScalarTitle = ({
  title,
  description,
  onClick,
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
    }
    setIsExplanationOpen(!isExplanationOpen);
  };

  const handleMessage = event => {
    if (
      event.source === window.parent &&
      event.data.lighthouse &&
      event.data.lighthouse?.type === "ChartExplainer"
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
    <ScalarTitleContainer>
      {/*
      This is a hacky spacer so that the h3 is centered correctly.
      It needs match the width of the tooltip icon on the other side.
     */}
      {description && description.length > 0 && (
        <ScalarDescriptionPlaceholder />
      )}
      <ScalarTitleContent
        className="fullscreen-normal-text fullscreen-night-text"
        data-testid="scalar-title"
        onClick={onClick}
      >
        <Ellipsified tooltip={title} lines={2} placement="bottom">
          {title}
        </Ellipsified>
      </ScalarTitleContent>

      <ScalarDescriptionContainer>
        {enableChartExplainer && (
          <PopoverWithTrigger
            isOpen={isExplanationOpen}
            triggerElement={
              <Icon
                name="faros"
                className="hover-child hover-child--smooth"
                onClick={handlePopover}
                ref={explanationIconRef}
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
        {description && description.length > 0 && (
          <Tooltip tooltip={description} maxWidth="22em">
            <Icon
              name="info_outline"
              className="hover-child hover-child--smooth"
            />
          </Tooltip>
        )}
      </ScalarDescriptionContainer>
    </ScalarTitleContainer>
  );
};

export default ScalarValue;
