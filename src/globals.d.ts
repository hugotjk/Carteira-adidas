declare module "*.json" {
  const value: any;
  export default value;
}

declare module "*.webp" {
  const src: string;
  export default src;
}

declare module "*.pdf?url" {
  const src: string;
  export default src;
}
