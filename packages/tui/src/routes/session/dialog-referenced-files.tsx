import type { DialogContext } from "../../ui/dialog"
import { DialogSelect } from "../../ui/dialog-select"
import {
  explainReferencedFileRole,
  type ReferencedFileGroup,
  type ReferencedFileRole,
} from "../../util/referenced-file-role"

const presentation: Record<ReferencedFileRole, { label: string; explanation: string }> = {
  source: {
    label: "Source",
    explanation: "Implementation files that define the project's behavior.",
  },
  test: {
    label: "Tests",
    explanation: "Files that verify behavior and guard against regressions.",
  },
  configuration: {
    label: "Configuration",
    explanation: "Files that control tools, dependencies, builds, and runtime settings.",
  },
  documentation: {
    label: "Documentation",
    explanation: "Files that explain the project, its architecture, or how to use it.",
  },
  other: {
    label: "Other",
    explanation: "Referenced files that do not match a recognized project role.",
  },
}

export function DialogReferencedFiles(props: {
  groups: ReferencedFileGroup[]
  onExplain: (group: ReferencedFileGroup) => void
}) {
  const options = props.groups.map((group) => {
    const item = presentation[group.role]
    return {
      title: item.label,
      value: group.role,
      description: `${group.files.length} ${group.files.length === 1 ? "file" : "files"}`,
      details: [item.explanation],
      onSelect: (dialog: DialogContext) =>
        dialog.replace(() => (
          <DialogReferencedFileList groups={props.groups} group={group} onExplain={props.onExplain} />
        )),
    }
  })

  return <DialogSelect title="Referenced Files" placeholder="Search groups" options={options} />
}

function DialogReferencedFileList(props: {
  groups: ReferencedFileGroup[]
  group: ReferencedFileGroup
  onExplain: (group: ReferencedFileGroup) => void
}) {
  const item = presentation[props.group.role]
  const options = [
    {
      title: "Back to groups",
      value: "back",
      description: "return to all referenced file roles",
      onSelect: (dialog: DialogContext) =>
        dialog.replace(() => <DialogReferencedFiles groups={props.groups} onExplain={props.onExplain} />),
    },
    {
      title: "Explain this group",
      value: "explain",
      description: "generate a project-specific learning guide",
      onSelect: () => props.onExplain(props.group),
    },
    ...props.group.files.map((file) => ({
      title: file,
      value: file,
      truncateTitle: "left" as const,
      description: "view classification",
      onSelect: (dialog: DialogContext) =>
        dialog.replace(() => (
          <DialogReferencedFileDetail
            groups={props.groups}
            group={props.group}
            file={file}
            onExplain={props.onExplain}
          />
        )),
    })),
  ]

  return (
    <DialogSelect
      title={`${item.label} Files`}
      placeholder="Search files"
      footer={<text>{item.explanation}</text>}
      options={options}
    />
  )
}

function DialogReferencedFileDetail(props: {
  groups: ReferencedFileGroup[]
  group: ReferencedFileGroup
  file: string
  onExplain: (group: ReferencedFileGroup) => void
}) {
  const classification = explainReferencedFileRole(props.file)
  const options = [
    {
      title: "Back to files",
      value: "back",
      description: `return to ${presentation[props.group.role].label.toLowerCase()}`,
      onSelect: (dialog: DialogContext) =>
        dialog.replace(() => (
          <DialogReferencedFileList groups={props.groups} group={props.group} onExplain={props.onExplain} />
        )),
    },
    {
      title: presentation[classification.role].label,
      value: props.file,
      description: "detected role",
      details: [`Path: ${props.file}`, `Why: ${classification.reason}`],
    },
  ]

  return <DialogSelect title="Referenced File" renderFilter={false} options={options} />
}
