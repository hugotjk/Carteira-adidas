import React from "react";
import { cn } from "../lib/utils";

/**
 * Foto do material, buscada nos repositórios de imagens do GitHub.
 * O imageMap guarda, por material, "extensão:repositório" (ex.: "png:adidas-fla").
 */
export function getProductImageUrl(material: string, imageMap: Record<string, string>): string | null {
  const entry = imageMap[material];
  if (!entry) return null;

  let ext = entry;
  let repo = "adidas-fla";
  if (entry.includes(":")) {
    const parts = entry.split(":");
    ext = parts[0];
    repo = parts[1];
  }

  return repo === "adidas"
    ? `https://raw.githubusercontent.com/hugotjk/adidas/main/${material}.${ext}`
    : `https://raw.githubusercontent.com/hugotjk/adidas-fla/main/${material}.${ext}`;
}

const SIZES = {
  sm: { box: "w-12 h-12", text: "text-[6px]" },
  md: { box: "w-16 h-16", text: "text-[8px]" },
};

interface ProductImageProps {
  material: string;
  imageMap: Record<string, string>;
  size?: keyof typeof SIZES;
}

/** Endereços tentados, em ordem, quando o material ainda não está na lista de fotos. */
function guessUrls(material: string): string[] {
  const base = "https://raw.githubusercontent.com/hugotjk";
  return [
    `${base}/adidas-fla/main/${material}.png`,
    `${base}/adidas-fla/main/${material}.jpg`,
    `${base}/adidas/main/${material}.png`,
    `${base}/adidas/main/${material}.jpg`,
  ];
}

const ProductImage = React.memo(({ material, imageMap, size = "sm" }: ProductImageProps) => {
  const s = SIZES[size];
  // Se o material ainda não está na lista (ex.: foto subiu agora), tenta achar a foto direto no GitHub
  const candidates = React.useMemo(() => {
    const known = getProductImageUrl(material, imageMap);
    return known ? [known] : guessUrls(material);
  }, [material, imageMap]);
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => setAttempt(0), [candidates]);

  const imageUrl = candidates[attempt];

  if (!imageUrl) {
    return (
      <div className={cn(s.box, "bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200 flex-shrink-0")}>
        <span className={cn(s.text, "font-black text-gray-400 uppercase text-center leading-tight")}>SEM<br/>FOTO</span>
      </div>
    );
  }

  return (
    <div className={cn(s.box, "bg-white rounded-lg overflow-hidden border border-gray-100 flex items-center justify-center flex-shrink-0")}>
      <img
        src={imageUrl}
        alt={material}
        loading="lazy"
        decoding="async"
        onError={() => setAttempt((n) => n + 1)}
        className="w-full h-full object-contain"
        referrerPolicy="no-referrer"
      />
    </div>
  );
});

export default ProductImage;
