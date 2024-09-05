import { Cart, FourthwallCart } from "./types";

export const reshapeCart = (cart: FourthwallCart): Cart => {
  // if (!cart.cost?.totalTaxAmount) {
  //   cart.cost.totalTaxAmount = {
  //     value: '0.0',
  //     currencyCode: 'USD'
  //   };
  // }

  console.warn('CART', cart)

  return {
    ...cart,
    cost: {
      totalAmount: {
        value: cart.items.map((item) => item.quantity * item.variant.unitPrice.value).reduce((a, b) => a + b, 0),
        currencyCode: cart.items[0]?.variant.unitPrice.currencyCode || 'USD'
      }
    },
    items: cart.items.map((item) => ({
      id: item.variant.id,
      quantity: item.quantity,
      cost: {
        totalAmount: {
          value: item.variant.unitPrice.value,
          currencyCode: item.variant.unitPrice.currencyCode
        }
      },
      merchandise: {
        id: item.variant.id,
        title: item.variant.name,
        selectedOptions: [],
        product: {
          id: 'TT',
          handle: 'TT',
          title: 'TT',
          featuredImage: {
            url: item.variant.images[0]?.url || 'TT',
            altText: 'TT',
            width: item.variant.images[0]?.width || 100,
            height: item.variant.images[0]?.height || 100
          }
        }
      }
    }))
  };
};
