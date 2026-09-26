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
  const visible = files.slice(0, 1)
  const remaining = group.files.length - visible.length
  return [
    ...visible.map((file) => `│ ${basename(file)}${group.referencedFiles.includes(file) ? "  referenced" : ""}`),
    ...(remaining > 0 ? [`│ + ${remaining} more`] : []),
    `└─ ${plural(group.referencedFiles.length, "session reference")}`,
  ]
}

type FileSection = { id: string; title: string; files: string[] }

function fileSections(group: FunctionalGroup) {
  const sections = new Map<string, string[]>()
  for (const file of group.files) {
    const segments = file.split("/")
    const packageName = segments[0] === "packages" ? segments[1] : "project"
    const area = segments.findIndex((segment) => segment === "src" || segment === "test" || segment === "tests")
    const directory = area === -1 ? segments.slice(0, -1).at(-1) : segments[area + 1]
    const title = `${packageName} / ${directory || "root"}`
    const files = sections.get(title) ?? []
    files.push(file)
    sections.set(title, files)
  }

  return [...sections.entries()].flatMap(([title, files]) => {
    if (files.length <= 100) return [{ id: title, title, files }]
    const pages: FileSection[] = []
    for (let start = 0; start < files.length; start += 100) {
      const page = files.slice(start, start + 100)
      pages.push({
        id: `${title}:${start}`,
        title: `${title} (${start + 1}-${start + page.length})`,
        files: page,
      })
    }
    return pages
  })
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

export function DialogRepositoryMap(props: { groups: FunctionalGroup[]; onExplain: (group: FunctionalGroup) => void }) {
  const options = props.groups.map((group) => ({
    title: `┌─ ${group.title}`,
    value: group.id,
    description: plural(group.files.length, "file"),
    details: preview(group),
    onSelect: (dialog: DialogContext) =>
      dialog.replace(() => (
        <DialogFunctionalityFiles groups={props.groups} group={group} onExplain={props.onExplain} />
      )),
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

function DialogFunctionalityFiles(props: {
  groups: FunctionalGroup[]
  group: FunctionalGroup
  onExplain: (group: FunctionalGroup) => void
}) {
  const sections = fileSections(props.group)
  const options = [
    {
      title: "Back to map",
      value: "back",
      description: "return to all functionality groups",
      onSelect: (dialog: DialogContext) =>
        dialog.replace(() => <DialogRepositoryMap groups={props.groups} onExplain={props.onExplain} />),
    },
    {
      title: "Explain this functionality",
      value: "explain",
      description: "generate an evidence-based learning guide",
      onSelect: () => props.onExplain(props.group),
    },
    ...sections.map((section) => ({
      title: section.title,
      value: section.id,
      description: plural(section.files.length, "file"),
      onSelect: (dialog: DialogContext) =>
        dialog.replace(() => (
          <DialogFunctionalitySection
            groups={props.groups}
            group={props.group}
            section={section}
            onExplain={props.onExplain}
          />
        )),
    })),
  ]

  return (
    <DialogSelect
      title={props.group.title}
      placeholder="Search sections"
      footer={<text>{plural(props.group.files.length, "file")} organized into bounded sections</text>}
      options={options}
    />
  )
}

function DialogFunctionalitySection(props: {
  groups: FunctionalGroup[]
  group: FunctionalGroup
  section: FileSection
  onExplain: (group: FunctionalGroup) => void
}) {
  const options = [
    {
      title: "Back to sections",
      value: "back",
      description: `return to ${props.group.title}`,
      onSelect: (dialog: DialogContext) =>
        dialog.replace(() => (
          <DialogFunctionalityFiles groups={props.groups} group={props.group} onExplain={props.onExplain} />
        )),
    },
    ...props.section.files.map((file) => ({
      title: file,
      value: file,
      truncateTitle: "left" as const,
      description: props.group.referencedFiles.includes(file)
        ? "referenced in this session"
        : props.group.entryFiles.includes(file)
          ? "suggested entry point"
          : undefined,
      onSelect: (dialog: DialogContext) =>
        dialog.replace(() => (
          <DialogRepositoryFile
            groups={props.groups}
            group={props.group}
            section={props.section}
            file={file}
            onExplain={props.onExplain}
          />
        )),
    })),
  ]

  return (
    <DialogSelect
      title={props.section.title}
      placeholder="Search files"
      footer={<text>{plural(props.section.files.length, "file")} in this section</text>}
      options={options}
    />
  )
}

function DialogRepositoryFile(props: {
  groups: FunctionalGroup[]
  group: FunctionalGroup
  section: FileSection
  file: string
  onExplain: (group: FunctionalGroup) => void
}) {
  const labels = [
    ...(props.group.entryFiles.includes(props.file) ? ["Suggested entry point"] : []),
    ...(props.group.referencedFiles.includes(props.file) ? ["Referenced in this session"] : []),
  ]
  const options = [
    {
      title: "Back to section",
      value: "back",
      description: `return to ${props.group.title}`,
      onSelect: (dialog: DialogContext) =>
        dialog.replace(() => (
          <DialogFunctionalitySection
            groups={props.groups}
            group={props.group}
            section={props.section}
            onExplain={props.onExplain}
          />
        )),
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
