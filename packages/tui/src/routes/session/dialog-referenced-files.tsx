import { createSignal, Show } from "solid-js"
import { DialogSelect } from "../../ui/dialog-select"
import {
  explainReferencedFileRole,
  groupReferencedFiles,
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

export function DialogReferencedFiles(props: { files: string[] }) {
  const groups = groupReferencedFiles(props.files)
  const [selectedGroup, setSelectedGroup] = createSignal<ReferencedFileGroup>()
  const [selectedFile, setSelectedFile] = createSignal<string>()

  return (
    <Show
      when={selectedGroup()}
      fallback={
        <DialogSelect
          title="Referenced Files"
          placeholder="Search groups"
          options={groups.map((group) => {
            const item = presentation[group.role]
            return {
              title: item.label,
              value: group.role,
              description: `${group.files.length} ${group.files.length === 1 ? "file" : "files"}`,
              details: [item.explanation],
              onSelect: () => setSelectedGroup(group),
            }
          })}
        />
      }
    >
      {(group) => (
        <Show
          when={selectedFile()}
          fallback={
            <DialogSelect
              title={`${presentation[group().role].label} Files`}
              placeholder="Search files"
              footer={<text>{presentation[group().role].explanation}</text>}
              options={[
                {
                  title: "Back to groups",
                  value: "back",
                  description: "return to all referenced file roles",
                  onSelect: () => setSelectedGroup(undefined),
                },
                ...group().files.map((file) => ({
                  title: file,
                  value: file,
                  truncateTitle: "left" as const,
                  description: "view classification",
                  onSelect: () => setSelectedFile(file),
                })),
              ]}
            />
          }
        >
          {(file) => {
            const classification = explainReferencedFileRole(file())
            return (
              <DialogSelect
                title="Referenced File"
                renderFilter={false}
                options={[
                  {
                    title: "Back to files",
                    value: "back",
                    description: `return to ${presentation[group().role].label.toLowerCase()}`,
                    onSelect: () => setSelectedFile(undefined),
                  },
                  {
                    title: presentation[classification.role].label,
                    value: file(),
                    description: "detected role",
                    details: [`Path: ${file()}`, `Why: ${classification.reason}`],
                  },
                ]}
              />
            )
          }}
        </Show>
      )}
    </Show>
  )
}
