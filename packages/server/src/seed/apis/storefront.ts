import { endpoint, official } from "../dsl.ts";

const product = {
  id: "prd_4Lw8",
  title: "Ridgeline waterproof jacket",
  handle: "ridgeline-waterproof-jacket",
  price: { amount: 18900, currency: "EUR" },
  available: true,
};

const cart = { id: "crt_9Xn2", currency: "EUR", totalQuantity: 2, cost: { total: { amount: 37800, currency: "EUR" } } };

export const storefront = official({
  id: "storefront",
  name: "Storefront",
  summary: "Products, carts and checkout through one GraphQL endpoint",
  description:
    "Storefront is the GraphQL API behind the shop. Every request is a POST to /graphql with a query and optional variables. Authentication problems come back as HTTP 200 with an errors array, as GraphQL clients expect.",
  category: "Commerce",
  owner: "Commerce experience",
  adapter: "graphql",
  version: "2026-10",
  stability: "stable",
  baseUrl: "https://api.tether.dev/storefront",
  auth: "bearer",
  rateLimit: 300,
  registeredAt: "2025-02-03T09:30:00Z",
  scopes: [
    { name: "catalog.read", description: "Read products and search the catalog" },
    { name: "carts.write", description: "Create carts and change their lines" },
  ],
  endpoints: [
    endpoint("storefront.ProductById", "POST", "/graphql", "ProductById", {
      description: "Fetches one product by id.",
      scope: "catalog.read",
      body: {
        query: "query ProductById($id: ID!) {\n  product(id: $id) {\n    id\n    title\n    handle\n    price { amount currency }\n    available\n  }\n}",
        variables: { id: "prd_4Lw8" },
      },
      response: { data: { product } },
    }),
    endpoint("storefront.SearchProducts", "POST", "/graphql", "SearchProducts", {
      description: "Searches the catalog and returns a page of matching products.",
      scope: "catalog.read",
      body: {
        query: "query SearchProducts($term: String!, $first: Int = 2) {\n  search(term: $term, first: $first) {\n    totalCount\n    nodes {\n      id\n      title\n      price { amount currency }\n    }\n  }\n}",
        variables: { term: "waterproof jacket", first: 2 },
      },
      response: {
        data: {
          search: {
            totalCount: 38,
            nodes: [
              { id: "prd_4Lw8", title: "Ridgeline waterproof jacket", price: { amount: 18900, currency: "EUR" } },
              { id: "prd_7Hc1", title: "Coastal shell, waterproof", price: { amount: 14500, currency: "EUR" } },
            ],
          },
        },
      },
    }),
    endpoint("storefront.CartCreate", "POST", "/graphql", "CartCreate", {
      description: "Creates an empty cart in a currency.",
      scope: "carts.write",
      body: {
        query: "mutation CartCreate($currency: CurrencyCode!) {\n  cartCreate(currency: $currency) {\n    cart { id currency totalQuantity }\n  }\n}",
        variables: { currency: "EUR" },
      },
      response: { data: { cartCreate: { cart: { id: "crt_9Xn2", currency: "EUR", totalQuantity: 0 } } } },
    }),
    endpoint("storefront.CartLinesAdd", "POST", "/graphql", "CartLinesAdd", {
      description: "Adds product lines to a cart and returns the new totals.",
      scope: "carts.write",
      body: {
        query: "mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {\n  cartLinesAdd(cartId: $cartId, lines: $lines) {\n    cart {\n      id\n      totalQuantity\n      cost { total { amount currency } }\n    }\n  }\n}",
        variables: { cartId: "crt_9Xn2", lines: [{ productId: "prd_4Lw8", quantity: 2 }] },
      },
      response: { data: { cartLinesAdd: { cart } } },
    }),
  ],
  changelog: [
    { version: "2026-10", date: "2026-10-06", note: "Added totalCount to search results and cost.total to carts" },
    { version: "2026-07", date: "2026-07-14", note: "CartLinesAdd accepts several lines per call" },
    { version: "2026-04", date: "2026-04-09", note: "Prices are returned as integer amounts with a currency code" },
  ],
});
