async function getAccessToken(env) {
  if (env.SHOPIFY_ADMIN_ACCESS_TOKEN) return env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!env.SHOPIFY_CLIENT_ID || !env.SHOPIFY_CLIENT_SECRET) throw new Error('Shopify credentials are not configured');
  const response = await fetch(`https://${env.SHOPIFY_SHOP}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: env.SHOPIFY_CLIENT_ID,
      client_secret: env.SHOPIFY_CLIENT_SECRET,
      grant_type: 'client_credentials'
    })
  });
  if (!response.ok) throw new Error(`Shopify token request failed (${response.status})`);
  const payload = await response.json();
  return payload.access_token;
}

export async function fetchAuthoritativeItems(env, requestedItems) {
  const token = await getAccessToken(env);
  const ids = requestedItems.map(item => `gid://shopify/ProductVariant/${item.variantId}`);
  const response = await fetch(`https://${env.SHOPIFY_SHOP}/admin/api/${env.SHOPIFY_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({
      query: `query QuotationVariants($ids: [ID!]!) {
        shop { currencyCode }
        nodes(ids: $ids) {
          ... on ProductVariant {
            id title sku price inventoryQuantity
            product { title handle }
          }
        }
      }`,
      variables: { ids }
    })
  });
  if (!response.ok) throw new Error(`Shopify price validation failed (${response.status})`);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error('Shopify rejected the price validation query');
  const nodes = payload.data?.nodes || [];
  if (nodes.length !== requestedItems.length || nodes.some(node => !node)) throw new Error('One or more variants no longer exist');
  const items = nodes.map((node, index) => {
    const quantity = requestedItems[index].quantity;
    const unitPriceMinor = Math.round(Number(node.price) * 100);
    return {
      variantId: node.id.split('/').pop(),
      productTitle: node.product.title,
      variantTitle: node.title,
      handle: node.product.handle,
      sku: node.sku || '',
      quantity,
      inventoryQuantity: node.inventoryQuantity,
      unitPriceMinor,
      subtotalMinor: unitPriceMinor * quantity
    };
  });
  return { currency: payload.data.shop.currencyCode, items };
}

