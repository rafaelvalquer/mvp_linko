// src/pages/SettingsAgenda.jsx
import { useEffect, useMemo, useState } from "react";
import Shell from "../components/layout/Shell.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Button from "../components/appui/Button.jsx";
import { Input } from "../components/appui/Input.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import { api } from "../app/api.js";

// --- CONSTANTS & HELPERS ---
const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABEL = {
  mon: "Segunda",
  tue: "Terça",
  wed: "Quarta",
  thu: "Quinta",
  fri: "Sexta",
  sat: "Sábado",
  sun: "Domingo",
};

const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília (America/Sao_Paulo)" },
  { value: "America/Manaus", label: "Manaus (America/Manaus)" },
  { value: "America/Recife", label: "Recife (America/Recife)" },
  { value: "America/Rio_Branco", label: "Rio Branco (America/Rio_Branco)" },
  { value: "UTC", label: "UTC" },
];

const PRESETS = [
  {
    value: "commercial",
    label: "Comercial (09-18h)",
    slots: [
      "09:00",
      "10:00",
      "11:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
    ],
  },
  {
    value: "morning",
    label: "Manhã (09-12h)",
    slots: ["09:00", "10:00", "11:00", "12:00"],
  },
  {
    value: "afternoon",
    label: "Tarde (14-18h)",
    slots: ["14:00", "15:00", "16:00", "17:00", "18:00"],
  },
  {
    value: "night",
    label: "Noite (18-22h)",
    slots: ["18:00", "19:00", "20:00", "21:00", "22:00"],
  },
  { value: "custom", label: "Personalizado", slots: [] },
];

const RECOMMENDED_DEFAULT = [
  "09:00",
  "10:00",
  "11:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];

function clone(v) {
  return JSON.parse(JSON.stringify(v || {}));
}
function isHHmm(s) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || "").trim());
}
function parseMin(hhmm) {
  if (!isHHmm(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function fmtHHmm(mins) {
  const m = Math.max(0, Math.min(1439, mins));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
function uniqTimes(list) {
  return [...new Set((list || []).filter(isHHmm))].sort(
    (a, b) => parseMin(a) - parseMin(b),
  );
}

// --- COMPONENTS ---

/** Componente de seleção de horários por Chips ou Range */
function SlotPicker({ value, onChange, disabled, step = 60 }) {
  const [customTime, setCustomTime] = useState("");
  const selected = uniqTimes(value);

  const toggle = (t) => {
    const next = selected.includes(t)
      ? selected.filter((x) => x !== t)
      : [...selected, t];
    onChange(uniqTimes(next));
  };

  const quickOptions = useMemo(() => {
    const opts = [];
    for (let m = 360; m <= 1320; m += step) opts.push(fmtHHmm(m));
    return opts;
  }, [step]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {quickOptions.map((t) => (
          <button
            key={t}
            type="button"
            disabled={disabled}
            onClick={() => toggle(t)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              selected.includes(t)
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="time"
          className="w-32"
          value={customTime}
          onChange={(e) => setCustomTime(e.target.value)}
          disabled={disabled}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || !isHHmm(customTime)}
          onClick={() => {
            toggle(customTime);
            setCustomTime("");
          }}
        >
          + Adicionar
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="text-red-600"
          onClick={() => onChange([])}
        >
          Limpar tudo
        </Button>
      </div>
    </div>
  );
}

// --- MAIN PAGE ---

export default function SettingsAgenda() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [settings, setSettings] = useState(null);
  const [initialJSON, setInitialJSON] = useState("");

  // Para a prévia (Simulator)
  const [previewDate, setPreviewDate] = useState("");

  const agenda = settings?.agenda || {};

  const load = async () => {
    try {
      setLoading(true);
      const d = await api("/settings");
      const a = d.settings?.agenda || {};
      // Sanitização básica
      a.timezone = a.timezone || "America/Sao_Paulo";
      a.slotMinutes = a.slotMinutes || 60;
      a.weeklyRules = a.weeklyRules || {};
      setSettings(d.settings);
      setInitialJSON(JSON.stringify(a));
    } catch (e) {
      setErr("Erro ao carregar configurações: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const dirty = useMemo(() => {
    if (!settings?.agenda) return false;
    return JSON.stringify(settings.agenda) !== initialJSON;
  }, [settings, initialJSON]);

  const patchAgenda = (patch) => {
    setSettings((prev) => ({
      ...prev,
      agenda: { ...prev.agenda, ...patch },
    }));
  };

  // --- ACTIONS ---

  const handleSave = async () => {
    const problems = validate();
    if (problems.length) {
      setErr("Corrija os erros:\n• " + problems.join("\n• "));
      window.scrollTo(0, 0);
      return;
    }

    try {
      setSaving(true);
      setErr("");

      const res = await api("/settings/agenda", {
        method: "PATCH",
        body: JSON.stringify({ agenda: settings.agenda }),
      });

      // IMPORTANTE: atualizar o state com o retorno do backend
      setSettings(res.settings);

      // e atualizar o snapshot inicial com o mesmo conteúdo
      setInitialJSON(JSON.stringify(res.settings?.agenda || settings.agenda));

      setOkMsg("Configurações salvas com sucesso!");
      setTimeout(() => setOkMsg(""), 3000);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const validate = () => {
    const a = settings.agenda;
    const p = [];
    if (!a.timezone) p.push("Selecione um fuso horário.");
    if (uniqTimes(a.defaultSlots).length === 0)
      p.push("Defina ao menos um horário padrão.");

    // Validar regras semanais abertas
    DAY_ORDER.forEach((d) => {
      if (
        a.weeklyRules[d]?.open &&
        uniqTimes(a.weeklyRules[d]?.slots).length === 0
      ) {
        p.push(`O dia ${DAY_LABEL[d]} está aberto mas não possui horários.`);
      }
    });

    // Validar duplicatas em datas
    const checkDups = (list, name) => {
      const dates = list.filter((x) => x.date).map((x) => x.date);
      if (new Set(dates).size !== dates.length)
        p.push(`Existem datas duplicadas em ${name}.`);
      if (list.some((x) => !x.date))
        p.push(`Preencha todas as datas em ${name}.`);
    };

    checkDups(a.dateBlocks || [], "Folgas");
    checkDups(a.holidays || [], "Feriados");
    checkDups(a.dateOverrides || [], "Dias Especiais");

    return p;
  };

  // --- PREVIEW LOGIC (SIMULATOR) ---
  const simulatedSlots = useMemo(() => {
    if (!previewDate) return null;
    const a = settings.agenda;

    // 1. Check Blocks/Holidays
    if (a.dateBlocks?.some((b) => b.date === previewDate))
      return { status: "closed", reason: "Folga programada" };
    if (a.holidays?.some((h) => h.date === previewDate))
      return { status: "closed", reason: "Feriado" };

    // 2. Check Overrides
    const override = a.dateOverrides?.find((o) => o.date === previewDate);
    if (override) {
      if (override.closed)
        return { status: "closed", reason: "Fechado manualmente" };
      return { status: "open", slots: uniqTimes(override.slots) };
    }

    // 3. Weekly Rule
    const dow = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][
      new Date(previewDate + "T12:00:00").getDay()
    ];
    const rule = a.weeklyRules[dow];
    if (rule?.open) return { status: "open", slots: uniqTimes(rule.slots) };
    if (rule && !rule.open)
      return { status: "closed", reason: "Não atende neste dia da semana" };

    // 4. Fallback Default
    return { status: "open", slots: uniqTimes(a.defaultSlots) };
  }, [previewDate, settings]);

  if (loading)
    return (
      <Shell>
        <Skeleton className="h-20 mb-4" />
        <Skeleton className="h-64" />
      </Shell>
    );

  return (
    <Shell>
      <PageHeader
        title="Configuração da Agenda"
        subtitle="Gerencie sua disponibilidade e fusos horários."
        actions={
          <Button onClick={handleSave} disabled={saving || !dirty}>
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        }
      />

      <div className="mt-6 space-y-6 pb-24">
        {/* FEEDBACK */}
        {err && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl whitespace-pre-line text-sm">
            {err}
          </div>
        )}
        {okMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm">
            {okMsg}
          </div>
        )}

        {/* 0. SIMULATOR (PREVIEW) */}
        <Card className="bg-indigo-50/50 border-indigo-100">
          <CardHeader
            title="👁️ Prévia da Agenda"
            subtitle="Veja como o cliente enxergará sua disponibilidade em uma data específica."
          />
          <CardBody>
            <div className="flex flex-wrap items-center gap-4">
              <div className="w-48">
                <Input
                  type="date"
                  value={previewDate}
                  onChange={(e) => setPreviewDate(e.target.value)}
                />
              </div>
              {!previewDate && (
                <span className="text-sm text-zinc-500 italic">
                  Selecione uma data para testar suas regras...
                </span>
              )}
              {simulatedSlots && (
                <div className="flex flex-wrap gap-2">
                  {simulatedSlots.status === "closed" ? (
                    <span className="text-sm font-medium text-red-600">
                      Indisponível: {simulatedSlots.reason}
                    </span>
                  ) : (
                    simulatedSlots.slots.map((s) => (
                      <span
                        key={s}
                        className="px-2 py-1 bg-white border border-indigo-200 text-indigo-700 text-xs font-bold rounded shadow-sm"
                      >
                        {s}
                      </span>
                    ))
                  )}
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* 1. GERAL */}
        <Card>
          <CardHeader
            title="Horários Padrão"
            subtitle="Configurações globais e horários de reserva (fallback)."
          />
          <CardBody className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">
                  Fuso Horário
                </label>
                <select
                  className="w-full rounded-lg border-zinc-200 text-sm p-2"
                  value={agenda.timezone}
                  onChange={(e) => patchAgenda({ timezone: e.target.value })}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">
                  Duração do Slot (Intervalo)
                </label>
                <select
                  className="w-full rounded-lg border-zinc-200 text-sm p-2"
                  value={agenda.slotMinutes}
                  onChange={(e) =>
                    patchAgenda({ slotMinutes: Number(e.target.value) })
                  }
                >
                  {[15, 30, 45, 60, 90, 120].map((m) => (
                    <option key={m} value={m}>
                      {m} minutos
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-zinc-400 italic">
                  O "passo" entre cada horário disponível na agenda pública.
                </p>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex flex-wrap justify-between items-start gap-3 mb-3">
                <div>
                  <label className="text-sm font-bold text-zinc-700">
                    Horários padrão disponíveis
                  </label>
                  <p className="mt-1 text-xs text-zinc-500">
                    Esses horários serão usados como base da sua agenda quando
                    não houver regras específicas para o dia.
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    patchAgenda({ defaultSlots: RECOMMENDED_DEFAULT })
                  }
                >
                  Restaurar Recomendado
                </Button>
              </div>

              <SlotPicker
                value={agenda.defaultSlots}
                step={agenda.slotMinutes}
                onChange={(val) => patchAgenda({ defaultSlots: val })}
              />
            </div>
          </CardBody>
        </Card>

        {/* 2. SEMANA DE TRABALHO */}
        <Card>
          <CardHeader
            title="Semana de Trabalho"
            subtitle="Defina sua rotina semanal padrão."
            right={
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const wr = {};
                    DAY_ORDER.forEach(
                      (d) =>
                        (wr[d] = {
                          open: !["sat", "sun"].includes(d),
                          slots: PRESETS[0].slots,
                        }),
                    );
                    patchAgenda({ weeklyRules: wr });
                  }}
                >
                  Seg-Sex
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const wr = {};
                    DAY_ORDER.forEach(
                      (d) => (wr[d] = { open: true, slots: PRESETS[0].slots }),
                    );
                    patchAgenda({ weeklyRules: wr });
                  }}
                >
                  Todos os dias
                </Button>
              </div>
            }
          />
          <CardBody className="space-y-4">
            {DAY_ORDER.map((day) => {
              const rule = agenda.weeklyRules?.[day] || {
                open: false,
                slots: [],
              };
              return (
                <div
                  key={day}
                  className={`p-4 rounded-xl border transition-colors ${rule.open ? "bg-white border-zinc-200" : "bg-zinc-50 border-transparent opacity-60"}`}
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="w-24">
                      <span className="font-bold text-zinc-800">
                        {DAY_LABEL[day]}
                      </span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded text-indigo-600"
                        checked={rule.open}
                        onChange={(e) => {
                          const nextRules = { ...agenda.weeklyRules };
                          nextRules[day] = {
                            ...rule,
                            open: e.target.checked,
                            slots: e.target.checked
                              ? rule.slots.length
                                ? rule.slots
                                : agenda.defaultSlots
                              : [],
                          };
                          patchAgenda({ weeklyRules: nextRules });
                        }}
                      />
                      <span className="text-sm">
                        {rule.open ? "Aberto" : "Fechado"}
                      </span>
                    </label>

                    {rule.open && (
                      <div className="flex-1 flex items-center gap-3 min-w-[300px]">
                        <select
                          className="text-sm border-zinc-200 rounded-lg p-1.5"
                          onChange={(e) => {
                            const preset = PRESETS.find(
                              (p) => p.value === e.target.value,
                            );
                            if (!preset) return;
                            const nextRules = { ...agenda.weeklyRules };
                            nextRules[day] = {
                              ...rule,
                              slots: preset.slots,
                              _custom: preset.value === "custom",
                            };
                            patchAgenda({ weeklyRules: nextRules });
                          }}
                        >
                          <option value="">Aplicar Modelo...</option>
                          {PRESETS.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                        <div className="flex-1">
                          <SlotPicker
                            value={rule.slots}
                            step={agenda.slotMinutes}
                            onChange={(val) => {
                              const nextRules = { ...agenda.weeklyRules };
                              nextRules[day] = { ...rule, slots: val };
                              patchAgenda({ weeklyRules: nextRules });
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>

        {/* 3. FOLGAS E FERIADOS */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader
              title="Folgas / Ausências"
              subtitle="Bloqueio total de datas específicas."
            />
            <CardBody className="space-y-3">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() =>
                  patchAgenda({
                    dateBlocks: [
                      ...(agenda.dateBlocks || []),
                      { date: "", reason: "" },
                    ],
                  })
                }
              >
                + Adicionar Data
              </Button>
              {(agenda.dateBlocks || []).map((b, i) => (
                <div key={i} className="flex gap-2 items-start border-b pb-2">
                  <Input
                    type="date"
                    value={b.date}
                    onChange={(e) => {
                      const next = [...agenda.dateBlocks];
                      next[i].date = e.target.value;
                      patchAgenda({ dateBlocks: next });
                    }}
                  />
                  <Input
                    placeholder="Motivo"
                    value={b.reason}
                    onChange={(e) => {
                      const next = [...agenda.dateBlocks];
                      next[i].reason = e.target.value;
                      patchAgenda({ dateBlocks: next });
                    }}
                  />
                  <Button
                    variant="ghost"
                    className="text-red-500"
                    onClick={() => {
                      const next = agenda.dateBlocks.filter(
                        (_, idx) => idx !== i,
                      );
                      patchAgenda({ dateBlocks: next });
                    }}
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Feriados"
              subtitle="Datas que não haverá expediente."
            />
            <CardBody className="space-y-3">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() =>
                  patchAgenda({
                    holidays: [
                      ...(agenda.holidays || []),
                      { date: "", name: "" },
                    ],
                  })
                }
              >
                + Adicionar Feriado
              </Button>
              {(agenda.holidays || []).map((h, i) => (
                <div key={i} className="flex gap-2 items-start border-b pb-2">
                  <Input
                    type="date"
                    value={h.date}
                    onChange={(e) => {
                      const next = [...agenda.holidays];
                      next[i].date = e.target.value;
                      patchAgenda({ holidays: next });
                    }}
                  />
                  <Input
                    placeholder="Nome"
                    value={h.name}
                    onChange={(e) => {
                      const next = [...agenda.holidays];
                      next[i].name = e.target.value;
                      patchAgenda({ holidays: next });
                    }}
                  />
                  <Button
                    variant="ghost"
                    className="text-red-500"
                    onClick={() => {
                      const next = agenda.holidays.filter(
                        (_, idx) => idx !== i,
                      );
                      patchAgenda({ holidays: next });
                    }}
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        {/* 4. DIAS ESPECIAIS */}
        <Card>
          <CardHeader
            title="Dias Especiais"
            subtitle="Horários diferenciados para uma data específica (ex: abrir num domingo)."
          />
          <CardBody className="space-y-4">
            <Button
              variant="secondary"
              onClick={() =>
                patchAgenda({
                  dateOverrides: [
                    ...(agenda.dateOverrides || []),
                    { date: "", closed: false, slots: agenda.defaultSlots },
                  ],
                })
              }
            >
              + Configurar Dia Especial
            </Button>

            {(agenda.dateOverrides || []).map((o, i) => (
              <div
                key={i}
                className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/30"
              >
                <div className="flex flex-wrap gap-4 items-center mb-4">
                  <Input
                    type="date"
                    className="w-48"
                    value={o.date}
                    onChange={(e) => {
                      const next = [...agenda.dateOverrides];
                      next[i].date = e.target.value;
                      patchAgenda({ dateOverrides: next });
                    }}
                  />
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={o.closed}
                      onChange={(e) => {
                        const next = [...agenda.dateOverrides];
                        next[i].closed = e.target.checked;
                        patchAgenda({ dateOverrides: next });
                      }}
                    />
                    <span>Marcar como Fechado</span>
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-red-500"
                    onClick={() => {
                      const next = agenda.dateOverrides.filter(
                        (_, idx) => idx !== i,
                      );
                      patchAgenda({ dateOverrides: next });
                    }}
                  >
                    Remover Regra
                  </Button>
                </div>
                {!o.closed && (
                  <SlotPicker
                    value={o.slots}
                    step={agenda.slotMinutes}
                    onChange={(val) => {
                      const next = [...agenda.dateOverrides];
                      next[i].slots = val;
                      patchAgenda({ dateOverrides: next });
                    }}
                  />
                )}
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      {/* STICKY SAVE BAR */}
      {dirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-50">
          <div className="bg-zinc-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-white/10 animate-in slide-in-from-bottom-4">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-sm font-medium">
                Você tem alterações não salvas
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="text-zinc-400 hover:text-white"
                onClick={load}
              >
                Descartar
              </Button>
              <Button
                className="bg-indigo-500 hover:bg-indigo-400"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar Agora"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
