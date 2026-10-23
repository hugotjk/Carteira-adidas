/**
 * Lojas do PDV que usam dois cadastros e precisam ser somadas.
 *
 * Regras (definidas pelo Hugo):
 * 1. Loja com "NAOUSAR" no nome soma com a mesma loja sem o "NAOUSAR".
 *    Ex.: "BARRA FLA NAOUSAR" → "BARRA FLA".
 * 2. Só no ECOMM, o "2" no nome soma com a loja sem o "2".
 *    Ex.: "FLA2 ECOMM" → "FLA ECOMM".
 * 3. Fora do ECOMM, o "2" é outra loja: "BARRA2 FLA" NÃO soma com "BARRA FLA".
 */
export function lojaCanonica(nome: string): string {
  let n = String(nome || "")
    .toUpperCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // NÃO → NAO
    .replace(/[-_.]/g, " ");
  n = n.replace(/\bNAO\s*USAR\b/g, " ");
  n = n.replace(/\s+/g, " ").trim();
  if (/\bECOMM\b/.test(n)) n = n.replace(/(\D)2\b/g, "$1").replace(/\s+/g, " ").trim();
  return n;
}
