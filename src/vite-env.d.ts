/// <reference types="vite/client" />

declare module "*.woff?url" {
  const url: string;
  export default url;
}
