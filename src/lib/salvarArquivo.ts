/**
 * Entrega um arquivo gerado no navegador.
 * - Dentro de um protótipo publicado no Claude: usa o "downloads" do Claude (pede confirmação).
 * - No app: download normal do navegador.
 * Retorna "salvo" ou "cancelado".
 */
export async function salvarArquivo(nome: string, dados: Blob): Promise<"salvo" | "cancelado"> {
  const claude = (window as any).claude;
  if (claude?.use) {
    const downloads = await claude.use("downloads").catch(() => null);
    if (downloads) {
      try {
        await downloads.save({ filename: nome, data: dados });
        return "salvo";
      } catch (e: any) {
        if (e?.code === "declined") return "cancelado";
        if (e?.code !== "unavailable" && e?.code !== "not_granted") throw new Error(e?.message || "Não foi possível salvar o arquivo.");
      }
    }
  }
  const url = URL.createObjectURL(dados);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "salvo";
}
