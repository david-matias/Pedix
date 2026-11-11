import { createFileRoute } from "@tanstack/react-router";
import LojistaShell from "@/components/lojista/LojistaShell";

export const Route = createFileRoute("/_authed/_lojista")({ component: LojistaShell });