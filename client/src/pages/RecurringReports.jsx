import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import Shell from "../components/layout/Shell.jsx";
import PageHeader from "../components/appui/PageHeader.jsx";
import Card, { CardBody, CardHeader } from "../components/appui/Card.jsx";
import EmptyState from "../components/appui/EmptyState.jsx";
import Button from "../components/appui/Button.jsx";
import Skeleton from "../components/appui/Skeleton.jsx";
import Badge from "../components/appui/Badge.jsx";
import { getRecurringReportsDashboard } from "../app/recurringReportsApi.js";
import {
  getRecurringStatusLabel,
  getRecurringStatusTone,
} from "../utils/recurringStatus.js";

const previewItems = [
  {
    title: "Carteira em atraso",
    text: "Acompanhe parcelas vencidas, valor em aberto e recorrências com maior risco.",
  },
  {
    title: "Clientes inadimplentes",
    text: "Identifique quem está atrasando pagamentos e quais clientes precisam de ação.",
  },
  {
    title: "Comportamento de pagamento",
    text: "Veja dias de pagamento, tempo médio para pagar e recuperação após lembretes.",
  },
];

export default function RecurringReports() {
  return (
    <Shell>
      <div className="space-y-6">
        <PageHeader
          title="Relatórios de recorrência"
          subtitle="Uma visão dedicada de cobrança, inadimplência e comportamento de pagamento está sendo preparada."
          actions={
            <Link to="/reports">
              <Button variant="secondary">Ver relatórios gerais</Button>
            </Link>
          }
        />

        <Card>
          <CardBody className="space-y-6 p-6">
            <EmptyState
              title="Em breve"
              description="Esta área vai concentrar os indicadores de recorrência para você acompanhar risco, recebimento e atraso em um único lugar."
            />

            <div className="grid gap-4 md:grid-cols-3">
              {previewItems.map((item) => (
                <div
                  key={item.title}
                  className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5"
                >
                  <div className="text-sm font-semibold text-zinc-900">
                    {item.title}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-zinc-600">
                    {item.text}
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </Shell>
  );
}
