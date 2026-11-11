import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { centsToInput, parseMoneyToCents } from "@/lib/pedix";
import { cn } from "@/lib/utils";

const emptyOption = () => ({ name: "", price: "0,00" });

export default function OptionGroupsEditor({ groups, onChange }) {
  const [error, setError] = useState("");

  function updateGroup(index, patch) {
    onChange(groups.map((group, position) => (position === index ? { ...group, ...patch } : group)));
  }

  function updateOption(groupIndex, optionIndex, patch) {
    onChange(
      groups.map((group, position) =>
        position === groupIndex
          ? {
              ...group,
              options: group.options.map((option, optionPosition) =>
                optionPosition === optionIndex ? { ...option, ...patch } : option
              ),
            }
          : group
      )
    );
  }

  function addGroup(selection) {
    onChange([
      ...groups,
      {
        name: selection === "SINGLE" ? "Escolha uma opção" : "Adicionais",
        selection,
        required: false,
        min_select: 0,
        max_select: selection === "SINGLE" ? 1 : 3,
        options: [emptyOption()],
      },
    ]);
    setError("");
  }

  function validate() {
    for (const group of groups) {
      if (!group.name.trim()) return "Toda opção precisa de um nome de grupo.";
      if (group.options.length === 0) return "Cada grupo precisa de pelo menos uma opção.";
      if (group.options.some((option) => !option.name.trim())) return "Toda opção precisa de um nome.";
      if (group.selection === "SINGLE" && group.required && (Number(group.min_select) !== 1 || Number(group.max_select) !== 1)) {
        return "Grupo único obrigatório tem mínimo 1 e máximo 1.";
      }
      if (group.selection === "MULTIPLE" && Number(group.max_select) < Number(group.min_select)) {
        return "No grupo múltiplo, o máximo deve ser maior ou igual ao mínimo.";
      }
    }
    return "";
  }

  return (
    <div className="space-y-3">
      {groups.map((group, groupIndex) => (
        <div key={groupIndex} className="rounded-card border border-border bg-secondary/30 p-3">
          <div className="flex items-start gap-2">
            <input
              value={group.name}
              onChange={(event) => updateGroup(groupIndex, { name: event.target.value })}
              placeholder="Nome do grupo"
              className="min-h-[40px] w-full rounded-btn border border-input bg-card px-3 text-[13px] font-medium outline-none focus:border-brand"
            />
            <button
              type="button"
              onClick={() => onChange(groups.filter((_, position) => position !== groupIndex))}
              aria-label="Remover grupo"
              className="grid h-10 w-9 shrink-0 place-items-center rounded-btn text-muted-foreground hover:text-brand"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={group.selection}
              onChange={(event) => {
                const selection = event.target.value;
                updateGroup(groupIndex, {
                  selection,
                  max_select: selection === "SINGLE" ? 1 : Math.max(1, group.max_select ?? 3),
                  min_select: selection === "SINGLE" ? (group.required ? 1 : 0) : group.min_select,
                });
              }}
              className="min-h-[38px] rounded-btn border border-input bg-card px-2 text-[12px]"
            >
              <option value="SINGLE">Escolha única</option>
              <option value="MULTIPLE">Múltipla escolha</option>
            </select>

            <label className="flex items-center gap-1.5 text-[12px] text-foreground">
              <input
                type="checkbox"
                checked={group.required}
                onChange={(event) => {
                  const required = event.target.checked;
                  updateGroup(groupIndex, {
                    required,
                    min_select: group.selection === "SINGLE" ? (required ? 1 : 0) : Math.max(required ? 1 : 0, group.min_select ?? 0),
                    max_select: group.selection === "SINGLE" ? 1 : group.max_select,
                  });
                }}
                className="h-4 w-4 accent-[#D0121A]"
              />
              obrigatório
            </label>

            {group.selection === "MULTIPLE" && (
              <>
                <label className="flex items-center gap-1 text-[12px] text-foreground">
                  mín
                  <input
                    type="number"
                    min="0"
                    value={group.min_select}
                    onChange={(event) => updateGroup(groupIndex, { min_select: Number(event.target.value) })}
                    className="h-8 w-12 rounded-[8px] border border-input bg-card px-1.5 text-[12px]"
                  />
                </label>
                <label className="flex items-center gap-1 text-[12px] text-foreground">
                  máx
                  <input
                    type="number"
                    min="1"
                    value={group.max_select}
                    onChange={(event) => updateGroup(groupIndex, { max_select: Number(event.target.value) })}
                    className="h-8 w-12 rounded-[8px] border border-input bg-card px-1.5 text-[12px]"
                  />
                </label>
              </>
            )}
          </div>

          <div className="mt-2 space-y-1.5">
            {group.options.map((option, optionIndex) => (
              <div key={optionIndex} className="flex items-center gap-1.5">
                <input
                  value={option.name}
                  onChange={(event) => updateOption(groupIndex, optionIndex, { name: event.target.value })}
                  placeholder="Ex.: bacon"
                  className="min-h-[38px] flex-1 rounded-btn border border-input bg-card px-2.5 text-[12.5px] outline-none focus:border-brand"
                />
                <div className="flex items-center gap-1 rounded-btn border border-input bg-card px-2">
                  <span className="text-[11px] text-muted-foreground">+ R$</span>
                  <input
                    value={option.price}
                    onChange={(event) => updateOption(groupIndex, optionIndex, { price: event.target.value })}
                    onBlur={(event) =>
                      updateOption(groupIndex, optionIndex, { price: centsToInput(parseMoneyToCents(event.target.value)) })
                    }
                    inputMode="decimal"
                    className="h-[36px] w-16 text-[12.5px] outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateGroup(groupIndex, { options: group.options.filter((_, position) => position !== optionIndex) })
                  }
                  aria-label="Remover opção"
                  className="grid h-9 w-8 place-items-center text-muted-foreground hover:text-brand"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => updateGroup(groupIndex, { options: [...group.options, emptyOption()] })}
              className="flex min-h-[34px] items-center gap-1 text-[12px] font-semibold text-brand"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Adicionar opção
            </button>
          </div>
        </div>
      ))}

      <div className={cn("flex gap-2")}>
        <button
          type="button"
          onClick={() => addGroup("SINGLE")}
          className="min-h-[40px] flex-1 rounded-btn border border-dashed border-border text-[12px] font-semibold text-foreground"
        >
          + Grupo único
        </button>
        <button
          type="button"
          onClick={() => addGroup("MULTIPLE")}
          className="min-h-[40px] flex-1 rounded-btn border border-dashed border-border text-[12px] font-semibold text-foreground"
        >
          + Grupo múltiplo
        </button>
      </div>

      {error && <p className="text-[12px] font-medium text-brand">{error}</p>}
      <button
        type="button"
        onClick={() => setError(validate())}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Grupo único obrigatório usa mínimo 1 e máximo 1. No grupo múltiplo, o máximo deve ser maior ou igual ao mínimo.
      </p>
    </div>
  );
}