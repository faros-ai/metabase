import type { ThunkDispatch, AnyAction } from "@reduxjs/toolkit";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useState } from "react";
import { isEqual } from "underscore";

import { Icon } from "metabase/core/components/Icon";
import { setDashboardSummary } from "metabase/dashboard/actions";
import { useDispatch, useSelector } from "metabase/lib/redux";
import { Button, Loader } from "metabase/ui";
import type { DashCardDataMap, Dashboard } from "metabase-types/api";
import type {
  DashboardSummary,
  Insight,
  SelectedTabId,
  State,
} from "metabase-types/store";

import { DashboardInfoSidebarRoot } from "../DashboardInfoSidebar/DashboardInfoSidebar.styled";

import {
  ChartTitle,
  InsightDescription,
  InsightReferences,
  InsightTitle,
} from "./DashboardLighthouseAISidebar.styled";

type DashboardAttributeType = string | number | null | boolean;

interface DashboardLighthouseAISidebarProps {
  dashboard: Dashboard;
  dashcardData: DashCardDataMap;
  selectedTabId: SelectedTabId;
  parameterValues: object;
  setDashboardAttribute: (name: string, value: DashboardAttributeType) => void;
}

interface DashboardSummaryErrorProps {
  setFailed: Dispatch<SetStateAction<boolean>>;
  postMessage: () => void;
}

interface CopyToClipboardProps {
  text: string;
}

const LOADING = "Loading dashboard ...";
const FAILED =
  "We encountered an error while running the analysis. Please try again later.";
const RUNNING = "Analyzing dashboad ... Please wait, this may take a moment.";
const NO_CHARTS = "NO_CHARTS";
const NO_QUERY_RESULTS_FOR_ALL_CHARTS = "NO_QUERY_RESULTS_FOR_ALL_CHARTS";
const NO_QUERY_RESULTS_FOR_SOME_CHARTS = "NO_QUERY_RESULTS_FOR_SOME_CHARTS";

function isDashboardLoaded(
  dashboard: Dashboard,
  dashcardData: DashCardDataMap,
  selectedTabId: SelectedTabId,
) {
  return dashboard.dashcards.every(dashcard => {
    if (selectedTabId && selectedTabId !== dashcard.dashboard_tab_id) {
      return true;
    }
    const card_ids = [];
    if (dashcard.card_id) {
      card_ids.push(dashcard.card_id);
    }
    if ("series" in dashcard) {
      dashcard.series?.every(card => {
        card_ids.push(card.id);
      });
    }
    return card_ids.every(
      card_id =>
        card_id in dashcardData[dashcard.id] &&
        dashcardData[dashcard.id][card_id],
    );
  });
}

function hasInsights(insights: Insight[] | undefined) {
  return insights && insights.length > 0;
}

function getMessageHandler(
  dashboardId: number,
  selectedTabId: SelectedTabId,
  parameterValues: object,
  dispatch: ThunkDispatch<State, void, AnyAction>,
  setFailed: Dispatch<SetStateAction<boolean>>,
) {
  return (event: any) => {
    if (
      event &&
      event.source === window.parent &&
      event.data?.lighthouse?.type === "DashboardSummarizer" &&
      event.data?.lighthouse?.payload?.dashboard_id === dashboardId &&
      event.data?.lighthouse?.payload?.tab_id === selectedTabId &&
      isEqual(
        event.data?.lighthouse?.payload?.parameter_values,
        parameterValues,
      )
    ) {
      const { summary, error } = event.data.lighthouse.payload;
      if (error) {
        setFailed(true);
      } else if (
        hasInsights(summary?.insights) ||
        summary?.text ||
        summary?.error
      ) {
        dispatch(setDashboardSummary({ tabId: selectedTabId ?? -1, summary }));
      } else {
        setFailed(true);
      }
    }
  };
}

function Disclaimer() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        padding: "0px",
        gap: "12px",
        height: "fit-content",
        flex: "none",
        order: 0,
        flexGrow: 0,
        marginTop: "2em",
        marginBottom: "1em",
      }}
    >
      <Icon
        name="warning"
        color="#87CEEB"
        style={{
          width: "28px",
          height: "28px",
          flex: "None",
          order: 0,
          flexGrow: 0,
        }}
      />
      <div
        style={{
          fontSize: "smaller",
          order: 1,
          alignSelf: "stretch",
          flexGrow: 0,
        }}
      >
        AI learns from data, but predictions are estimates. Use AI as a helpful
        tool, not a replacement for your judgment.
      </div>
    </div>
  );
}

function SomeChartsUnavailable() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        padding: "0px",
        borderRadius: "6px",
        flex: "none",
        order: 1,
        alignSelf: "stretch",
        flexGrow: 0,
      }}
    >
      <div
        style={{
          background: "#023D67",
          width: "6px",
          borderRadius: "6px 0px 0px 6px",
          flex: "none",
          order: 0,
          alignSelf: "stretch",
          flexGrow: 0,
        }}
      ></div>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          padding: "0px",
          borderRadius: "8px",
          flex: "none",
          order: 1,
          alignSelf: "stretch",
          flexGrow: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            padding: "5px",
            gap: "12px",
            background: "#E2F7FF",
            flex: "none",
            order: 0,
            alignSelf: "stretch",
            flexGrow: 0,
          }}
        >
          <Icon
            name="info_filled"
            fill="#023D67"
            style={{
              width: "24px",
              height: "24px",
              flex: "None",
              order: 0,
              flexGrow: 0,
            }}
          />
          <div
            style={{
              width: "270px",
              fontFamily: "Lato",
              fontStyle: "normal",
              fontWeight: 400,
              lineHeight: "150%",
              color: "#072E45",
              flex: "none",
              order: 1,
              flexGrow: 1,
            }}
          >
            Some charts have no data or contain errors in their query. Only
            charts with valid data are summarized.
          </div>
        </div>
      </div>
    </div>
  );
}

function dashboardSummaryToString(
  insights: Insight[] | undefined,
  text: string | undefined,
) {
  return (
    insights
      ?.map((insight, _index) => {
        return [
          insight.title,
          insight.description,
          `Source: ${insight.sourceCharts?.join(", ")}`,
        ].join("\n");
      })
      .join("\n\n") ?? text
  );
}

function CopyToClipboard({ text }: CopyToClipboardProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-end",
        padding: "12px 12px",
        gap: "12px",
        background: "#F2F3F7",
        border: "1px solid #DADFF1",
        flex: "none",
        order: 2,
        alignSelf: "stretch",
        flexGrow: 0,
      }}
    >
      <Button
        leftIcon={<Icon name="copy" width={20} height={20} />}
        radius="md"
        size="md"
        onClick={() => {
          if (text.trim() !== "") {
            const messageData = {
              lighthouse: {
                type: "CopyText",
                payload: { text },
              },
            };
            window.parent.postMessage(messageData, "*");
          }
        }}
        style={{
          order: 2,
        }}
      >
        Copy All
      </Button>
    </div>
  );
}

function DashboardSummaryContents({ insights, text, error }: DashboardSummary) {
  const insightsAvailable = hasInsights(insights);
  return (
    <div style={{ padding: "8px 20px", background: "#FFFFFF" }}>
      {error === NO_QUERY_RESULTS_FOR_SOME_CHARTS && <SomeChartsUnavailable />}
      {insightsAvailable && (
        <ol style={{ listStyleType: "decimal", paddingLeft: "10px" }}>
          {insights?.map((insight, insightIndex) => {
            return (
              <li
                key={`dashboard-summary-insight-${insightIndex}`}
                style={{ marginTop: "1em", marginBottom: "1em" }}
              >
                {insight.title && <InsightTitle>{insight.title}</InsightTitle>}
                <InsightDescription>{insight.description}</InsightDescription>
                {insight.sourceCharts && insight.sourceCharts.length > 0 && (
                  <InsightReferences>
                    Source:
                    {insight.sourceCharts.flatMap((title, chartIndex) => [
                      <ChartTitle
                        key={`dashboard-summary-insight-${insightIndex}-source-chart-${chartIndex}`}
                      >
                        {title}
                      </ChartTitle>,
                      chartIndex < (insight.sourceCharts?.length ?? 0) - 1
                        ? ", "
                        : "",
                    ])}
                  </InsightReferences>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {!insightsAvailable && text}
      <Disclaimer />
    </div>
  );
}

function DashboardSummaryHeader() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        padding: "8px",
        gap: "8px",
        height: "68px",
        borderBottom: "2px solid #DADFF1",
        flex: "none",
        order: 0,
        alignSelf: "stretch",
        flexGrow: 0,
        background: "white",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "flex-end",
          alignItems: "flex-start",
          padding: "0px",
          gap: "12px",
          height: "50px",
          flex: "none",
          order: 4,
          alignSelf: "stretch",
          flexGrow: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            padding: "0px",
            gap: "16px",
            height: "50px",
            flex: "none",
            order: 1,
            flexGrow: 1,
          }}
        >
          <Icon
            name="faros"
            style={{
              width: "40px",
              height: "40px",
              flex: "None",
              order: 0,
              flexGrow: 0,
            }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "flex-start",
              padding: "0px",
              height: "50px",
              flex: "none",
              order: 1,
              flexGrow: 1,
            }}
          >
            <div
              style={{
                height: "29px",
                fontFamily: "Lato",
                fontStyle: "normal",
                fontWeight: 600,
                fontSize: "19px",
                lineHeight: "150%",
                display: "flex",
                alignItems: "center",
                color: "#072E45",
                flex: "none",
                order: 0,
                alignSelf: "stretch",
                flexGrow: 0,
              }}
            >
              Dashboard Summary
            </div>
            <div
              style={{
                height: "21px",
                fontFamily: "Lato",
                fontStyle: "normal",
                fontWeight: 400,
                fontSize: "14px",
                lineHeight: "150%",
                display: "flex",
                alignItems: "center",
                color: "#516B7B",
                flex: "none",
                order: 1,
                alignSelf: "stretch",
                flexGrow: 0,
              }}
            >
              AI-generated summary of the dashboard
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardSummaryLoading() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "12px",
        width: "100%",
        height: "76vh",
        overflowY: "scroll",
        background: "#F2F3F7",
        flex: "none",
        order: 1,
        alignSelf: "stretch",
        flexGrow: 1,
      }}
    >
      <div
        style={{
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "24px",
          gap: "24px",
          width: "100%",
          height: "100%",
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "12px",
          flex: "none",
          order: 0,
          alignSelf: "stretch",
          flexGrow: 1,
        }}
      >
        <Loader size={72} color="#15B1D7" />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "0px",
            gap: "8px",
            width: "fit-content",
            height: "fit-content",
            flex: "none",
            order: 1,
            alignSelf: "stretch",
            flexGrow: 0,
          }}
        >
          <div
            style={{
              fontFamily: "Lato",
              fontStyle: "normal",
              fontWeight: 600,
              fontSize: "18px",
              lineHeight: "150%",
              display: "flex",
              alignItems: "center",
              textAlign: "center",
              color: "#072E45",
              flex: "none",
              order: 0,
              alignSelf: "stretch",
              flexGrow: 0,
              justifyContent: "center",
            }}
          >
            Getting your answer...
          </div>
          <div
            style={{
              fontFamily: "Lato",
              fontStyle: "normal",
              fontWeight: 400,
              fontSize: "14px",
              lineHeight: "150%",
              display: "flex",
              alignItems: "center",
              textAlign: "center",
              color: "#516B7B",
              flex: "none",
              order: 1,
              alignSelf: "stretch",
              flexGrow: 0,
              justifyContent: "center",
            }}
          >
            To see your summary, keep this panel open until it’s finished.
            Leaving this page will restart the process. <br />
            Thanks for your patience!
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardSummaryError({
  setFailed,
  postMessage,
}: DashboardSummaryErrorProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "12px",
        width: "100%",
        height: "76vh",
        overflowY: "scroll",
        background: "#F2F3F7",
        flex: "none",
        order: 1,
        alignSelf: "stretch",
        flexGrow: 1,
      }}
    >
      <div
        style={{
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "24px",
          gap: "24px",
          width: "100%",
          height: "100%",
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "12px",
          flex: "none",
          order: 0,
          alignSelf: "stretch",
          flexGrow: 1,
        }}
      >
        <Icon
          name="disconnected_plug"
          style={{
            width: "72px",
            height: "72px",
            flex: "None",
            order: 0,
            flexGrow: 0,
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "0px",
            gap: "8px",
            width: "fit-content",
            height: "fit-content",
            flex: "none",
            order: 1,
            alignSelf: "stretch",
            flexGrow: 0,
          }}
        >
          <div
            style={{
              fontFamily: "Lato",
              fontStyle: "normal",
              fontWeight: 600,
              fontSize: "18px",
              lineHeight: "150%",
              display: "flex",
              alignItems: "center",
              textAlign: "center",
              color: "#072E45",
              flex: "none",
              order: 0,
              alignSelf: "stretch",
              flexGrow: 0,
              justifyContent: "center",
            }}
          >
            Unable to connect to Lighthouse AI
          </div>
          <div
            style={{
              fontFamily: "Lato",
              fontStyle: "normal",
              fontWeight: 400,
              fontSize: "15px",
              lineHeight: "150%",
              display: "flex",
              alignItems: "center",
              textAlign: "center",
              color: "#516B7B",
              flex: "none",
              order: 1,
              alignSelf: "stretch",
              flexGrow: 0,
              justifyContent: "center",
            }}
          >
            <span>
              If the problem persists, reach out to
              <br />
              our <span style={{ color: "#03749C" }}>support team</span> for
              further assistance.
            </span>
          </div>
        </div>
        <Button
          leftIcon={<Icon name="arrow_repeat" width={20} height={20} />}
          radius="md"
          size="md"
          onClick={() => {
            setFailed(false);
            postMessage();
          }}
          style={{
            order: 2,
          }}
        >
          Try Again
        </Button>
      </div>
    </div>
  );
}

function AllChartsUnavailable() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "12px",
        width: "100%",
        height: "76vh",
        overflowY: "scroll",
        background: "#F2F3F7",
        flex: "none",
        order: 1,
        alignSelf: "stretch",
        flexGrow: 1,
      }}
    >
      <div
        style={{
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "24px",
          gap: "24px",
          width: "100%",
          height: "100%",
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "12px",
          flex: "none",
          order: 0,
          alignSelf: "stretch",
          flexGrow: 1,
        }}
      >
        <Icon
          name="database_warning"
          style={{
            width: "72px",
            height: "72px",
            flex: "None",
            order: 0,
            flexGrow: 0,
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "0px",
            gap: "8px",
            width: "fit-content",
            height: "fit-content",
            flex: "none",
            order: 1,
            alignSelf: "stretch",
            flexGrow: 0,
          }}
        >
          <div
            style={{
              fontFamily: "Lato",
              fontStyle: "normal",
              fontWeight: 600,
              fontSize: "18px",
              lineHeight: "150%",
              display: "flex",
              alignItems: "center",
              textAlign: "center",
              color: "#072E45",
              flex: "none",
              order: 0,
              alignSelf: "stretch",
              flexGrow: 0,
              justifyContent: "center",
            }}
          >
            Summary Unavailable
          </div>
          <div
            style={{
              fontFamily: "Lato",
              fontStyle: "normal",
              fontWeight: 400,
              fontSize: "14px",
              lineHeight: "150%",
              display: "flex",
              alignItems: "center",
              textAlign: "center",
              color: "#516B7B",
              flex: "none",
              order: 1,
              alignSelf: "stretch",
              flexGrow: 0,
              justifyContent: "center",
            }}
          >
            All charts have no data or contain errors in their query
            configuration. Please review and correct each chart’s setup and data
            sources.
          </div>
        </div>
      </div>
    </div>
  );
}

function NoCharts() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "12px",
        width: "100%",
        height: "76vh",
        overflowY: "scroll",
        background: "#F2F3F7",
        flex: "none",
        order: 1,
        alignSelf: "stretch",
        flexGrow: 1,
      }}
    >
      <div
        style={{
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "24px",
          gap: "24px",
          width: "100%",
          height: "100%",
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "12px",
          flex: "none",
          order: 0,
          alignSelf: "stretch",
          flexGrow: 1,
        }}
      >
        <Icon
          name="delete_table"
          style={{
            width: "72px",
            height: "72px",
            flex: "None",
            order: 0,
            flexGrow: 0,
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "0px",
            gap: "8px",
            width: "fit-content",
            height: "fit-content",
            flex: "none",
            order: 1,
            alignSelf: "stretch",
            flexGrow: 0,
          }}
        >
          <div
            style={{
              fontFamily: "Lato",
              fontStyle: "normal",
              fontWeight: 600,
              fontSize: "18px",
              lineHeight: "150%",
              display: "flex",
              alignItems: "center",
              textAlign: "center",
              color: "#072E45",
              flex: "none",
              order: 0,
              alignSelf: "stretch",
              flexGrow: 0,
              justifyContent: "center",
            }}
          >
            Add Charts to Summarize
          </div>
          <div
            style={{
              fontFamily: "Lato",
              fontStyle: "normal",
              fontWeight: 400,
              fontSize: "14px",
              lineHeight: "150%",
              display: "flex",
              alignItems: "center",
              textAlign: "center",
              color: "#516B7B",
              flex: "none",
              order: 1,
              alignSelf: "stretch",
              flexGrow: 0,
              justifyContent: "center",
            }}
          >
            This tool summarizes charts in your dashboard. Please add charts
            before using this feature.
          </div>
        </div>
      </div>
    </div>
  );
}

function getStatus(
  loaded: boolean,
  failed: boolean,
  dashboardSummary: DashboardSummary,
): [boolean, string?] {
  if (!loaded) {
    return [false, LOADING];
  }
  if (failed) {
    return [false, FAILED];
  }
  if (!dashboardSummary) {
    return [false, RUNNING];
  }
  if (
    dashboardSummary.error === NO_QUERY_RESULTS_FOR_ALL_CHARTS ||
    dashboardSummary.error === NO_CHARTS
  ) {
    return [false, dashboardSummary.error];
  }
  return [true];
}

export function DashboardLighthouseAISidebar({
  dashboard,
  dashcardData,
  selectedTabId,
  parameterValues,
}: DashboardLighthouseAISidebarProps) {
  const dashboardSummary = useSelector(
    state => state.dashboard.dashboardSummaries[selectedTabId ?? -1],
  );
  const dispatch = useDispatch();

  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const postMessage = useCallback(() => {
    if (isDashboardLoaded(dashboard, dashcardData, selectedTabId)) {
      setLoaded(true);
      if (!failed && !dashboardSummary) {
        const messageData = {
          lighthouse: {
            type: "DashboardSummarizer",
            payload: {
              dashboard,
              dashcardData,
              selectedTabId,
              parameterValues,
            },
          },
        };
        window.parent.postMessage(messageData, "*");
      }
    } else {
      setLoaded(false);
    }
  }, [
    dashboard,
    dashcardData,
    selectedTabId,
    parameterValues,
    setLoaded,
    failed,
    dashboardSummary,
  ]);

  useEffect(() => {
    postMessage();
  }, [postMessage]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const messageHandler = useCallback(
    getMessageHandler(
      Number(dashboard.id),
      selectedTabId,
      parameterValues,
      dispatch,
      setFailed,
    ),
    [dashboard.id, selectedTabId, parameterValues, dispatch, setFailed],
  );

  useEffect(() => {
    window.addEventListener("message", messageHandler);

    return () => {
      window.removeEventListener("message", messageHandler);
    };
  }, [messageHandler]);

  const [isReady, statusMessage] = getStatus(loaded, failed, dashboardSummary);
  const summaryText = dashboardSummaryToString(
    dashboardSummary?.insights,
    dashboardSummary?.text,
  );

  return (
    <DashboardInfoSidebarRoot
      data-testid="sidebar-right"
      style={{
        padding: 0,
        background: "#F2F3F7",
      }}
    >
      <DashboardSummaryHeader />
      {isReady ? (
        <>
          <DashboardSummaryContents
            insights={dashboardSummary.insights}
            text={dashboardSummary.text}
            error={dashboardSummary.error}
          />
          {summaryText && summaryText?.trim() !== "" && (
            <CopyToClipboard text={summaryText} />
          )}
        </>
      ) : statusMessage === LOADING || statusMessage === RUNNING ? (
        <DashboardSummaryLoading />
      ) : statusMessage === NO_CHARTS ? (
        <NoCharts />
      ) : statusMessage === NO_QUERY_RESULTS_FOR_ALL_CHARTS ? (
        <AllChartsUnavailable />
      ) : (
        <DashboardSummaryError
          setFailed={setFailed}
          postMessage={postMessage}
        />
      )}
    </DashboardInfoSidebarRoot>
  );
}
