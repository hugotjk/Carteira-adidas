import manualUrl from "../assets/manual-app-carteira.pdf?url";
import { salvarArquivo } from "../lib/salvarArquivo";

/**
 * Baixa o PDF "Manual do app" (botão "Gerar PDF" da tela Banco).
 * O PDF tem os prints das telas com setas e textos curtos, feito com o login de demonstração (lojas DEMO).
 * Para atualizar: troque src/assets/manual-app-carteira.pdf.
 */
export async function generateManualPDF() {
  try {
    const b = await (await fetch(manualUrl)).blob();
    await salvarArquivo("Manual_App_Carteira_adidas.pdf", b);
  } catch {
    window.open(manualUrl, "_blank");
  }
}
