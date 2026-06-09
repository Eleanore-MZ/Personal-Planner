import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import type { Category, StatsGroup } from "../../types/domain";
import { getCategoryColorValues } from "../../utils/calendar";

type StatsGroupsConfigPanelProps = {
  categories: Category[];
  statsGroups: StatsGroup[];
  onUpdateStatsGroups: (groups: StatsGroup[]) => void | Promise<void>;
};

const createStatsGroupId = () =>
  `stats-group-${Date.now()}-${Math.random().toString(16).slice(2)}`;

type DropPlacement = "before" | "after";

const normalizeStatsGroups = (groups: StatsGroup[]) =>
  groups.map((group, index) => ({
    ...group,
    name: group.name.trim() || "Untitled group",
    sortOrder: index,
    categoryIds: [...new Set(group.categoryIds)],
  }));

const getGroupDraftNames = (groups: StatsGroup[]) =>
  Object.fromEntries(groups.map((group) => [group.id, group.name]));

function getAssignedGroupId(categoryId: string, groups: StatsGroup[]) {
  return groups.find((group) => group.categoryIds.includes(categoryId))?.id ?? "";
}

function StatsGroupsConfigPanel({
  categories,
  statsGroups,
  onUpdateStatsGroups,
}: StatsGroupsConfigPanelProps) {
  const [groupNameDrafts, setGroupNameDrafts] = useState<Record<string, string>>(
    () => getGroupDraftNames(statsGroups),
  );
  const [draggingGroupId, setDraggingGroupId] = useState<string>();
  const [dragTarget, setDragTarget] = useState<{
    groupId: string;
    placement: DropPlacement;
  }>();
  const assignedStatsCategoryIds = useMemo(
    () => new Set(statsGroups.flatMap((group) => group.categoryIds)),
    [statsGroups],
  );

  useEffect(() => {
    setGroupNameDrafts((currentDrafts) =>
      Object.fromEntries(
        statsGroups.map((group) => [
          group.id,
          currentDrafts[group.id] ?? group.name,
        ]),
      ),
    );
  }, [statsGroups]);

  const persistStatsGroups = (groups: StatsGroup[]) => {
    void onUpdateStatsGroups(normalizeStatsGroups(groups));
  };

  const applyGroupNameDrafts = (groups: StatsGroup[]) =>
    groups.map((group) => ({
      ...group,
      name: groupNameDrafts[group.id] ?? group.name,
    }));

  const getDropPlacement = (event: DragEvent<HTMLElement>): DropPlacement => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
  };

  const resetDragState = () => {
    setDraggingGroupId(undefined);
    setDragTarget(undefined);
  };

  const updateStatsGroup = (groupId: string, input: Partial<StatsGroup>) => {
    persistStatsGroups(
      statsGroups.map((group) =>
        group.id === groupId ? { ...group, ...input } : group,
      ),
    );
  };

  const reorderStatsGroup = (
    groupId: string,
    targetGroupId: string,
    placement: DropPlacement,
  ) => {
    if (groupId === targetGroupId) {
      return;
    }

    const currentIndex = statsGroups.findIndex((group) => group.id === groupId);
    const targetIndex = statsGroups.findIndex(
      (group) => group.id === targetGroupId,
    );
    if (currentIndex === -1 || targetIndex === -1) {
      return;
    }

    const nextGroups = [...statsGroups];
    const [movedGroup] = nextGroups.splice(currentIndex, 1);
    const adjustedTargetIndex =
      currentIndex < targetIndex ? targetIndex - 1 : targetIndex;
    const insertIndex =
      placement === "after" ? adjustedTargetIndex + 1 : adjustedTargetIndex;
    nextGroups.splice(insertIndex, 0, movedGroup);
    persistStatsGroups(applyGroupNameDrafts(nextGroups));
  };

  const addStatsGroup = () => {
    persistStatsGroups([
      ...statsGroups,
      {
        id: createStatsGroupId(),
        name: "New group",
        color: "#22d3ee",
        sortOrder: statsGroups.length,
        countsTowardProductiveTime: true,
        categoryIds: [],
      },
    ]);
  };

  const deleteStatsGroup = (groupId: string) => {
    persistStatsGroups(statsGroups.filter((group) => group.id !== groupId));
  };

  const assignCategoryToStatsGroup = (categoryId: string, groupId: string) => {
    persistStatsGroups(
      statsGroups.map((group) => ({
        ...group,
        categoryIds:
          group.id === groupId
            ? [...new Set([...group.categoryIds, categoryId])]
            : group.categoryIds.filter((currentId) => currentId !== categoryId),
      })),
    );
  };

  const commitGroupName = (group: StatsGroup) => {
    const nextName = (groupNameDrafts[group.id] ?? group.name).trim();
    const normalizedName = nextName || "Untitled group";
    if (normalizedName !== group.name) {
      updateStatsGroup(group.id, { name: normalizedName });
    } else if (nextName !== groupNameDrafts[group.id]) {
      setGroupNameDrafts((currentDrafts) => ({
        ...currentDrafts,
        [group.id]: normalizedName,
      }));
    }
  };

  const handleGroupNameKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    group: StatsGroup,
  ) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
      return;
    }

    if (event.key === "Escape") {
      setGroupNameDrafts((currentDrafts) => ({
        ...currentDrafts,
        [group.id]: group.name,
      }));
      event.currentTarget.blur();
    }
  };

  return (
    <section className="config-stats-panel">
      <div className="config-section-header">
        <div>
          <div className="panel-kicker">Analytics groups</div>
          <h2>Stats Groups</h2>
          <p>Define persistent reporting groups and map categories to them.</p>
        </div>
      </div>

      <div className="config-stats-grid">
        <div className="config-card config-card-wide">
          <div className="stats-group-editor-header">
            <div>
              <div className="mini-label">Groups</div>
              <div className="detail-meta">
                Productive groups count toward productive time. Tracked-only
                groups still appear in distribution charts.
              </div>
            </div>
            <button className="toolbar-button" onClick={addStatsGroup} type="button">
              Add Group
            </button>
          </div>

          <div className="stats-group-editor-list">
            {statsGroups.map((group) => {
              const isDragging = draggingGroupId === group.id;
              const dropClass =
                dragTarget?.groupId === group.id
                  ? ` drag-over-${dragTarget.placement}`
                  : "";

              return (
                <div
                  className={`stats-group-editor-row${isDragging ? " dragging" : ""}${dropClass}`}
                  key={group.id}
                  onDragLeave={(event) => {
                    if (
                      !event.currentTarget.contains(
                        event.relatedTarget as Node | null,
                      )
                    ) {
                      setDragTarget(undefined);
                    }
                  }}
                  onDragOver={(event) => {
                    if (!draggingGroupId || draggingGroupId === group.id) {
                      return;
                    }

                    event.preventDefault();
                    setDragTarget({
                      groupId: group.id,
                      placement: getDropPlacement(event),
                    });
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const draggedGroupId =
                      draggingGroupId ||
                      event.dataTransfer.getData("text/plain");
                    if (draggedGroupId && draggedGroupId !== group.id) {
                      reorderStatsGroup(
                        draggedGroupId,
                        group.id,
                        getDropPlacement(event),
                      );
                    }
                    resetDragState();
                  }}
                >
                  <button
                    aria-label={`Drag ${group.name} to reorder`}
                    className="stats-group-drag-handle"
                    draggable
                    onDragEnd={resetDragState}
                    onDragStart={(event) => {
                      setDraggingGroupId(group.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", group.id);
                    }}
                    type="button"
                  >
                    ::
                  </button>
                  <input
                    aria-label={`${group.name} name`}
                    onBlur={() => commitGroupName(group)}
                    onChange={(event) =>
                      setGroupNameDrafts((currentDrafts) => ({
                        ...currentDrafts,
                        [group.id]: event.target.value,
                      }))
                    }
                    onKeyDown={(event) => handleGroupNameKeyDown(event, group)}
                    value={groupNameDrafts[group.id] ?? group.name}
                  />
                  <input
                    aria-label={`${group.name} color`}
                    onChange={(event) =>
                      updateStatsGroup(group.id, { color: event.target.value })
                    }
                    type="color"
                    value={
                      /^#[0-9a-f]{6}$/i.test(group.color)
                        ? group.color
                        : "#22d3ee"
                    }
                  />
                  <button
                    className={`stats-group-productivity-pill${
                      group.countsTowardProductiveTime ? " productive" : ""
                    }`}
                    onClick={() =>
                      updateStatsGroup(group.id, {
                        countsTowardProductiveTime:
                          !group.countsTowardProductiveTime,
                      })
                    }
                    type="button"
                  >
                    {group.countsTowardProductiveTime
                      ? "Productive"
                      : "Tracked only"}
                  </button>
                  <button
                    className="toolbar-button danger-action"
                    onClick={() => deleteStatsGroup(group.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="config-card config-card-wide">
          <div>
            <div className="mini-label">Category assignments</div>
            <div className="detail-meta">
              {assignedStatsCategoryIds.size}/{categories.length} assigned.
              Unassigned categories appear in Other.
            </div>
          </div>
          <div className="config-assignment-list">
            {categories.map((category) => {
              const categoryColors = getCategoryColorValues(category.color);
              const assignedGroupId = getAssignedGroupId(category.id, statsGroups);
              return (
                <div className="config-assignment-row" key={category.id}>
                  <div className="config-assignment-category">
                    <span
                      className="config-assignment-swatch"
                      style={{ background: categoryColors.accent }}
                    />
                    <span>{category.name}</span>
                  </div>
                  <div className="config-assignment-options">
                    <button
                      className={`config-assignment-chip${
                        assignedGroupId === "" ? " active" : ""
                      }`}
                      onClick={() => assignCategoryToStatsGroup(category.id, "")}
                      type="button"
                    >
                      Other
                    </button>
                    {statsGroups.map((group) => (
                      <button
                        className={`config-assignment-chip${
                          assignedGroupId === group.id ? " active" : ""
                        }`}
                        key={group.id}
                        onClick={() =>
                          assignCategoryToStatsGroup(category.id, group.id)
                        }
                        style={{ "--stats-group-color": group.color } as CSSProperties}
                        type="button"
                      >
                        {group.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default StatsGroupsConfigPanel;
