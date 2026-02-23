// src/components/dashboard/ChartCard.jsx
import Card, { CardBody, CardHeader } from "../appui/Card.jsx";

export default function ChartCard({
  title,
  subtitle,
  right,
  className = "",
  bodyClassName = "",
  children,
}) {
  return (
    <Card
      className={[
        "border-none shadow-sm ring-1 ring-zinc-200 overflow-hidden",
        className,
      ].join(" ")}
    >
      <CardHeader title={title} subtitle={subtitle} right={right} />
      <CardBody className={["p-5", bodyClassName].join(" ")}>
        {children}
      </CardBody>
    </Card>
  );
}
