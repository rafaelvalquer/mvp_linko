import Shell from "../components/layout/Shell.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import Badge from "../components/appui/Badge.jsx";
import Button from "../components/appui/Button.jsx";
import { Input } from "../components/appui/Input.jsx";
import { useMemo, useState } from "react";

export default function Calendar() {
  // MVP: mock local (até existir endpoint de bookings)
  const [day, setDay] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  });

  const items = useMemo(() => {
    const base = new Date(day + "T00:00:00");
    const mk = (h, m, status) => ({
      id: `${day}_${h}_${m}`,
      startAt: new Date(new Date(base).setHours(h, m, 0, 0)).toISOString(),
      endAt: new Date(new Date(base).setHours(h + 1, m, 0, 0)).toISOString(),
      status,
      title:
        status === "HOLD"
          ? "Reserva (aguardando pagamento)"
          : "Agendado confirmado",
    });
    return [mk(14, 0, "CONFIRMED"), mk(16, 0, "HOLD")];
  }, [day]);

  const fmtTime = (iso) =>
    new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(
      new Date(iso),
    );

  return (
    <Shell>
      <div className="space-y-4">
        <PageHeader
          title="Agenda"
          subtitle="Dia/semana (MVP): lista de reservas e confirmados."
          actions={
            <Button
              variant="secondary"
              type="button"
              onClick={() => setDay(new Date().toISOString().slice(0, 10))}
            >
              Hoje
            </Button>
          }
        />

        <Card>
          <CardHeader
            title="Agenda do dia"
            subtitle="Filtre por data e acompanhe HOLD/CONFIRMED."
            right={
              <div className="w-44">
                <Input
                  type="date"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                />
              </div>
            }
          />
          <CardBody className="space-y-3">
            {items.map((it) => (
              <div key={it.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      {fmtTime(it.startAt)}–{fmtTime(it.endAt)}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {it.title}
                    </div>
                  </div>
                  <Badge tone={it.status}>{it.status}</Badge>
                </div>
              </div>
            ))}
            <div className="text-xs text-zinc-500">
              Próximo: integrar bookings reais (HOLD/CONFIRMED) do backend.
            </div>
          </CardBody>
        </Card>
      </div>
    </Shell>
  );
}
