/** "há 12 min" — o mesmo texto do cartão de pedido, para o salão. */
export function minutesAgo(iso) {
  if (!iso) return "agora";
  const created = new Date(iso).getTime();
  const minutes = Math.max(0, Math.round((Date.now() - created) / 60000));
  if (minutes < 1) return "agora";
  if (minutes === 1) return "há 1 min";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours === 1 ? "há 1 h" : `há ${hours} h`;
}

export const AREA_LABELS = { SALAO: "Salão", VARANDA: "Varanda" };

export function tableStatus(table) {
  if (!table?.comanda) return "LIVRE";
  return table.comanda.status === "CONTA" ? "CONTA" : "OCUPADA";
}