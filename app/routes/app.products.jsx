import { Form, useLoaderData, useNavigation, useSearchParams } from "react-router";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const PAGE_SIZE = 5;

/**
 * Loader: fetch a page of products from the Admin GraphQL API
 * and any existing review snippets from our own database.
 */
export const loader = async ({ request }) => {
  // Ensure the merchant is authenticated and get an Admin API client + shop info
  const { admin, session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const direction = url.searchParams.get("direction") ?? "forward";

  // Forwards pagination uses `first/after`, backwards uses `last/before`
  const variables =
    direction === "backward"
      ? { last: PAGE_SIZE, before: cursor }
      : { first: PAGE_SIZE, after: cursor };

  // GraphQL query: get products with image and first variant (id + price)
  const response = await admin.graphql(
    `#graphql
      query ListProducts($first: Int, $after: String, $last: Int, $before: String) {
        products(first: $first, after: $after, last: $last, before: $before) {
          edges {
            cursor
            node {
              id
              title
              featuredImage {
                url
                altText
              }
              variants(first: 1) {
                edges {
                  node {
                    id
                    price
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `,
    { variables },
  );

  const result = await response.json();
  const products = result.data.products;

  // Collect product IDs (GIDs) for this page
  const productIds = products.edges.map((edge) => edge.node.id);

  // Load existing review snippets for these products from our DB
  const snippets = await prisma.reviewSnippet.findMany({
    where: {
      shop: session.shop,
      productId: { in: productIds },
    },
  });

  console.log(snippets)

  // Turn array of snippets into an object: { [productId]: "snippet text" }
  const snippetMap = {};
  for (const snippet of snippets) {
    snippetMap[snippet.productId] = snippet.content;
  }

  return Response.json({ products, snippetMap });
};

/**
 * Action: updates the product variant price in Shopify
 * and stores the reviewSnippet in our own database.
 */
export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();

  const productId = formData.get("productId");
  const variantId = formData.get("variantId");
  const price = formData.get("price");
  const reviewSnippet = (formData.get("reviewSnippet") ?? "").toString();

  if (!productId || !variantId) {
    return Response.json(
      { error: "Missing product or variant id" },
      { status: 400 },
    );
  }

  // 1) Update variant price via Admin GraphQL
  const mutationResponse = await admin.graphql(
    `#graphql
      mutation UpdateVariantPrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          productVariants {
            id
            price
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        productId,
        variants: [{ id: variantId, price }],
      },
    },
  );

  const mutationJson = await mutationResponse.json();
  const userErrors =
    mutationJson.data.productVariantsBulkUpdate.userErrors ?? [];

  if (userErrors.length > 0) {
    const message = userErrors.map((e) => e.message).join(", ");
    return Response.json({ error: message }, { status: 400 });
  }

  // 2) Save/update our reviewSnippet in Prisma
  await prisma.reviewSnippet.upsert({
    where: {
      shop_productId: {
        shop: session.shop,
        productId,
      },
    },
    create: {
      shop: session.shop,
      productId,
      content: reviewSnippet,
    },
    update: {
      content: reviewSnippet,
    },
  });

  return Response.json({ ok: true });
};

/**
 * React component: displays the product list with pagination
 * and a form per product to edit price + review snippet.
 */
export default function ProductsPage() {
  const { products, snippetMap } = useLoaderData();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const isSubmitting = navigation.state === "submitting";

  const pageInfo = products.pageInfo;

  return (
    <s-page heading="Products">
      <s-section>
        <s-stack direction="block" gap="base">
          {products.edges.map(({ node }) => {
            const firstVariant = node.variants.edges[0]?.node;
            const currentPrice = firstVariant?.price ?? "";
            const existingSnippet = snippetMap[node.id] ?? "";

            return (
              <s-box
                key={node.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background="subdued"
              >
                <ProductItem
                  product={node}
                  variantId={firstVariant?.id}
                  initialPrice={currentPrice}
                  initialSnippet={existingSnippet}
                  isSubmitting={isSubmitting}
                  currentSearch={searchParams.toString()}
                />
              </s-box>
            );
          })}
        </s-stack>
      </s-section>

      <s-section>
        <s-stack direction="inline" gap="base" alignment="center">
          {/* Previous page */}
          <Form method="get">
            <input
              type="hidden"
              name="cursor"
              value={pageInfo.startCursor ?? ""}
            />
            <input type="hidden" name="direction" value="backward" />
            <s-button
              type="submit"
              disabled={!pageInfo.hasPreviousPage || isSubmitting}
            >
              Previous
            </s-button>
          </Form>

          {/* Next page */}
          <Form method="get">
            <input
              type="hidden"
              name="cursor"
              value={pageInfo.endCursor ?? ""}
            />
            <input type="hidden" name="direction" value="forward" />
            <s-button
              type="submit"
              disabled={!pageInfo.hasNextPage || isSubmitting}
            >
              Next
            </s-button>
          </Form>
        </s-stack>
      </s-section>
    </s-page>
  );
}

/**
 * Single product row: shows image, title, price input, reviewSnippet input, and Save button.
 */
function ProductItem({
  product,
  variantId,
  initialPrice,
  initialSnippet,
  isSubmitting,
  currentSearch,
}) {
  const [price, setPrice] = useState(initialPrice);
  const [snippet, setSnippet] = useState(initialSnippet);

  return (
    <Form method="post">
      {/* Hidden IDs used by the action */}
      <input type="hidden" name="productId" value={product.id} />
      <input type="hidden" name="variantId" value={variantId ?? ""} />

      {/* Preserve pagination params after submit (optional) */}
      {currentSearch && (
        <input type="hidden" name="_search" value={currentSearch} />
      )}

      <s-stack direction="inline" gap="base" alignment="start">
        {product.featuredImage?.url && (
          <s-thumbnail
            size="large"
            alt={product.featuredImage.altText ?? product.title}
            source={product.featuredImage.url}
          />
        )}

        <s-stack direction="block" gap="base">
          <s-heading>{product.title}</s-heading>

          <s-inline-stack gap="base" alignment="center">
            <s-text-field
              label="Price"
              type="number"
              name="price"
              value={price}
              onChange={(event) => setPrice(event.currentTarget.value)}
            />
          </s-inline-stack>

          <s-text-field
            label="Review snippet"
            name="reviewSnippet"
            multiline
            value={snippet}
            onChange={(event) => setSnippet(event.currentTarget.value)}
          />

          <s-button type="submit" {...(isSubmitting ? { loading: true } : {})}>
            Save
          </s-button>
        </s-stack>
      </s-stack>
    </Form>
  );
}

