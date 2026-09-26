import type { DialogContext } from "../../ui/dialog"
import { DialogSelect } from "../../ui/dialog-select"
import type { FunctionalGroup } from "../../util/repository-functionality"

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`
}

function basename(file: string) {
  return file.split("/").at(-1) ?? file
}

function preview(group: FunctionalGroup) {
  const files = group.entryFiles.length
    ? group.entryFiles
    : group.referencedFiles.length
      ? group.referencedFiles
      : group.files
  const visible = files.slice(0, 3)
  const remaining = group.files.length - visible.length
  return [
    ...visible.map((file) => `│ ${basename(file)}${group.referencedFiles.includes(file) ? "  referenced" : ""}`),
    ...(remaining > 0 ? [`│ + ${remaining} more`] : []),
    `└─ ${plural(group.referencedFiles.length, "session reference")}`,
  ]
}

export function DialogRepositoryMapLoading() {
  return (
    <DialogSelect
      title="Repository Learning Map"
      renderFilter={false}
      locked
      emptyView={<text>Analyzing repository functionality...</text>}
      options={[]}
    />
  )
}

export function DialogRepositoryMap(props: { groups: FunctionalGroup[] }) {
  const options = props.groups.map((group) => ({
    title: `┌─ ${group.title}`,
    value: group.id,
    description: plural(group.files.length, "file"),
    details: preview(group),
    onSelect: (dialog: DialogContext) =>
      dialog.replace(() => <DialogFunctionalityFiles groups={props.groups} group={group} />),
  }))

  return (
    <DialogSelect
      title="Repository Learning Map"
      placeholder="Search functionality"
      footer={<text>Enter opens a functionality group · referenced marks session evidence</text>}
      options={options}
    />
  )
}

function DialogFunctionalityFiles(props: { groups: FunctionalGroup[]; group: FunctionalGroup }) {
  const options = [
    {
      title: "Back to map",
      value: "back",
      description: "return to all functionality groups",
      onSelect: (dialog: DialogContext) => dialog.replace(() => <DialogRepositoryMap groups={props.groups} />),
    },
    ...props.group.files.map((file) => ({
      title: file,
      value: file,
      truncateTitle: "left" as const,
      description: props.group.referencedFiles.includes(file)
        ? "referenced in this session"
        : props.group.entryFiles.includes(file)
          ? "suggested entry point"
          : undefined,
      onSelect: (dialog: DialogContext) =>
        dialog.replace(() => <DialogRepositoryFile groups={props.groups} group={props.group} file={file} />),
    })),
  ]

  return (
    <DialogSelect
      title={props.group.title}
      placeholder="Search files"
      footer={<text>{plural(props.group.files.length, "file")} in this functionality group</text>}
      options={options}
    />
  )
}

function DialogRepositoryFile(props: { groups: FunctionalGroup[]; group: FunctionalGroup; file: string }) {
  const labels = [
    ...(props.group.entryFiles.includes(props.file) ? ["Suggested entry point"] : []),
    ...(props.group.referencedFiles.includes(props.file) ? ["Referenced in this session"] : []),
  ]
  const options = [
    {
      title: "Back to files",
      value: "back",
      description: `return to ${props.group.title}`,
      onSelect: (dialog: DialogContext) =>
        dialog.replace(() => <DialogFunctionalityFiles groups={props.groups} group={props.group} />),
    },
    {
      title: basename(props.file),
      value: props.file,
      description: "repository file",
      details: [`Path: ${props.file}`, `Functionality: ${props.group.title}`, ...labels],
    },
  ]

  return <DialogSelect title="File Context" renderFilter={false} options={options} />
}
