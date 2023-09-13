import React from "react";
import { t } from "ttag";
import {
  isFullyParametrized,
  isPreviewShown,
} from "metabase/collections/utils";
import Visualization from "metabase/visualizations/components/Visualization";
import { Bookmark, Collection, CollectionItem } from "metabase-types/api";
import ActionMenu from "metabase/collections/components/ActionMenu";
import Metadata from "metabase-lib/metadata/Metadata";
import PinnedQuestionLoader from "./PinnedQuestionLoader";
import {
  CardActionMenuContainer,
  CardPreviewSkeleton,
  CardRoot,
  CardStaticSkeleton,
} from "./PinnedQuestionCard.styled";

export interface PinnedQuestionCardProps {
  item: CollectionItem;
  collection: Collection;
  metadata: Metadata;
  bookmarks?: Bookmark[];
  onCopy: (items: CollectionItem[]) => void;
  onMove: (items: CollectionItem[]) => void;
  onCreateBookmark?: (id: string, model: string) => void;
  onDeleteBookmark?: (id: string, model: string) => void;
}

const PinnedQuestionCard = ({
  item,
  collection,
  metadata,
  bookmarks,
  onCopy,
  onMove,
  onCreateBookmark,
  onDeleteBookmark,
}: PinnedQuestionCardProps): JSX.Element => {
  const isPreview = isPreviewShown(item);

  const actionMenu = (
    <ActionMenu
      item={item}
      collection={collection}
      bookmarks={bookmarks}
      onCopy={onCopy}
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
        <PinnedQuestionLoader id={item.id} metadata={metadata}>
          {({ question, rawSeries, loading, error, errorIcon }) =>
            loading ? (
              <>
                {positionedActionMenu}
                <CardPreviewSkeleton
                  name={question?.displayName()}
                  display={question?.display()}
                  description={question?.description()}
                />
              </>
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
          icon={item.getIcon()}
          tooltip={getSkeletonTooltip(item)}
        />
      )}
    </CardRoot>
  );
};

const getSkeletonTooltip = (item: CollectionItem) => {
  if (!isFullyParametrized(item)) {
    return t`Open this question and fill in its variables to see it.`;
  } else {
    return undefined;
  }
};

export default PinnedQuestionCard;
