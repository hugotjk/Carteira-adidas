import { jsPDF } from "jspdf";

/** Gera e baixa o PDF "Manual do Usuário" (botão "Gerar PDF" da tela Banco). */
export function generateManualPDF() {
  const docPdf = new jsPDF();
  let y = 20;

  const checkPage = (needed: number) => {
    if (y + needed > 280) {
      docPdf.addPage();
      y = 20;
    }
  };

  const addTitle = (text: string) => {
    checkPage(15);
    docPdf.setFontSize(18);
    docPdf.setFont("helvetica", "bold");
    docPdf.setTextColor(0, 0, 0);
    docPdf.text(text, 20, y);
    y += 12;
  };

  const addSubtitle = (text: string) => {
    checkPage(10);
    docPdf.setFontSize(14);
    docPdf.setFont("helvetica", "bold");
    docPdf.setTextColor(60, 60, 60);
    docPdf.text(text, 20, y);
    y += 8;
  };

  const addText = (text: string, isBullet = false) => {
    docPdf.setFontSize(10);
    docPdf.setFont("helvetica", "normal");
    docPdf.setTextColor(80, 80, 80);
    const splitText = docPdf.splitTextToSize(isBullet ? `• ${text}` : text, 170);
    checkPage(splitText.length * 6);
    docPdf.text(splitText, isBullet ? 25 : 20, y);
    y += (splitText.length * 6);
  };

  const addSpace = (amount = 5) => {
    y += amount;
  };

  // --- COVER ---
  docPdf.setFillColor(0, 0, 0);
  docPdf.rect(0, 0, 210, 40, "F");
  docPdf.setTextColor(255, 255, 255);
  docPdf.setFontSize(24);
  docPdf.text("MANUAL DO USUÁRIO", 20, 25);
  docPdf.setFontSize(12);
  docPdf.text("Sistema de Gestão de Pedidos Adidas", 20, 33);
  
  y = 55;
  addText("Este documento fornece uma explicação detalhada de todas as funcionalidades, campos e interações disponíveis no aplicativo.");
  addSpace(10);

  // --- FILTROS ---
  addTitle("1. Sistema de Filtros Inteligentes");
  addText("O aplicativo utiliza um sistema de filtros inspirado no Excel, localizado no topo das telas de 'Análise' e 'LIB. | CANC.'.");
  addSpace();
  addText("Como utilizar:", true);
  addText("Clique em qualquer botão de filtro (Cliente, Coleção, Mês, etc.) para abrir o menu de opções.", true);
  addText("Use a barra de pesquisa dentro do filtro para encontrar itens específicos rapidamente.", true);
  addText("Você pode selecionar múltiplos itens em cada categoria. O app atualizará os dados instantaneamente.", true);
  addText("O botão 'Limpar Filtros' no cabeçalho remove todas as seleções de uma só vez.", true);
  addSpace(10);

  // --- ANALISE ---
  addTitle("2. Tela de Análise");
  addText("Esta tela é focada na exploração profunda da carteira de pedidos agrupada por material.");
  addSpace();
  addSubtitle("Campos Principais:");
  addText("Código do Material: Identificador único do produto (ex: IG1234).", true);
  addText("Descrição: Nome comercial do material.", true);
  addText("Qtde Total: Soma de todas as unidades confirmadas para este material.", true);
  addText("Valor Total: Soma financeira de todas as NFs deste material.", true);
  addSpace();
  addSubtitle("Interações (O que acontece ao clicar?):");
  addText("Clique no Material: Expande o card para mostrar a distribuição por STATUS (Pendente, Cancelado, Atendido).", true);
  addText("Clique no Status: Expande novamente para mostrar a distribuição por MÊS DE RECEBIMENTO.", true);
  addText("Foto do Produto: Clique na miniatura para visualizar a imagem do material (se disponível).", true);
  addSpace(10);

  // --- LIB CANC ---
  addTitle("3. Tela LIB. | CANC.");
  addText("Tela operacional para gestão individual de pedidos e exportação de dados.");
  addSpace();
  addSubtitle("Campos de Performance (Cores e Significados):");
  addText("Venda | Estq: Dados atuais de venda e estoque da loja específica.", true);
  addText("Venda G. | Estq G. (Laranja): Metas e médias definidas pelo gestor. Se os números estiverem em destaque, requerem atenção.", true);
  addSpace();
  addSubtitle("Gestão de Seleção:");
  addText("Seleção por Material: Clique no quadrado à esquerda do material para selecionar todos os pedidos vinculados a ele.", true);
  addText("Seleção Individual: Expanda o material e selecione apenas as lojas/pedidos desejados.", true);
  addText("Resumo Flutuante: Uma barra inferior aparece ao selecionar itens, mostrando o Valor e Qtde Total da sua seleção atual.", true);
  addText("Exportar XLSX: Gera um arquivo Excel formatado especificamente para importação no banco de dados, removendo separadores de milhar e garantindo tipos numéricos puros.", true);
  addSpace(10);

  // --- BANCO ---
  addTitle("4. Banco de Dados (Sincronização)");
  addText("Gerenciamento da integridade e atualização dos dados.");
  addSpace();
  addText("Última Atualização: Indica o momento exato em que o app baixou dados da nuvem.", true);
  addText("Sincronizar Agora: Use este botão se houver alterações recentes na planilha mestre que ainda não aparecem no app.", true);
  addText("Modo Offline: O app salva os dados no seu dispositivo. Você pode consultar a carteira mesmo sem internet.", true);

  docPdf.save("manual_detalhado_adidas_app.pdf");
}
