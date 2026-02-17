import prisma from "../db.server";

// This route is called via the app proxy configured in shopify.app.toml.
// It returns the reviewSnippet for a given product in the context of a shop.

export const loader = async ({ request }) => {
  try {
    const url = new URL(request.url);

    // Shopify app proxy calls your app with a signed query string that includes `shop`.
    const shop = url.searchParams.get("shop");
    const productId = url.searchParams.get("productId");

    if (!productId) {
      return Response.json({ error: "Missing productId" }, { status: 400 });
    }

    if (!shop) {
      // If for some reason `shop` is missing, just return empty to avoid 500s.
      return Response.json({ productId, reviewSnippet: "" });
    }

    const snippet = await prisma.reviewSnippet.findUnique({
      where: {
        shop_productId: {
          shop,
          productId,
        },
      },
    });

    return Response.json({
      productId,
      reviewSnippet: snippet?.content ?? "",
    });
  } catch (error) {
    console.error("Error in proxy.review-snippet loader", error);
    // Never surface a 500 to the storefront; just return empty snippet.
    return Response.json({
      productId: null,
      reviewSnippet: "",
    });
  }
};

