import type { AdminApiContext } from "@shopify/shopify-app-remix/server";

export interface ShopifyProduct {
  id: string;
  title: string;
  vendor: string;
  totalInventory: number;
  featuredImage: string | null;
  variants: {
    id: string;
    title: string;
    inventoryQuantity: number;
  }[];
}

const PRODUCTS_QUERY = `#graphql
  query getProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          title
          vendor
          totalInventory
          featuredImage {
            url
          }
          variants(first: 100) {
            edges {
              node {
                id
                title
                inventoryQuantity
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const SINGLE_PRODUCT_QUERY = `#graphql
  query getProduct($id: ID!) {
    product(id: $id) {
      id
      title
      vendor
      totalInventory
      featuredImage {
        url
      }
      variants(first: 100) {
        edges {
          node {
            id
            title
            inventoryQuantity
          }
        }
      }
    }
  }
`;

export async function fetchAllProducts(
  admin: AdminApiContext
): Promise<ShopifyProduct[]> {
  const products: ShopifyProduct[] = [];
  let hasNextPage = true;
  let afterCursor: string | null = null;

  while (hasNextPage) {
    const response = await admin.graphql(PRODUCTS_QUERY, {
      variables: {
        first: 50,
        after: afterCursor,
      },
    });

    const data = await response.json();
    const edges = data.data?.products?.edges || [];
    const pageInfo = data.data?.products?.pageInfo;

    for (const edge of edges) {
      const node = edge.node;
      products.push({
        id: node.id,
        title: node.title,
        vendor: node.vendor || "",
        totalInventory: node.totalInventory ?? 0,
        featuredImage: node.featuredImage?.url || null,
        variants: (node.variants?.edges || []).map((v: any) => ({
          id: v.node.id,
          title: v.node.title,
          inventoryQuantity: v.node.inventoryQuantity ?? 0,
        })),
      });
    }

    hasNextPage = pageInfo?.hasNextPage || false;
    afterCursor = pageInfo?.endCursor || null;
  }

  return products;
}

export async function fetchProduct(
  admin: AdminApiContext,
  productId: string
): Promise<ShopifyProduct | null> {
  const response = await admin.graphql(SINGLE_PRODUCT_QUERY, {
    variables: { id: productId },
  });

  const data = await response.json();
  const node = data.data?.product;

  if (!node) return null;

  return {
    id: node.id,
    title: node.title,
    vendor: node.vendor || "",
    totalInventory: node.totalInventory ?? 0,
    featuredImage: node.featuredImage?.url || null,
    variants: (node.variants?.edges || []).map((v: any) => ({
      id: v.node.id,
      title: v.node.title,
      inventoryQuantity: v.node.inventoryQuantity ?? 0,
    })),
  };
}
