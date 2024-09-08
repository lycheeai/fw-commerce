import { SHOPIFY_GRAPHQL_API_ENDPOINT, TAGS } from 'lib/constants';
import { ensureStartsWith } from 'lib/utils';
import { revalidateTag } from 'next/cache';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { reshapeCart } from './reshape';
import {
  Cart,
  Collection,
  FourthwallProduct,
  FourthwallProductImage,
  FourthwallProductVariant,
  Image,
  Menu,
  Page,
  Product,
  ProductVariant,
  ShopifyCollection
} from './types';

const domain = process.env.SHOPIFY_STORE_DOMAIN
  ? ensureStartsWith(process.env.SHOPIFY_STORE_DOMAIN, 'https://')
  : '';
const endpoint = `${domain}${SHOPIFY_GRAPHQL_API_ENDPOINT}`;
const key = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN!;

type ExtractVariables<T> = T extends { variables: object } ? T['variables'] : never;

// export async function shopifyFetch<T>({
//   cache = 'force-cache',
//   headers,
//   query,
//   tags,
//   variables
// }: {
//   cache?: RequestCache;
//   headers?: HeadersInit;
//   query: string;
//   tags?: string[];
//   variables?: ExtractVariables<T>;
// }): Promise<{ status: number; body: T } | never> {
//   try {
//     const result = await fetch(endpoint, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'X-Shopify-Storefront-Access-Token': key,
//         ...headers
//       },
//       body: JSON.stringify({
//         ...(query && { query }),
//         ...(variables && { variables })
//       }),
//       cache,
//       ...(tags && { next: { tags } })
//     });

//     const body = await result.json();

//     if (body.errors) {
//       throw body.errors[0];
//     }

//     return {
//       status: result.status,
//       body
//     };
//   } catch (e) {
//     if (isShopifyError(e)) {
//       throw {
//         cause: e.cause?.toString() || 'unknown',
//         status: e.status || 500,
//         message: e.message,
//         query
//       };
//     }

//     throw {
//       error: e,
//       query
//     };
//   }
// }

export async function fourthwallGet<T>(url: string, options: RequestInit = {}): Promise<{ status: number; body: T }> {
  try {
    const result = await fetch(
      url,
      {
        method: 'GET',
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      }
    );

    const body = await result.json();

    return {
      status: result.status,
      body
    };
  } catch (e) {
    throw {
      error: e,
      url
    };
  }
}

export async function fourthwallPost<T>(url: string, data: any, options: RequestInit = {}): Promise<{ status: number; body: T }> {
  try {
    const result = await fetch(url, {
      method: 'POST',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: JSON.stringify(data)
    });

    const body = await result.json();

    return {
      status: result.status,
      body
    };
  } catch (e) {
    throw {
      error: e,
      url,
      data
    };
  }
}

const reshapeCollection = (collection: ShopifyCollection): Collection | undefined => {
  if (!collection) {
    return undefined;
  }

  return {
    ...collection,
    path: `/search/${collection.handle}`
  };
};

const reshapeCollections = (collections: ShopifyCollection[]) => {
  const reshapedCollections = [];

  for (const collection of collections) {
    if (collection) {
      const reshapedCollection = reshapeCollection(collection);

      if (reshapedCollection) {
        reshapedCollections.push(reshapedCollection);
      }
    }
  }

  return reshapedCollections;
};

const reshapeImages = (images: FourthwallProductImage[], productTitle: string): Image[] => {
  return images.map((image) => {
    const filename = image.url.match(/.*\/(.*)\..*/)?.[1];
    return {
      ...image,
      altText: `${productTitle} - ${filename}`
    };
  });
};

const reshapeProduct = (product: FourthwallProduct): Product | undefined => {
  if (!product) {
    return undefined;
  }

  const { images, variants, ...rest } = product;

  return {
    ...rest,
    images: reshapeImages(images, product.name),
    variants: reshapeVariants(variants)
  };
};

const reshapeVariants = (variants: FourthwallProductVariant[]): ProductVariant[] => {
  return variants.map((v) => ({
    id: v.id,
    title: v.name,
    availableForSale: true,
    selectedOptions: [],
    price: v.unitPrice,
  }))
}

const reshapeProducts = (products: FourthwallProduct[]) => {
  const reshapedProducts = [];

  for (const product of products) {
    if (product) {
      const reshapedProduct = reshapeProduct(product);

      if (reshapedProduct) {
        reshapedProducts.push(reshapedProduct);
      }
    }
  }

  return reshapedProducts;
};

export async function createCart(): Promise<Cart> {
  const res = await fourthwallPost(`https://api.staging.fourthwall.com/api/public/v1.0/carts?secret=${process.env.FW_SECRET}`, {
    items: []
  }, {
    headers: {
      'X-ShopId': process.env.FW_SHOPID
    }
  });

  console.warn('CART', res)

  return reshapeCart(res.body);
}

export async function addToCart(
  cartId: string,
  lines: { variantId: string; quantity: number }[]
): Promise<Cart> {
  console.warn('LL', lines);
  const res = await fourthwallPost(`${process.env.FW_URL}/api/public/v1.0/carts/${cartId}/add?secret=${process.env.FW_SECRET}`, {
    items: lines
  }, {
    headers: {
      'X-ShopId': 'sh_cd2b09e6-094a-4986-971f-cef77df19d0a'
    },
    cache: 'no-store'    
  });

  console.warn('ADDED', res)

  return reshapeCart(res.body);
}

export async function removeFromCart(cartId: string, variantIds: string[]): Promise<Cart> {
  const res = await fourthwallPost(`${process.env.FW_URL}/api/public/v1.0/carts/${cartId}/remove?secret=${process.env.FW_SECRET}`, {
    items: variantIds.map((variantId) => ({
      variantId
    })),
  }, {
    headers: {
      'X-ShopId': 'sh_cd2b09e6-094a-4986-971f-cef77df19d0a'
    },
    cache: 'no-store'
  });

  return reshapeCart(res.body);
}

export async function updateCart(
  cartId: string,
  lines: { variantId: string; quantity: number }[]
): Promise<Cart> {
  console.warn('UPDATING', lines);

  const res = await fourthwallPost(`${process.env.FW_URL}/api/public/v1.0/carts/${cartId}/change?secret=${process.env.FW_SECRET}`, {
    items: lines,
  }, {
    headers: {
      'X-ShopId': 'sh_cd2b09e6-094a-4986-971f-cef77df19d0a'
    },
    cache: 'no-store'
  });

  return reshapeCart(res.body);
}

export async function getCart(cartId: string | undefined): Promise<Cart | undefined> {
  if (!cartId) {
    return undefined;
  }

  const res = await fourthwallGet(`${process.env.FW_URL}/api/public/v1.0/carts/${cartId}?secret=${process.env.FW_SECRET}`, {
    cache: 'no-store'
  });

  return reshapeCart(res.body);
}

export async function getCollection(handle: string): Promise<Collection | undefined> {
  const res1 = await fourthwallGet(`${process.env.FW_URL}/api/public/v1.0/collections?secret=${process.env.FW_SECRET}`, {
    headers: {
      'X-ShopId': 'sh_cd2b09e6-094a-4986-971f-cef77df19d0a'
    }
  })
  console.warn('res1', res1)
  // const res = await fourthwallGet(`/api/public/v1.0/collections/${handle}`)

  return reshapeCollection(res1.body.collection);
}

export async function getCollectionProducts({
  collection,
  reverse,
  sortKey
}: {
  collection: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<Product[]> {
  const res = await fourthwallGet(`${process.env.FW_URL}/api/public/v1.0/collections/${collection}/products?secret=${process.env.FW_SECRET}`, {
    headers: {
      'X-ShopId': 'sh_cd2b09e6-094a-4986-971f-cef77df19d0a'
    }
  });

  if (!res.body.results) {
    console.log(`No collection found for \`${collection}\``);
    return [];
  }


  return reshapeProducts(res.body.results);
}

export async function getCollections(): Promise<Collection[]> {
  const res = await fourthwallGet('/api/public/v1.0/collections', {
    tags: [TAGS.collections]
  });
  const shopifyCollections = res.body.collections;
  const collections = [
    {
      handle: '',
      title: 'All',
      description: 'All products',
      seo: {
        title: 'All',
        description: 'All products'
      },
      path: '/search',
      updatedAt: new Date().toISOString()
    },
    // Filter out the `hidden` collections.
    // Collections that start with `hidden-*` need to be hidden on the search page.
    ...reshapeCollections(shopifyCollections).filter(
      (collection) => !collection.handle.startsWith('hidden')
    )
  ];

  return collections;
}

// Deprecate this
export async function getMenu(handle: string): Promise<Menu[]> {
  return [];
  // const res = await fourthwallGet(`/api/public/v1.0/menus/${handle}`, {
  //   tags: [TAGS.collections]
  // });

  // return (
  //   res.body.menu.items.map((item: { title: string; url: string }) => ({
  //     title: item.title,
  //     path: item.url.replace(domain, '').replace('/collections', '/search').replace('/pages', '')
  //   })) || []
  // );
}

export async function getPage(handle: string): Promise<Page> {
  const res = await fourthwallGet(`/api/public/v1.0/pages/${handle}`, {
    cache: 'no-store'
  });

  return res.body.page;
}

export async function getPages(): Promise<Page[]> {
  const res = await fourthwallGet('/api/public/v1.0/pages', {
    cache: 'no-store'
  });

  return res.body.pages;
}

export async function getProduct(handle: string): Promise<Product | undefined> {
  const res = await fourthwallGet(`${process.env.FW_URL}/api/public/v1.0/collections/${process.env.FW_COLLECTION}/products?secret=${process.env.FW_SECRET}`, {
    headers: {
      'X-ShopId': 'sh_cd2b09e6-094a-4986-971f-cef77df19d0a'
    }
  });

  return res.body.results.filter((product) => {
    return product.slug === handle
  }).map((p: any) => reshapeProduct(p, false))[0];
}


export async function getProducts({
  query,
  reverse,
  sortKey
}: {
  query?: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<Product[]> {
  const res = await fourthwallGet('/api/public/v1.0/products', {
    params: {
      query,
      reverse,
      sortKey
    },
    tags: [TAGS.products]
  });

  return reshapeProducts(res.data.products);
}

// This is called from `app/api/revalidate.ts` so providers can control revalidation logic.
export async function revalidate(req: NextRequest): Promise<NextResponse> {
  // We always need to respond with a 200 status code to Shopify,
  // otherwise it will continue to retry the request.
  const collectionWebhooks = ['collections/create', 'collections/delete', 'collections/update'];
  const productWebhooks = ['products/create', 'products/delete', 'products/update'];
  const topic = headers().get('x-shopify-topic') || 'unknown';
  const secret = req.nextUrl.searchParams.get('secret');
  const isCollectionUpdate = collectionWebhooks.includes(topic);
  const isProductUpdate = productWebhooks.includes(topic);

  if (!secret || secret !== process.env.SHOPIFY_REVALIDATION_SECRET) {
    console.error('Invalid revalidation secret.');
    return NextResponse.json({ status: 200 });
  }

  if (!isCollectionUpdate && !isProductUpdate) {
    // We don't need to revalidate anything for any other topics.
    return NextResponse.json({ status: 200 });
  }

  if (isCollectionUpdate) {
    revalidateTag(TAGS.collections);
  }

  if (isProductUpdate) {
    revalidateTag(TAGS.products);
  }

  return NextResponse.json({ status: 200, revalidated: true, now: Date.now() });
}
