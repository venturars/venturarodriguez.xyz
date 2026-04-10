/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_API_URL: string;
}

interface Address {
  readOnly mode?: 'read' | 'write'; // mode of the address, defaults to "read"
  readOnly  
}
