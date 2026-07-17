export interface WhatsAppMessage {
  productId: string;
  productName: string;
  productDescription: string;
  productPrice?: number;
  productImage?: string;
}

export const generateWhatsAppLink = (
  message: WhatsAppMessage
): string => {
  const waNumber = process.env.NEXT_PUBLIC_WA_NUMBER || '51961144177';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const text = `Hola! 👋 Me interesa este producto:

📦 *${message.productName}*

📝 *Descripción:*
${message.productDescription}

${message.productPrice ? `💵 *Precio:* S/. ${message.productPrice}` : ''}

${message.productImage ? `🖼️ Ver producto: ${siteUrl}/producto/${message.productId}` : ''}

¿Me podrían dar más información y confirmar disponibilidad?`;

  return `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
};

export const generateAutoReplyMessage = (product: WhatsAppMessage): string => {
  return `Hola! 👋 Me interesa este producto:

📦 *${product.productName}*
📝 ${product.productDescription}
${product.productPrice ? `💵 S/. ${product.productPrice}` : ''}

¿Cuál es la disponibilidad?`;
};
