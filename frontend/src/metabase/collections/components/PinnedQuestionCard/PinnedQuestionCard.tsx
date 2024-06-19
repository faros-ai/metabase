import { t } from "ttag";

import ActionMenu from "metabase/collections/components/ActionMenu";
import {
  isFullyParameterized,
  isPreviewShown,
} from "metabase/collections/utils";
import type { IconName } from "metabase/core/components/Icon";
import Visualization from "metabase/visualizations/components/Visualization";
import type Database from "metabase-lib/metadata/Database";
import type { Bookmark, Collection, CollectionItem } from "metabase-types/api";

import {
  CardActionMenuContainer,
  CardPreviewSkeleton,
  CardRoot,
  CardStaticSkeleton,
} from "./PinnedQuestionCard.styled";
import PinnedQuestionLoader from "./PinnedQuestionLoader";

export interface PinnedQuestionCardProps {
  item: CollectionItem;
  collection: Collection;
  databases?: Database[];
  bookmarks?: Bookmark[];
  onCopy: (items: CollectionItem[]) => void;
  onCopyToAnotherWorkspace: (ids: number[]) => void;
  onMove: (items: CollectionItem[]) => void;
  onCreateBookmark?: (id: string, model: string) => void;
  onDeleteBookmark?: (id: string, model: string) => void;
}

const PinnedQuestionCard = ({
  item,
  collection,
  databases,
  bookmarks,
  onCopy,
  onCopyToAnotherWorkspace,
  onMove,
  onCreateBookmark,
  onDeleteBookmark,
}: PinnedQuestionCardProps): JSX.Element => {
  const isPreview = isPreviewShown(item);

  const actionMenu = (
    <ActionMenu
      item={item}
      collection={collection}
      databases={databases}
      bookmarks={bookmarks}
      onCopy={onCopy}
      onCopyToAnotherWorkspace={onCopyToAnotherWorkspace}
      onMove={onMove}
      createBookmark={onCreateBookmark}
      deleteBookmark={onDeleteBookmark}
    />
  );

  const positionedActionMenu = (
    <CardActionMenuContainer>{actionMenu}</CardActionMenuContainer>
  );

  return (
    <CardRoot
      to={item.getUrl()}
      isPreview={isPreview}
      className="hover-parent hover--visibility"
    >
      {!isPreview && positionedActionMenu}
      {isPreview ? (
        <PinnedQuestionLoader id={item.id}>
          {({ question, rawSeries, loading, error, errorIcon }) =>
            loading ? (
              <CardPreviewSkeleton
                name={question?.displayName()}
                display={question?.display()}
                description={question?.description()}
                actionMenu={actionMenu}
              />
            ) : (
              <Visualization
                actionButtons={actionMenu}
                rawSeries={rawSeries}
                error={error}
                errorIcon={errorIcon}
                showTitle
                isDashboard
              />
            )
          }
        </PinnedQuestionLoader>
      ) : (
        <CardStaticSkeleton
          name={item.name}
          description={item.description ?? t`A question`}
          icon={item.getIcon() as unknown as { name: IconName }}
          tooltip={getSkeletonTooltip(item)}
        />
      )}
    </CardRoot>
  );
};

const getSkeletonTooltip = (item: CollectionItem) => {
  if (!isFullyParameterized(item)) {
    return t`Open this question and fill in its variables to see it.`;
  } else {
    return undefined;
  }
};

// eslint-disable-next-line import/no-default-export -- deprecated usage
export default PinnedQuestionCard;
