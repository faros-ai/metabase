import { t } from "ttag";

import EmptyState from "metabase/components/EmptyState";
import Button from "metabase/core/components/Button";
import Link from "metabase/core/components/Link";
import { useSelector } from "metabase/lib/redux";
import * as Urls from "metabase/lib/urls";
import type { Dashboard } from "metabase-types/api";

import { Container } from "./DashboardEmptyState.styled";

function QuestionIllustration() {
  return <span className="QuestionCircle">?</span>;
}

interface DashboardEmptyStateProps {
  dashboard: Dashboard;
  isNightMode: boolean;
  addQuestion: () => void;
  closeNavbar: () => void;
}

export function DashboardEmptyState({
  dashboard,
  isNightMode,
  addQuestion,
  closeNavbar,
}: DashboardEmptyStateProps) {
  const isDashboardCreationEnabled = useSelector(
    state => state.embed.options.enable_dashboard_creation,
  );
  return (
    <Container isNightMode={isNightMode} data-testid="dashboard-empty-state">
      <EmptyState
        illustrationElement={<QuestionIllustration />}
        title={t`This dashboard is looking empty.`}
        message={
          isDashboardCreationEnabled && (
            <>
              <Button onlyText onClick={addQuestion}>
                {t`Add a saved question`}
              </Button>
              {t`, or `}
              <Link
                variant="brandBold"
                to={Urls.newQuestion({
                  mode: "notebook",
                  creationType: "custom_question",
                  collectionId: dashboard.collection_id ?? undefined,
                })}
                className="text-bold text-brand"
                onClick={closeNavbar}
              >
                {t`ask a new one`}
              </Link>
            </>
          )
        }
      />
    </Container>
  );
}

interface DashboardEmptyStateWithoutAddPromptProps {
  isNightMode: boolean;
}

export function DashboardEmptyStateWithoutAddPrompt({
  isNightMode,
}: DashboardEmptyStateWithoutAddPromptProps) {
  return (
    <Container isNightMode={isNightMode}>
      <EmptyState title={t`There's nothing here, yet.`} />
    </Container>
  );
}
