import type { Metadata } from "next";
import AssistantChat from "@/components/assistant/AssistantChat";

export const metadata: Metadata = {
  title: "Assistant — Livre de Connaissances | IFPC",
  description:
    "Question/réponse sourcée sur le Livre de Connaissances cidricoles AsCoCid.",
};

export default function AssistantPage() {
  return <AssistantChat />;
}
