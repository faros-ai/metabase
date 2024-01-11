/*
 * Shared component for Scalar and SmartScalar to make sure our number presentation stays in sync
 */
/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";

import Icon from "metabase/components/Icon";
import Tooltip from "metabase/core/components/Tooltip";
import PopoverWithTrigger from "metabase/components/PopoverWithTrigger";
import Ellipsified from "metabase/core/components/Ellipsified";
import {
  ChartExplanationPopover,
  defaultExplanation,
  getMessageHandler,
  getPopoverHandler,
} from "../ChartExplanationPopover";
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
  const [explanation, setExplanation] = useState(defaultExplanation);
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);

  const explanationIconRef = React.createRef();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handlePopover = useCallback(
    getPopoverHandler(
      explanation,
      isExplanationOpen,
      setIsExplanationOpen,
      title,
      chartExtras,
    ),
    [explanation, isExplanationOpen, setIsExplanationOpen, title, chartExtras],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleMessage = useCallback(
    getMessageHandler(setExplanation, chartExtras),
    [setExplanation, chartExtras],
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [handleMessage]);

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
            <ChartExplanationPopover
              explanation={explanation}
              handlePopover={handlePopover}
            />
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
