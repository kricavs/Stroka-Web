// WhatsApp-ready text for handing over portal access. Pure (used in the browser).
export const formatAccessMessage = ({ name, code, url }) =>
  `Hola, te compartimos el acceso a tu portal de Stroka.\n\nEmpresa: ${name}\nCódigo: ${code}\nPortal: ${url}`;
