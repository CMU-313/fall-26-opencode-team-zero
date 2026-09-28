import { DialogSelect } from "../../ui/dialog-select"
import type { FunctionalGroup } from "../../util/repository-functionality"

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`
}

function basename(file: string) {
  return file.split("/").at(-1) ?? file
}

export function DialogRepositoryMapLoading() {
  return (
    <DialogSelect
      title="Repository Learning Map"
      renderFilter={false}
      locked
      emptyView={<text>Analyzing repository structure...</text>}
      options={[]}
    />
  )
}

export function DialogRepositoryMap(props: { groups: FunctionalGroup[]; onExplain: (group: FunctionalGroup) => void }) {
  const options = props.groups.map((group) => ({
    title: group.title,
    value: group.id,
    description: plural(group.files.length, "file"),
    details: [
      group.files.slice(0, 3).map(basename).join(" · "),
      plural(group.referencedFiles.length, "session reference"),
    ],
    onSelect: () => props.onExplain(group),
  }))

  return (
    <DialogSelect
      title="Repository Learning Map"
      placeholder="Search functionality"
      footer={<text>Enter generates an evidence-based explanation</text>}
      options={options}
    />
  )
}
