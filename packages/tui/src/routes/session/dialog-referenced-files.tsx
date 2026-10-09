import type { DialogContext } from "../../ui/dialog"
import { DialogSelect } from "../../ui/dialog-select"
import type { FunctionalGroup, LearningArea } from "../../util/repository-functionality"

const pageSize = 18
const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`
const basename = (file: string) => file.split("/").at(-1) ?? file

export function DialogRepositoryMapLoading() {
  return (
    <DialogSelect
      title="Repository Learning Map"
      renderFilter={false}
      locked
      emptyView={<text>Analyzing repository...</text>}
      options={[]}
    />
  )
}

export function DialogRepositoryMap(props: { groups: FunctionalGroup[]; onExplain: (area: LearningArea) => void }) {
  return (
    <DialogSelect
      title="Repository Learning Map"
      placeholder="Search functionality"
      footer={<text>Enter opens a functionality group</text>}
      options={props.groups.map((group) => ({
        title: group.title,
        value: group.id,
        description: plural(group.files.length, "file"),
        details: [
          group.files.slice(0, 3).map(basename).join(" · "),
          plural(group.referencedFiles.length, "session reference"),
        ],
        onSelect: (dialog: DialogContext) => dialog.replace(() => <DialogGroup {...props} group={group} />),
      }))}
    />
  )
}

function DialogGroup(props: {
  groups: FunctionalGroup[]
  group: FunctionalGroup
  onExplain: (area: LearningArea) => void
}) {
  return (
    <DialogSelect
      title={props.group.title}
      placeholder="Search subgroups"
      footer={<text>{plural(props.group.subgroups.length, "subgroup")}</text>}
      options={[
        {
          title: "Back to map",
          value: "back",
          onSelect: (dialog: DialogContext) =>
            dialog.replace(() => <DialogRepositoryMap groups={props.groups} onExplain={props.onExplain} />),
        },
        {
          title: "EXPLAIN THIS FUNCTIONALITY",
          value: "explain",
          description: "relationships, reading order, and learning question",
          onSelect: () => props.onExplain(props.group),
        },
        ...props.group.subgroups.map((subgroup) => ({
          title: subgroup.title,
          value: subgroup.id,
          description: plural(subgroup.files.length, "file"),
          onSelect: (dialog: DialogContext) =>
            dialog.replace(() => <DialogSubgroup {...props} subgroup={subgroup} page={0} />),
        })),
      ]}
    />
  )
}

function DialogSubgroup(props: {
  groups: FunctionalGroup[]
  group: FunctionalGroup
  subgroup: LearningArea
  page: number
  onExplain: (area: LearningArea) => void
}) {
  const pages = Math.max(1, Math.ceil(props.subgroup.files.length / pageSize))
  const files = props.subgroup.files.slice(props.page * pageSize, (props.page + 1) * pageSize)
  const replace = (dialog: DialogContext, page: number) =>
    dialog.replace(() => <DialogSubgroup {...props} page={page} />)
  return (
    <DialogSelect
      title={`${props.subgroup.title} · ${props.page + 1}/${pages}`}
      placeholder="Search this page"
      footer={<text>{`${plural(props.subgroup.files.length, "file")} · ${props.subgroup.root}`}</text>}
      options={[
        {
          title: "Back to subgroups",
          value: "back",
          onSelect: (dialog: DialogContext) =>
            dialog.replace(() => <DialogGroup groups={props.groups} group={props.group} onExplain={props.onExplain} />),
        },
        {
          title: "EXPLAIN THIS SUBGROUP",
          value: "explain",
          description: "generate a focused learning guide",
          onSelect: () => props.onExplain(props.subgroup),
        },
        ...(props.page > 0
          ? [
              {
                title: "Previous page",
                value: "previous",
                onSelect: (dialog: DialogContext) => replace(dialog, props.page - 1),
              },
            ]
          : []),
        ...(props.page + 1 < pages
          ? [
              {
                title: "Next page",
                value: "next",
                onSelect: (dialog: DialogContext) => replace(dialog, props.page + 1),
              },
            ]
          : []),
        ...files.map((file) => ({
          title: file,
          value: file,
          truncateTitle: "left" as const,
          description: props.subgroup.referencedFiles.includes(file) ? "referenced in this session" : undefined,
          onSelect: () => {},
        })),
      ]}
    />
  )
}
