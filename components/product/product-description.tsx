import { AddToCart } from 'components/cart/add-to-cart';
import Price from 'components/price';
import { Product } from 'lib/shopify/types';

export function ProductDescription({ product }: { product: Product }) {

  const maxVariantAmount = Math.max(
    0,
    ...product.variants.map((i) => i.price.value)
  )

  const currencyCode = product.variants[0]?.price.currencyCode || 'USD'

  return (
    <>
      <div className="mb-6 flex flex-col border-b pb-6 dark:border-neutral-700">
        <h1 className="mb-2 text-5xl font-medium">{product.title}</h1>
        <div className="mr-auto w-auto rounded-full bg-blue-600 p-2 text-sm text-white">
          <Price
            amount={maxVariantAmount.toString()}
            currencyCode={currencyCode}
          />
        </div>
      </div>
      {/* <VariantSelector options={product.options} variants={product.variants} /> */}
      {/* {product.descriptionHtml ? (
        <Prose
          className="mb-6 text-sm leading-tight dark:text-white/[60%]"
          html={product.descriptionHtml}
        />
      ) : null} */}
      <AddToCart product={product} />
    </>
  );
}
